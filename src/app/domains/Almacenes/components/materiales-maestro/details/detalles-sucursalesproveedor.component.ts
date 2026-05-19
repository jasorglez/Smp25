import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { BranchsService } from 'app/services/branchs.service';
import { SignalsService } from 'app/services/signals.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';

@Component({
  selector: 'app-detalles-sucursalesproveedor',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 10px; background-color: #f0f4c3; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Detalle de Sucursales para Proveedor: {{ providerName }}</strong>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-success" (click)="addSucursal()">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="saveSucursales()" [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span *ngIf="hasChanges" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button class="btn btn-sm btn-warning" (click)="revertChanges()" >
                <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteSucursal()" [disabled]="!selectedSucursal">
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </div>
        </div>
        <ag-grid-angular
          style="width: 100%; flex-grow: 1;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="sucursalColumnDefs"
          [rowData]="sucursalRowData"
          [gridOptions]="sucursalGridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class DetallesSucursalesProveedorComponent implements ICellRendererAngularComp {
  private branchsService = inject(BranchsService);
  private signalsService = inject(SignalsService);
  private sucursalByMaterialProveedorService = inject(SucursalByMaterialProveedorService);

  public params!: ICellRendererParams;
  public providerName: string = '';
  private gridApi!: GridApi;
  private idRoot: number;

  public hasChanges: boolean = false;
  public sucursalRowData: any[] = [];
  public allBranches: any[] = [];
  public originalSucursalRowData: any[] = [];
  public selectedSucursal: any = null;

  public sucursalGridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single' as const,
    suppressClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    defaultColDef: {
      filter: false,
      suppressHeaderFilterButton: true,
      floatingFilter: false,
      sortable: true,
    },
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
  };

  public sucursalColumnDefs: ColDef[] = [];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.signalsService.setIdProveedor(params.data.id);
    this.loadCatalogData();

    // Obtener nombre del proveedor: primero desde providerName, sino buscar en contexto
    let displayName = params.data.providerName || 'N/A';
    if ((!params.data.providerName || params.data.providerName === '') && params.data.idTabla) {
      const providers = params.context?.providers || [];
      const filteredProviders = params.context?.filteredProviders || [];
      const provider = filteredProviders.find((p: any) => p.id === params.data.idTabla)
        || providers.find((p: any) => p.id === params.data.idTabla);

      if (provider) {
        displayName = provider.name || provider.description || provider.nameContact || provider.company || 'N/A';
      }
    }
    this.providerName = displayName;

    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    this.loadAllBranches().then(() => {
      this.sucursalColumnDefs = [
        {
          field: 'idSucursal',
          headerName: 'Sucursal',
          width: 200,
          editable: true,

          cellEditor: SelectWithTooltipEditorV2Component,

          cellEditorParams: (params) => {
            const currentIdSucursal = Number(params.data.idSucursal);
            const usedIds = new Set(
              (this.sucursalRowData || [])
                .map((row: any) => Number(row.idSucursal))
                .filter((id: number) => !isNaN(id) && id !== 0 && id !== currentIdSucursal)
            );
            return {
              options: (this.allBranches || [])
                .filter((p: any) => !usedIds.has(p.id))
                .map((p: any) => ({
                  id: p.id,
                  description: p.name
                }))
            };
          },

          // Mostrar el nombre de la sucursal
          valueFormatter: (params) => {
            if (!params.value) return '';
            const branch = this.allBranches?.find(p => p.id === Number(params.value));
            return branch ? branch.name : params.value;
          },

          valueSetter: (params) => {
            let v = params.newValue;

            // Normalizar valor:
            // el editor podría devolver string, number, o {id, description}
            let newValue = (v && typeof v === 'object' && 'id' in v)
              ? v.id
              : v;

            // 👉 Convertir siempre a number
            newValue = Number(newValue);

            if (isNaN(newValue)) {
              console.warn("Valor inválido, no es número:", params.newValue);
              return false;
            }

            // Validar requerido
            if (!newValue) {
              alerts.basicAlert('Campo requerido', 'La sucursal es obligatoria', 'error');
              return false;
            }

            // Validar duplicado
            const duplicateExists = (this.sucursalRowData || []).some((row, index) =>
              index !== params.node.rowIndex && Number(row.idSucursal) === newValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Valor duplicado',
                'Ya existe una fila con esa sucursal.',
                'error'
              );
              return false;
            }

            // Asignar
            params.data.idSucursal = newValue;
            return true;
          },

          // Coger siempre el número de data.sucursal (evita inconsistencias)
          valueGetter: (params) => Number(params.data.idSucursal),
        },
        {
          field: 'fechaAlta',
          headerName: 'Fecha Alta',
          width: 120,
          editable: true,
          cellEditor: 'agDateCellEditor',
          valueFormatter: (params) => {
            if (!params.value) return '';
            try {
              return params.value.toLocaleDateString();
            } catch (e) { return params.value; }
          },
          cellStyle: { textAlign: 'center' }
        },
        { field: 'stockMinimo', headerName: 'Stock Minimo', width: 120, editable: true, type: 'numericColumn' },
        { field: 'resurtido', headerName: 'Resurtido', width: 120, editable: true, type: 'numericColumn' },
        { field: 'capacidadMaxAlmacen', headerName: 'Capacidad Max. Almacen', width: 180, editable: true, type: 'numericColumn' },
        {
          field: 'tiempoDeEntrega',
          headerName: 'Tiempo de Entrega en semanas',
          width: 150,
          editable: true,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { precision: 0, min: 0 },
          valueFormatter: (params: any) => (params.value > 0 ? String(params.value) : ''),
          valueSetter: (params: any) => {
            const n = parseInt(String(params.newValue));
            params.data.tiempoDeEntrega = isNaN(n) || n < 0 ? 0 : n;
            return true;
          }
        },
        {
          field: 'vigente', headerName: 'Activo', width: 100, editable: true,
          cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor',
        },
        // Columna 8 (oculta o para datos internos)
        { field: 'id', headerName: 'ID', width: 80, hide: true }
      ];

      // Columnas asíncronas: onFirstDataRendered puede haber corrido sin defs; repetir autosize al estar listas.
      setTimeout(() => this.scheduleAutosize(), 0);
    });
  }

  private scheduleAutosize(): void {
    if (!this.gridApi) return;
    runAutosizeAllColumns(this.gridApi);
  }

  async loadAllBranches() {
    if (this.idRoot) {
      this.allBranches = await this.branchsService.getBranches2fields(this.idRoot).toPromise();
    }
  }

  loadCatalogData() {
    const idProveedor = this.signalsService.getIdProveedor();
    this.sucursalByMaterialProveedorService.getSucursalByMaterial(idProveedor).subscribe(
      (data: any) => {
        this.sucursalRowData = data.map((row: any) => ({
          ...row,
          fechaAlta: row.fechaAlta ? new Date(row.fechaAlta) : null
        }));
        this.originalSucursalRowData = JSON.parse(JSON.stringify(this.sucursalRowData));
        setTimeout(() => this.scheduleAutosize(), 0);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    setTimeout(() => this.scheduleAutosize(), 0);
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  onSelectionChanged(event: any) {
    const selectedRows = event.api.getSelectedRows();
    this.selectedSucursal = selectedRows.length > 0 ? selectedRows[0] : null;

  }

  addSucursal() {
    const raw = this.signalsService.getBranchSelectedBySidebar()() || 0;
    const branchId = raw > 0 ? raw : 0;

    const newRow = {
      id: `temp_${Date.now()}`,
      idSucursal: branchId,
      fechaAlta: new Date(),
      stockMinimo: 0,
      resurtido: 0,
      capacidadMaxAlmacen: 0,
      tiempoDeEntrega: 2,
      active: true,
      vigente: true,
      idMaterialByProveedor: this.params.data.id,
      __isNew: true
    };
    this.sucursalRowData = [newRow, ...this.sucursalRowData];
    this.hasChanges = true;
    setTimeout(() => {
      this.scheduleAutosize();
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idSucursal' });
    }, 100);
  }

  revertChanges() {
    if (!this.hasChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios que revertir.', 'info');
      return;
    }
    this.sucursalRowData = JSON.parse(JSON.stringify(this.originalSucursalRowData));
    this.gridApi.setGridOption('rowData', this.sucursalRowData);
    this.hasChanges = false;
    this.loadCatalogData();
    this.selectedSucursal = null;
  }

  async saveSucursales() {
    // Aquí iría la lógica para guardar en el servidor
    /*const isValid = this.sucursalRowData.every(
                (item) =>
                  item.masterFamily
              );
              if (!isValid) {
                alerts.basicAlert(
                  'Añadir entrada',
                  'Debe llenar los campos obligatorios antes de guardar.',
                  'error'
                );
                return;
              }*/

    const newRows = this.sucursalRowData.filter((row) => row.__isNew);
    const modifiedRows = this.sucursalRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.sucursalByMaterialProveedorService.addSucursalByMaterial(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.sucursalByMaterialProveedorService.updateSucursalByMaterial(row.id, cleanedData);
    });

    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      /*
      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        // Si hay filas modificadas, guardamos el ID de la última modificada
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }*/

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.hasChanges = false;
      this.loadCatalogData();

      // Notificar al componente de proveedores para que quite el color rosa
      const idProveedor = this.signalsService.getIdProveedor();
      this.sucursalByMaterialProveedorService.notifySucursalSaved(idProveedor);

      // Seleccionar la fila apropiada después de recargar
      /*if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.sucursalRowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null; // Resetear el ID
      }*/
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    // Convert Date objects to ISO strings for the backend
    if (cleanedData.fechaAlta instanceof Date) {
      cleanedData.fechaAlta = cleanedData.fechaAlta.toISOString();
    }
    return cleanedData;
  }

  async deleteSucursal() {
    if (!this.selectedSucursal) {
      alerts.basicAlert('Error', 'Seleccione una sucursal para eliminar.', 'warning');
      return;
    }
    if (!this.gridApi) {
      alerts.basicAlert('Error', 'Grid no inicializado.', 'error');
      return;
    }

    const selectedNodes = this.gridApi.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const node = selectedNodes[0];
    const selectedData = node?.data;
    if (!selectedData) {
      alerts.basicAlert('Eliminar entrada', 'No se encontró la fila seleccionada.', 'error');
      return;
    }

    // Confirmación antes de eliminar
    alerts
      .confirmAlert(
        'Eliminar entrada',
        '¿Está seguro que desea eliminar esta entrada?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        // Determinar el id real (puede venir como 'id' o 'Id' según el backend)
        const realId = selectedData.id ?? selectedData.Id ?? null;

        // Si la fila es nueva (no guardada en servidor) o no tiene id, la eliminamos localmente
        if (selectedData.__isNew || !realId) {
          this.gridApi.applyTransaction({ remove: [selectedData] });
          // Mantener selectedSucursal sincronizado
          this.selectedSucursal = this.selectedSucursal.filter((r) => r !== selectedData);
          alerts.basicAlert('Entrada eliminada', 'La entrada se eliminó localmente.', 'success');
          return;
        }

        // Si la fila existe en servidor, llamamos al servicio para eliminarla
        const id = realId;
        this.sucursalByMaterialProveedorService
          .deleteSucursalByMaterial(id)
          .pipe(
            catchError((error) => {
              alerts.basicAlert(
                'Eliminar entrada',
                'Error al eliminar la entrada.',
                'error'
              );
              console.error(error);
              return EMPTY;
            })
          )
          .subscribe(() => {
            alerts.basicAlert(
              'Entrada eliminada',
              'La entrada se eliminó correctamente.',
              'success'
            );
            // Recargar datos desde el servidor para mantener consistencia
            this.loadCatalogData();
          });
      });
  }
}
