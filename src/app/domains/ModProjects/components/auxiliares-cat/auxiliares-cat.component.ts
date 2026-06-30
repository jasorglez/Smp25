import { Component, effect, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { AuxiliarItemsService } from 'app/services/auxiliar-items.service';
import { alerts } from 'app/helpers/alerts';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-auxiliares-cat',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './auxiliares-cat.component.html',
  styleUrl: './auxiliares-cat.component.scss',
})
export class AuxiliaresCatComponent {
  private trackingService = inject(TrackingService);
  private signalsService       = inject(SignalsService);
  private auxiliarItemsService = inject(AuxiliarItemsService);

  idCompany = 0;

  // ── Master: auxiliar_cuadrilla por empresa ────────────────────────────
  rowData: any[]        = [];
  originalData: any[]   = [];
  selectedRow: any      = null;
  hasMainChanges        = false;
  gridApi!: GridApi;

  // ── Detalle del auxiliar seleccionado ─────────────────────────────────
  activeTab: 'personal' | 'material' | 'herramienta' | 'equipo' = 'personal';

  // Personal
  workerRows: any[]        = [];
  selectedWorker: any      = null;
  hasWorkerChanges         = false;
  workerGridApi!: GridApi;

  // Material / Herr / Equipo  (tablas pendientes en BD — tabs visibles vacías)
  materialRows: any[]     = [];
  herramientaRows: any[]  = [];
  equipoRows: any[]       = [];

  // ── Splitter ──────────────────────────────────────────────────────────
  private readonly SPLIT_KEY = 'auxiliares-cat-split';
  leftWidth                  = +(localStorage.getItem(this.SPLIT_KEY) ?? '460');
  isSplitterDragging         = false;
  private isDragging         = false;
  private dragStartX         = 0;
  private dragStartWidth     = 0;

  onSplitterMouseDown(e: MouseEvent) {
    this.isDragging = true; this.isSplitterDragging = true;
    this.dragStartX = e.clientX; this.dragStartWidth = this.leftWidth;
    e.preventDefault();
  }
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    this.leftWidth = Math.max(220, Math.min(900, this.dragStartWidth + (e.clientX - this.dragStartX)));
  }
  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.isDragging) localStorage.setItem(this.SPLIT_KEY, String(this.leftWidth));
    this.isDragging = false; this.isSplitterDragging = false;
  }

  readonly rowClassRules = { 'new-row-highlight': (p: any) => !!p.data?.__isNew };

  // ── ColDefs izquierda (auxiliar_cuadrilla) ────────────────────────────
  readonly colDefs: ColDef[] = [
    { field: 'name',     headerName: 'Nombre del Auxiliar', flex: 1, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {} },
    { field: 'cantidad', headerName: 'Cant.', width: 85, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
  ];

  readonly gridOptions = {
    defaultColDef: {
      resizable: true, sortable: true, minWidth: 60,
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  // ── ColDefs workers (auxiliar_cuadrilla_item) ─────────────────────────
  readonly workerColDefs: ColDef[] = [
    { field: 'description', headerName: 'Personal / Categoría', flex: 2, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {} },
    { field: 'unit',     headerName: 'Unidad',      width: 90,  editable: true },
    { field: 'quantity', headerName: 'Cantidad',    width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
    { field: 'unitCost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
    { headerName: 'Total', width: 120, editable: false, type: 'numericColumn',
      valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
      valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { fontWeight: '600', color: '#2e7d32' } },
  ];

  // ── ColDefs items genéricos (material / herr / equipo) ────────────────
  readonly itemColDefs: ColDef[] = [
    { field: 'description', headerName: 'Descripción', flex: 2, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {} },
    { field: 'unit',     headerName: 'Unidad',      width: 90,  editable: true },
    { field: 'quantity', headerName: 'Cantidad',    width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
    { field: 'unitCost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
    { headerName: 'Total', width: 120, editable: false, type: 'numericColumn',
      valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
      valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { fontWeight: '600', color: '#0e4491' } },
  ];

  // ── Totales ────────────────────────────────────────────────────────────
  get totalPersonal(): number {
    return this.workerRows.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
  }
  get materialTotal(): number    { return this.materialRows.reduce((s, i)    => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0); }
  get herramientaTotal(): number { return this.herramientaRows.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0); }
  get equipoTotal(): number      { return this.equipoRows.reduce((s, i)      => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0); }
  get costoTotal(): number       { return this.totalPersonal + this.materialTotal + this.herramientaTotal + this.equipoTotal; }

  // ── Init ──────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadData();
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.auxiliarItemsService.getCatalogByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.rowData      = data;
        this.originalData = JSON.parse(JSON.stringify(data));
        this.hasMainChanges = false;
      },
      error: (e) => console.error('Error cargando auxiliares', e),
    });
  }

  loadWorkers(idCuadrilla: number) {
    this.auxiliarItemsService.getCatalogItems(idCuadrilla).subscribe({
      next: (data) => {
        this.workerRows       = data.map((i: any) => ({ ...i, unitCost: i.unitCost ?? i.unit_cost ?? 0, __isNew: false, __modified: false }));
        this.hasWorkerChanges = false;
        this.workerGridApi?.setGridOption('rowData', this.workerRows);
      },
    });
  }

  clearDetail() {
    this.workerRows = []; this.materialRows = []; this.herramientaRows = []; this.equipoRows = [];
    this.hasWorkerChanges = false; this.selectedWorker = null;
    this.workerGridApi?.setGridOption('rowData', []);
  }

  // ── Grid events master ────────────────────────────────────────────────
  onGridReady(e: GridReadyEvent)       { this.gridApi = e.api; }
  onWorkerGridReady(e: GridReadyEvent) { this.workerGridApi = e.api; }

  onSelectionChanged() {
    const rows = this.gridApi.getSelectedRows();
    this.selectedRow = rows.length ? rows[0] : null;
    this.selectedRow?.id && !String(this.selectedRow.id).startsWith('temp_')
      ? this.loadWorkers(this.selectedRow.id)
      : this.clearDetail();
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasMainChanges = true;
  }

  // ── Grid events workers ───────────────────────────────────────────────
  onWorkerSelectionChanged() {
    const r = this.workerGridApi?.getSelectedRows();
    this.selectedWorker = r?.length ? r[0] : null;
  }
  onWorkerValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasWorkerChanges = true;
  }

  // ── Master CRUD ───────────────────────────────────────────────────────
  private tempId = 0;

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo auxiliares cat', 'Proyectos', this.trackingService.getEmail());
    const row = { id: `temp_${++this.tempId}`, idCompany: this.idCompany, idAuxiliar: null, name: '', cantidad: 1, sortOrder: this.rowData.length + 1, active: true, __isNew: true };
    this.rowData = [row, ...this.rowData];
    this.hasMainChanges = true;
    setTimeout(() => {
      this.gridApi?.getDisplayedRowAtIndex(0)?.setSelected(true, true);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'name' });
    }, 100);
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en auxiliares cat', 'Proyectos', this.trackingService.getEmail());
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;
    try {
      for (const row of toSave) {
        const payload = { ...row };
        delete payload.__isNew; delete payload.__modified;
        if (typeof payload.id === 'string') delete payload.id;
        if (row.__isNew) {
          const saved = await this.auxiliarItemsService.saveCuadrilla(payload).toPromise();
          row.id = saved.id; row.__isNew = false;
        } else {
          await this.auxiliarItemsService.updateCuadrilla(row.id, payload).toPromise();
          row.__modified = false;
        }
      }
      this.hasMainChanges = false;
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.gridApi?.refreshCells({ force: true });
      alerts.basicAlert('Guardado', `${toSave.length} auxiliar(es) guardados`, 'success');
    } catch { alerts.basicAlert('Error', 'No se pudo guardar', 'error'); }
  }

  revertChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en auxiliares cat', 'Proyectos', this.trackingService.getEmail());
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasMainChanges = false; this.selectedRow = null; this.clearDetail();
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `"${this.selectedRow.name}"`, 'warning', 'Sí, eliminar');
    if (!r.isConfirmed) return;
    if (typeof this.selectedRow.id === 'number') {
      try { await this.auxiliarItemsService.deleteCuadrilla(this.selectedRow.id).toPromise(); }
      catch { alerts.basicAlert('Error', 'No se pudo eliminar', 'error'); return; }
    }
    this.rowData = this.rowData.filter((x) => x !== this.selectedRow);
    this.selectedRow = null; this.clearDetail();
  }

  // ── Workers CRUD ──────────────────────────────────────────────────────
  addWorker() {
    if (!this.selectedRow) return;
    const item = { id: null, idCuadrilla: this.selectedRow.id, description: '', unit: 'JORNADA', quantity: 1, unitCost: 0, active: true, __isNew: true };
    this.workerRows = [item, ...this.workerRows];
    this.hasWorkerChanges = true;
    this.workerGridApi?.setGridOption('rowData', this.workerRows);
    setTimeout(() => this.workerGridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  async deleteWorker() {
    if (!this.selectedWorker) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `"${this.selectedWorker.description}"`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedWorker.id) await this.auxiliarItemsService.deleteCuadrillaItem(this.selectedWorker.id).toPromise();
    this.workerRows = this.workerRows.filter((x) => x !== this.selectedWorker);
    this.selectedWorker = null;
    this.workerGridApi?.setGridOption('rowData', this.workerRows);
  }

  async saveWorkers() {
    if (!this.selectedRow) return;
    const toSave = this.workerRows.filter((i) => i.__isNew || i.__modified);
    if (!toSave.length) return;
    try {
      for (const item of toSave) {
        const payload = { idCuadrilla: this.selectedRow.id, description: item.description?.trim() ?? '', unit: item.unit ?? 'JORNADA', quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0, active: true };
        if (item.__isNew) { const s = await this.auxiliarItemsService.saveCuadrillaItem(payload).toPromise(); item.id = s.id; item.__isNew = false; }
        else              { await this.auxiliarItemsService.updateCuadrillaItem(item.id, payload).toPromise(); item.__modified = false; }
      }
      this.hasWorkerChanges = false;
      alerts.basicAlert('Guardado', 'Personal guardado', 'success');
    } catch { alerts.basicAlert('Error', 'Error al guardar personal', 'error'); }
  }
}
