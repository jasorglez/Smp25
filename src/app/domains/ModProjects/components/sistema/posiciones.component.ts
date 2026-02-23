import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { PosicionesService } from 'app/services/posiciones.service';
import { RolesService } from 'app/services/roles.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-posiciones',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="container-fluid p-2">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h6 class="mb-0 fw-bold">Posiciones</h6>
        <div class="d-flex gap-2 ms-auto">
          <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges"></span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="delete()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>

      <ag-grid-angular
        class="ag-theme-quartz"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (rowSelected)="onRowSelected($event)"
        style="height: 500px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
})
export class PosicionesComponent implements OnInit {

  private posicionesService = inject(PosicionesService);
  private rolesService      = inject(RolesService);
  private signalsService    = inject(SignalsService);

  public rowData: any[]          = [];
  private originalRowData: any[] = [];
  public gridApi!: GridApi;
  public hasUnsavedChanges       = false;
  public selectedRow: any        = null;
  private idRoot: number         = 0;

  private roles: any[] = [];

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    rowSelection: 'single',
    animateRows: true,
    pagination: true,
    paginationPageSize: 25,
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  };

  public colDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 70, editable: false },
    {
      field: 'description',
      headerName: 'Descripción / Puesto',
      flex: 1,
      editable: true,
    },
    {
      field: 'idRoles',
      headerName: 'Rol',
      width: 200,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({
        values: this.roles.map(r => r.id),
      }),
      valueFormatter: (p) => {
        const rol = this.roles.find(r => r.id === p.value);
        return rol ? rol.description : (p.value ?? '');
      },
    },
    {
      field: 'active',
      headerName: 'Activo',
      width: 90,
      editable: true,
      cellEditor: 'agCheckboxCellEditor',
      cellRenderer: (p: any) => p.value
        ? '<i class="bi bi-check-circle-fill text-success"></i>'
        : '<i class="bi bi-x-circle-fill text-danger"></i>',
    },
  ];

  constructor() {
    effect(() => {
      const root = this.signalsService.getRootSelectedBySidebar()();
      if (root && root !== this.idRoot) {
        this.idRoot = root;
        this.load();
      }
    });
  }

  ngOnInit(): void {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (this.idRoot) this.load();
  }

  private load(): void {
    this.rolesService.getRoles(this.idRoot).subscribe({
      next: (resp: any) => {
        this.roles = Array.isArray(resp) ? resp : (resp.data || []);
      },
      error: () => {}
    });

    this.posicionesService.getPositionsByCompany(this.idRoot).subscribe({
      next: (resp: any) => {
        this.rowData = (Array.isArray(resp) ? resp : (resp.data || [])).map((p: any) => ({
          ...p, __isNew: false, __modified: false
        }));
        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
        this.hasUnsavedChanges = false;
        this.selectedRow = null;
      },
      error: () => alerts.basicAlert('Error', 'No se pudieron cargar las posiciones', 'error'),
    });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  add(): void {
    if (!this.idRoot) return;
    const newRow = {
      id: null,
      idCompany: this.idRoot,
      idRoles: this.roles[0]?.id ?? null,
      description: '',
      active: true,
      __isNew: true,
      __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 50);
  }

  async saveChanges(): Promise<void> {
    const newItems      = this.rowData.filter(r => r.__isNew);
    const modifiedItems = this.rowData.filter(r => r.__modified && !r.__isNew);
    try {
      for (const item of newItems) {
        await new Promise((resolve, reject) => {
          this.posicionesService.addPosition(this.clean(item))
            .subscribe({ next: resolve, error: reject });
        });
      }
      for (const item of modifiedItems) {
        await new Promise((resolve, reject) => {
          this.posicionesService.updatePosition(item.id, this.clean(item))
            .subscribe({ next: resolve, error: reject });
        });
      }
      alerts.basicAlert('Éxito', 'Posiciones guardadas', 'success');
      this.load();
    } catch {
      alerts.basicAlert('Error', 'Error al guardar', 'error');
    }
  }

  revertChanges(): void {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  async delete(): Promise<void> {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      this.selectedRow = null;
      return;
    }
    const result = await alerts.confirmAlert('¿Eliminar posición?', 'Esta acción no se puede deshacer', 'warning', 'Eliminar');
    if (!result.isConfirmed) return;
    this.posicionesService.deletePosition(this.selectedRow.id).subscribe({
      next: () => { alerts.basicAlert('Eliminado', 'Posición eliminada', 'success'); this.load(); },
      error: () => alerts.basicAlert('Error', 'No se pudo eliminar', 'error'),
    });
  }

  onRowSelected(event: any): void {
    if (event.node.isSelected()) this.selectedRow = event.data;
  }

  onCellValueChanged(event: any): void {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  private clean(item: any): any {
    const { __isNew, __modified, ...data } = item;
    return data;
  }
}
