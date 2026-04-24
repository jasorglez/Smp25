import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-molienda-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div class="col-12">
      <div class="row g-2">
        <div class="col-auto">
          <div class="d-flex flex-column gap-1">
            <button type="button" class="btn btn-primary" (click)="addRow()" [disabled]="!gridApi">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" class="btn btn-success position-relative" (click)="saveChanges()" [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i>
              <span class="position-absolute top-0 end-0 translate-middle p-2 bg-danger border border-light rounded-circle"
                    *ngIf="hasChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button type="button" class="btn btn-warning" (click)="revert()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button type="button" class="btn btn-danger" (click)="deleteEntry()" [disabled]="!selectedRow">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="col">   

          <ag-grid-angular
            style="width: 100%"
            [ngStyle]="{ height: gridHeight }"
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="rowData"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            [rowSelection]="'single'"
            [stopEditingWhenCellsLoseFocus]="true"
            (gridReady)="onGridReady($event)"
            (selectionChanged)="onSelectionChanged($event)"
            (cellValueChanged)="onCellValueChanged($event)"
            (cellEditingStopped)="onCellEditingStopped($event)">
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `,
})
export class MoliendaComponent {
  authService  = inject(AuthService);
  signalService = inject(SignalsService);

  gridApi!: GridApi;
  rowData: any[] = [];
  hasChanges = false;
  selectedRow: any = null;
  gridHeight: string = '80vh';

  private enterPressed = false;
  private readonly editableColumnOrder = [
    'sucursal', 'matPrima', 'fecha', 'nombre',
    'cantidadUso', 'cuantoQueda', 'jugo', 'liberPorCompra', 'adicional'
  ];

  colDefs: ColDef[] = [
    { field: 'sucursal',      headerName: 'Sucursal',        flex: 1,   editable: true },
    { field: 'matPrima',      headerName: 'Mat Prima',       flex: 2,   editable: true },
    {
      field: 'fecha', headerName: 'Fecha', width: 120, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter:   p => p.data?.fecha ? String(p.data.fecha).substring(0, 10) : '',
      valueSetter:   p => { p.data.fecha = p.newValue; return true; },
      valueFormatter: p => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    { field: 'nombre',        headerName: 'Nombre',          flex: 2,   editable: true },
    { field: 'cantidadUso',   headerName: 'Cantidad uso',    width: 120, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'cuantoQueda',   headerName: 'Cuanto queda',    width: 120, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'jugo',          headerName: 'Jugo',            width: 90,  editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'liberPorCompra',headerName: 'Liber. x Compra', width: 130, editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'adicional',     headerName: 'Adicional',       flex: 1,   editable: true },
  ];

  defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, floatingFilter: true,
    suppressKeyboardEvent: params => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => this.gridApi?.stopEditing(), 0);
        return true;
      }
      return false;
    },
  };

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressRowClickSelection: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    getRowClass: (p: any) => p.node.isSelected() ? 'selected-row' : '',
    onRowClicked: (e: any) => e.node.setSelected(true),
    onRowSelected: (e: any) => {
      if (e.node.isSelected()) {
        this.gridApi?.forEachNode(n => { if (n.id !== e.node.id) n.setSelected(false); });
        this.selectedRow = e.data;
      }
    },
    onCellValueChanged: (e: any) => {
      e.data.__modified = true;
      this.hasChanges = true;
    },
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  onSelectionChanged(event: any) {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  addRow() {
    const newRow = {
      id: `temp_${Date.now()}`,
      sucursal: '', matPrima: '', fecha: null, nombre: '',
      cantidadUso: null, cuantoQueda: null, jugo: null,
      liberPorCompra: null, adicional: '',
      active: true, __isNew: true,
    };
    this.gridApi.applyTransaction({ add: [newRow], addIndex: 0 });
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'sucursal' });
    }, 100);
  }

  async saveChanges() {
    const newRows: any[] = [], modRows: any[] = [];
    this.gridApi.forEachNode(n => {
      if (n.data.__isNew)       newRows.push(n.data);
      else if (n.data.__modified) modRows.push(n.data);
    });
    if (!newRows.length && !modRows.length) return;
    // TODO: conectar con servicio
    alerts.basicAlert('Guardado', 'Cambios guardados correctamente', 'success');
    this.hasChanges = false;
  }

  revert() {
    // TODO: recargar desde servicio
    this.hasChanges = false;
  }

  async deleteEntry() {
    const nodes = this.gridApi.getSelectedNodes();
    if (!nodes.length) { alerts.basicAlert('Atención', 'Seleccione un registro', 'warning'); return; }
    const data = nodes[0].data;
    if (data.__isNew) { this.gridApi.applyTransaction({ remove: [data] }); return; }
    const res = await alerts.confirmAlert('Eliminar', '¿Está seguro?', 'warning', 'Sí, eliminar');
    if (res.isConfirmed) {
      // TODO: conectar con servicio
      alerts.basicAlert('Eliminado', 'Registro eliminado', 'success');
    }
  }
}
