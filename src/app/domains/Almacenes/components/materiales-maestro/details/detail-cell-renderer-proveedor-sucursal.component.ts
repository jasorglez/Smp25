import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { BranchsService } from 'app/services/branchs.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-detail-cell-renderer-proveedor-sucursal',
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
            <button class="btn btn-sm btn-warning" (click)="revertChanges()" [disabled]="!hasChanges">
                <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="saveSucursales()" [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span *ngIf="hasChanges" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
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
export class DetailCellRendererProveedorSucursalComponent implements ICellRendererAngularComp {
  private branchsService = inject(BranchsService);
  private signalsService = inject(SignalsService);

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
  };

  public sucursalColumnDefs: ColDef[] = [];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerName = params.data.providerName || 'N/A';
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    this.loadAllBranches().then(() => {
      this.sucursalColumnDefs = [
        {
          field: 'sucursal', headerName: 'Sucursal', width: 200, editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: this.allBranches.map(b => b.name) }
        },
        { field: 'fechaAlta', headerName: 'Fecha Alta', width: 120, editable: true },
        { field: 'stockMinimo', headerName: 'Stock Minimo', width: 120, editable: true, type: 'numericColumn' },
        { field: 'resurtido', headerName: 'Resurtido', width: 120, editable: true, type: 'numericColumn' },
        { field: 'capacidadMaxAlmacen', headerName: 'Capacidad Max. Almacen', width: 180, editable: true, type: 'numericColumn' },
        { field: 'tiempoDeEntrega', headerName: 'Tiempo de Entrega', width: 150, editable: true },
        {
          field: 'activo', headerName: 'Activo', width: 100, editable: true,
          cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor'
        },
        // Columna 8 (oculta o para datos internos)
        { field: 'id', headerName: 'ID', width: 80, hide: true }
      ];

      // Usar los datos falsos generados en el componente padre
      this.sucursalRowData = params.data.sucursalDetailData || [];
      this.originalSucursalRowData = JSON.parse(JSON.stringify(this.sucursalRowData)); // Guardar copia original
    });
  }

  async loadAllBranches() {
    if (this.idRoot) {
      this.allBranches = await this.branchsService.getBranches2fields(this.idRoot).toPromise();
    }
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
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
    const newRow = {
      id: `temp_${Date.now()}`,
      sucursal: '',
      fechaAlta: new Date().toISOString().split('T')[0],
      stockMinimo: 0,
      resurtido: 0,
      capacidadMaxAlmacen: 0,
      tiempoDeEntrega: '',
      activo: true,
      __isNew: true
    };
    this.sucursalRowData = [newRow, ...this.sucursalRowData];
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'sucursal' });
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
    this.selectedSucursal = null;
  }

  saveSucursales() {
    // Aquí iría la lógica para guardar en el servidor
    console.log('Guardando datos de sucursales:', this.sucursalRowData.filter(r => r.__isNew || r.__modified));
    alerts.basicAlert('Guardado', 'Los cambios en sucursales se han guardado (simulado).', 'success');
    this.hasChanges = false;
    // Limpiar flags
    this.sucursalRowData.forEach(row => {
      delete row.__isNew;
      delete row.__modified;
    });
  }

  async deleteSucursal() {
    if (!this.selectedSucursal) {
      alerts.basicAlert('Error', 'Seleccione una sucursal para eliminar.', 'warning');
      return;
    }

    const confirm = await alerts.confirmAlert('¿Eliminar Sucursal?', `¿Está seguro de eliminar la sucursal ${this.selectedSucursal.sucursal}?`, 'warning', 'Sí, eliminar');
    if (confirm.isConfirmed) {
      // Lógica para eliminar
      this.sucursalRowData = this.sucursalRowData.filter(row => row.id !== this.selectedSucursal.id);
      this.gridApi.setGridOption('rowData', this.sucursalRowData);
      this.selectedSucursal = null;
      this.hasChanges = true; // Marcar que hay cambios para guardar la eliminación
      alerts.basicAlert('Eliminado', 'La sucursal ha sido eliminada de la lista. Guarde los cambios para confirmar.', 'info');
    }
  }
}