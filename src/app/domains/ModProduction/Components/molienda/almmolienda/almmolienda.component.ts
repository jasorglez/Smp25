import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { forkJoin } from 'rxjs';
import { SignalsService } from '../../../../../services/signals.service';

@Component({
  selector: 'app-almmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  styles: [`
    .toast-mini {
      display: inline-block;
      background: #198754;
      color: #fff;
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 6px;
      animation: fadeInOut 1.5s ease forwards;
    }
    @keyframes fadeInOut {
      0%   { opacity: 0; transform: translateY(-4px); }
      15%  { opacity: 1; transform: translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `],
  template: `
    <div class="col-md-12 mt-2">

      <div *ngIf="toastMsg()" class="toast-mini">{{ toastMsg() }}</div>

      <div class="d-flex">

        <!-- BOTONES CRUD — izquierda -->
        <div class="d-flex flex-column gap-2 me-2">
          <button class="btn btn-xs btn-success" title="Agregar" (click)="add()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-xs btn-primary position-relative" title="Guardar" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasUnsavedChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-xs btn-warning" title="Deshacer" (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-xs btn-danger" title="Borrar" (click)="deleteRow()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i>
          </button>
        </div>

        <!-- GRID -->
        <div class="flex-grow-1">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            [gridOptions]="gridOptions"
            (gridReady)="onGridReady($event)"
            (cellValueChanged)="onCellValueChanged($event)"
            (rowClicked)="onRowClicked($event)"
            (cellEditingStopped)="onCellEditingStopped($event)"
            style="height: 350px; width: 100%;">
          </ag-grid-angular>
        </div>

      </div>

    </div>
  `,
})
export class AlmmoliendaComponent {
  private signalsService = inject(SignalsService);

  hasUnsavedChanges = false;
  selectedRow: any  = null;
  toastMsg          = signal('');
  rowData           = signal<any[]>([]);
  private originalRowData: any[] = [];
  gridApi!: GridApi;
  private idRoot = 0;
  private enterPressed = false;
  private editableColumnOrder = ['sucursal', 'entradas', 'salidas', 'totalInventarios', 'ajustesInventarios', 'comentarios'];

  columnDefs: ColDef[] = [
    {
      headerName: 'Sucursal',
      field: 'sucursal',
      minWidth: 100,
      editable: true,
    },

    {
      headerName: 'Articulo',
      field: 'id_articulo',
      flex: 1,
      minWidth: 180,
      editable: true,
    },

    {
      headerName: 'Entradas',
      field: 'entradas',
      width: 110,
      editable: true,
      type: 'numericColumn',
    },
    {
      headerName: 'Salidas',
      field: 'salidas',
      width: 110,
      editable: true,
      type: 'numericColumn',
    },
    {
      headerName: 'Total Inventarios',
      field: 'totalInventarios',
      width: 140,
      editable: true,
      type: 'numericColumn',
    },
    {
      headerName: 'Ajustes Inventarios',
      field: 'ajustesInventarios',
      width: 150,
      editable: true,
      type: 'numericColumn',
    },
    {
      headerName: 'Comentarios',
      field: 'comentarios',
      flex: 2,
      minWidth: 160,
      editable: true,
    },
  ];

  gridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  constructor() {
    effect(() => {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (idRoot) {
        this.idRoot = idRoot;
        this.loadData(idRoot);
      }
    });
  }

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  private showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(''), 1500);
  }

  onRowClicked(event: any)       { this.selectedRow = event.data; }
  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
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

  loadData(idRoot: number) {
    // TODO: conectar endpoint
    this.originalRowData = [];
    this.rowData.set([]);
  }

  add() {
    const newRow = {
      id: null,
      sucursal: '',
      entradas: 0,
      salidas: 0,
      totalInventarios: 0,
      ajustesInventarios: 0,
      comentarios: '',
      __isNew: true,
    };
    this.rowData.set([newRow, ...this.rowData()]);
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'sucursal' });
    }, 0);
  }

  async saveChanges() {
    const rows = this.rowData().filter(r => r.__isNew || r.__modified);
    if (rows.length === 0) return;
    // TODO: conectar servicio create/update
    this.hasUnsavedChanges = false;
    this.showToast('Guardado');
  }

  revertChanges() {
    this.rowData.set(JSON.parse(JSON.stringify(this.originalRowData)));
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
  }

  deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData.set(this.rowData().filter(r => r !== this.selectedRow));
      this.selectedRow = null;
      this.hasUnsavedChanges = this.rowData().some(r => r.__isNew || r.__modified);
      return;
    }
    // TODO: conectar servicio delete
    this.selectedRow = null;
    this.showToast('Borrado');
    this.loadData(this.idRoot);
  }
}
