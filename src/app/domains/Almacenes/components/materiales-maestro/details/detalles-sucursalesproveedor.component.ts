import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, ChangeDetectorRef} from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { BranchsService } from 'app/services/branchs.service';
import { SignalsService } from 'app/services/signals.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';
import { PendingChangesService } from 'app/services/pending-changes.service';

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
            <!-- Guardar centralizado en Nivel 1 (materiales-maestro). Ver PendingChangesService. -->
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
export class DetallesSucursalesProveedorComponent implements ICellRendererAngularComp, OnDestroy {
  private branchsService = inject(BranchsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private sucursalByMaterialProveedorService = inject(SucursalByMaterialProveedorService);
  private pendingChangesService = inject(PendingChangesService);

  public params!: ICellRendererParams;
  public providerName: string = '';
  private gridApi!: GridApi;
  private idRoot: number;
  private saverId: string = '';

  /** Cambios pendientes del Nivel 3. El setter notifica al servicio central
   *  y sincroniza el flag al cache de `params.data` (sobrevive al desmonte). */
  private _hasChanges: boolean = false;
  get hasChanges(): boolean { return this._hasChanges; }
  set hasChanges(value: boolean) {
    this._hasChanges = value;
    if (this.saverId) {
      this.pendingChangesService.notifyChanges(this.saverId, value);
    }
    if (this.params?.data) {
      (this.params.data as any).__pendingSucursalesDirty = value;
    }
  }
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

    // Registro en el bus central. El callback acepta idMap para remapear `idMaterialByProveedor`
    // cuando el proveedor padre era nuevo (tempId) y el Nivel 2 ya lo creó en BD.
    // Cache de filas pendientes en `params.data` (sobrevive al desmonte del componente
     // cuando AG Grid colapsa el detail row). Sin este cache, las filas no guardadas se
     // pierden al cerrar y reabrir la cascada.
    const cached = (params.data as any).__pendingSucursales;
    const hasPendingChanges = !!(params.data as any).__pendingSucursalesDirty;

    // Registro en el bus central. Importante: si hay cambios pendientes en caché,
    // marcamos el saver como dirty para que el badge del Guardar único se mantenga encendido.
    this.saverId = `sucursales-${params.data.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.pendingChangesService.register(this.saverId, {
      hasChanges: hasPendingChanges,
      save: (idMap?: Map<string, number>) => this.saveSucursales(idMap)
    });

    if (Array.isArray(cached)) {
      // Restaurar filas previas (incluye no guardadas con __isNew/__modified).
      this.sucursalRowData = cached;
      this.originalSucursalRowData = JSON.parse(JSON.stringify(cached.filter((r: any) => !r.__isNew)));
      this._hasChanges = hasPendingChanges;
      setTimeout(() => this.scheduleAutosize(), 0);
    } else {
      this.loadCatalogData();
    }

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
  
    this.cdr.detectChanges();}

  private scheduleAutosize(): void {
    if (!this.gridApi) return;
    runAutosizeAllColumns(this.gridApi);
  }

  async loadAllBranches() {
    if (this.idRoot) {
      this.allBranches = await this.branchsService.getBranches2fields(this.idRoot).toPromise();
    }
  }

  /** True si el proveedor padre todavía es nuevo (id temporal). */
  private isTempProveedorId(idProveedor: any): boolean {
    return typeof idProveedor === 'string' && String(idProveedor).startsWith('temp_');
  }

  /** Persiste las filas en `params.data` para que sobrevivan al desmonte del componente
   *  (cuando AG Grid colapsa el detail row). Sin esto, las filas no guardadas se pierden. */
  private syncCacheToParams(): void {
    if (!this.params?.data) return;
    (this.params.data as any).__pendingSucursales = this.sucursalRowData;
    (this.params.data as any).__pendingSucursalesDirty = this._hasChanges;
  }

  loadCatalogData() {
    const idProveedor = this.signalsService.getIdProveedor();
    // Si el proveedor padre aún no fue guardado en BD (id temporal), no hay datos que cargar;
    // el usuario agrega sucursales en memoria y se persistirán cuando el Guardar centralizado
    // primero cree el proveedor y luego propague el ID real vía idMap.
    if (this.isTempProveedorId(idProveedor)) {
      this.sucursalRowData = [];
      this.originalSucursalRowData = [];
      setTimeout(() => this.scheduleAutosize(), 0);
      return;
    }
    this.sucursalByMaterialProveedorService.getSucursalByMaterial(idProveedor).subscribe(
      (data: any) => {
        this.sucursalRowData = data.map((row: any) => ({
          ...row,
          fechaAlta: row.fechaAlta ? new Date(row.fechaAlta) : null
        }));
        this.originalSucursalRowData = JSON.parse(JSON.stringify(this.sucursalRowData));
        this.syncCacheToParams();
        setTimeout(() => this.scheduleAutosize(), 0);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  refresh(): boolean {
    return false;
  }

  ngOnDestroy(): void {
    if (this.saverId) {
      this.pendingChangesService.unregister(this.saverId);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    setTimeout(() => this.scheduleAutosize(), 0);
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
    this.syncCacheToParams();
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
    this.syncCacheToParams();
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
    // Limpiar cache: ya no hay cambios pendientes.
    if (this.params?.data) {
      delete (this.params.data as any).__pendingSucursales;
      delete (this.params.data as any).__pendingSucursalesDirty;
    }
    this.loadCatalogData();
    this.selectedSucursal = null;
  }

  async saveSucursales(idMap?: Map<string, number>) {
    // Remapeo de tempProveedorId → realProveedorId. CRÍTICO: el remap de cada fila se hace
    // SIEMPRE que `idMaterialByProveedor` sea string temporal y esté en el mapa, sin importar
    // el estado de `this.params.data.id` (que pudo mutarse externamente al guardar Nivel 2).
    if (idMap && this.sucursalRowData.length > 0) {
      this.sucursalRowData.forEach((row: any) => {
        const ref = row.idMaterialByProveedor;
        if (ref != null && typeof ref === 'string' && ref.startsWith('temp_')) {
          const realId = idMap.get(ref);
          if (realId) row.idMaterialByProveedor = realId;
        }
      });
    }

    // Sanity check: ninguna fila a guardar debe tener idMaterialByProveedor temporal.
    const rowsWithTempFk = this.sucursalRowData.filter(
      (row: any) => (row.__isNew || row.__modified) && typeof row.idMaterialByProveedor === 'string' && String(row.idMaterialByProveedor).startsWith('temp_')
    );
    if (rowsWithTempFk.length > 0) {
      console.error('[saveSucursales] ABORTADO: filas con idMaterialByProveedor temporal:', rowsWithTempFk, 'idMap:', idMap);
      alerts.basicAlert(
        'Error de sincronización',
        'No se pudo vincular el proveedor recién creado con las sucursales. Recarga la página.',
        'error'
      );
      return;
    }

    console.log('[saveSucursales] inicio. idMap:', idMap ? Array.from(idMap.entries()) : 'undefined',
      'sucursalRowData FK:', this.sucursalRowData.map(r => ({ id: r.id, idMaterialByProveedor: r.idMaterialByProveedor, __isNew: r.__isNew })));

    // Cuando se invoca desde el Guardar centralizado sin cambios reales, salir silencioso.
    if (!this.hasChanges && idMap) return;

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
      console.log('[saveSucursales] POST SucursalByMaterialProveedor payload:', cleanedData);
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
      // Limpiar cache: los datos ya están persistidos en BD.
      if (this.params?.data) {
        delete (this.params.data as any).__pendingSucursales;
        delete (this.params.data as any).__pendingSucursalesDirty;
      }
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
    } catch (error: any) {
      console.error(error);
      console.error('[saveSucursales] backend error body:', error?.error);
      if (error?.error?.errors) {
        console.error('[saveSucursales] validation errors:', JSON.stringify(error.error.errors, null, 2));
      }
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
