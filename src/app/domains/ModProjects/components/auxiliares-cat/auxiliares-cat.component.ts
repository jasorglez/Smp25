import { Component, effect, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { AuxiliarService } from 'app/services/auxiliar.service';
import { AuxiliarItemsService } from 'app/services/auxiliar-items.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-auxiliares-cat',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './auxiliares-cat.component.html',
  styleUrl: './auxiliares-cat.component.scss',
})
export class AuxiliaresCatComponent {
  private signalsService       = inject(SignalsService);
  private auxiliarService      = inject(AuxiliarService);
  private auxiliarItemsService = inject(AuxiliarItemsService);

  // ── Master (izquierda) ──────────────────────────────────────────────────
  rowData: any[]        = [];
  originalData: any[]   = [];
  selectedAuxiliar: any = null;
  hasMainChanges        = false;
  gridApi!: GridApi;
  idCompany             = 0;

  // ── Detail state (derecha) ─────────────────────────────────────────────
  activeTab: 'personal' | 'material' | 'herramienta' | 'equipo' = 'personal';
  hasDetailChanges = false;

  // Personal / Cuadrilla
  cuadrillas: any[]          = [];
  selectedCuadrilla: any     = null;
  cuadrillaItemRows: any[]   = [];
  selectedCuadrillaItem: any = null;
  cuadrillaGridApi!: GridApi;

  // Items por tipo
  materialItemRows: any[]     = [];
  selectedMaterialRow: any    = null;
  herramientaItemRows: any[]  = [];
  selectedHerramientaRow: any = null;
  equipoItemRows: any[]       = [];
  selectedEquipoRow: any      = null;

  materialGridApi!:     GridApi;
  herramientaGridApi!:  GridApi;
  equipoGridApi!:       GridApi;

  // ── Totales ────────────────────────────────────────────────────────────
  get totalPersonal(): number {
    return this.cuadrillas.reduce((s, c) => {
      const sub = c.items?.reduce((ss: number, i: any) =>
        ss + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0) ?? 0;
      return s + sub * (Number(c.cantidad) || 1);
    }, 0);
  }
  get materialTotal(): number    { return this.sumRows(this.materialItemRows); }
  get herramientaTotal(): number { return this.sumRows(this.herramientaItemRows); }
  get equipoTotal(): number      { return this.sumRows(this.equipoItemRows); }
  get costoTotal(): number       { return this.totalPersonal + this.materialTotal + this.herramientaTotal + this.equipoTotal; }
  private sumRows(rows: any[]): number {
    return rows.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
  }
  getCuadrillaSubtotal(c: any): number {
    const sub = (c.items ?? []).reduce((s: number, i: any) =>
      s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
    return sub * (Number(c.cantidad) || 1);
  }

  // ── Resizable splitter ──────────────────────────────────────────────────
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

  // ── ColDefs master ────────────────────────────────────────────────────
  readonly colDefs: ColDef[] = [
    { field: 'clave',       headerName: 'Clave',   width: 90, editable: true },
    { field: 'description', headerName: 'Auxiliar', flex: 1,  editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {} },
    { field: 'unit',        headerName: 'Unidad',  width: 75, editable: true },
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

  // ── ColDefs cuadrilla items (workers) ─────────────────────────────────
  readonly cuadrillaItemColDefs: ColDef[] = [
    { field: 'description', headerName: 'Personal / Categoría', flex: 2, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {} },
    { field: 'unit',     headerName: 'Unidad',   width: 90,  editable: true },
    { field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
    { field: 'unitCost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
    { headerName: 'Total', width: 120, editable: false, type: 'numericColumn',
      valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
      valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { fontWeight: '600', color: '#2e7d32' } },
  ];

  // ── ColDefs material / herramienta / equipo ───────────────────────────
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

  // ── Init ──────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadData();
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.auxiliarService.getCatalog(this.idCompany).subscribe({
      next: (data) => {
        this.rowData      = data;
        this.originalData = JSON.parse(JSON.stringify(data));
        this.hasMainChanges = false;
      },
      error: (e) => console.error('Error cargando catálogo de auxiliares', e),
    });
  }

  loadDetalle(id: number) {
    this.auxiliarItemsService.getDetalle(id).subscribe({
      next: (res: any) => {
        this.cuadrillas       = (res.cuadrillas ?? []).map((c: any) => ({ ...c, __modified: false }));
        this.selectedCuadrilla = this.cuadrillas.length ? this.cuadrillas[0] : null;
        this.cuadrillaItemRows = this.selectedCuadrilla?.items ?? [];

        const items: any[] = res.items ?? [];
        this.materialItemRows    = items.filter((i: any) => i.type === 'MATERIAL').map((i: any) => ({ ...i, __isNew: false, __modified: false }));
        this.herramientaItemRows = items.filter((i: any) => i.type === 'HERR').map((i: any) => ({ ...i, __isNew: false, __modified: false }));
        this.equipoItemRows      = items.filter((i: any) => i.type === 'EQUIPO').map((i: any) => ({ ...i, __isNew: false, __modified: false }));

        this.selectedMaterialRow = null; this.selectedHerramientaRow = null; this.selectedEquipoRow = null;
        this.hasDetailChanges = false;
      },
    });
  }

  clearDetalle() {
    this.cuadrillas = []; this.selectedCuadrilla = null; this.cuadrillaItemRows = [];
    this.materialItemRows = []; this.herramientaItemRows = []; this.equipoItemRows = [];
    this.hasDetailChanges = false;
  }

  // ── Grid events ───────────────────────────────────────────────────────
  onGridReady(e: GridReadyEvent)            { this.gridApi = e.api; }
  onCuadrillaGridReady(e: GridReadyEvent)   { this.cuadrillaGridApi = e.api; }
  onMaterialGridReady(e: GridReadyEvent)    { this.materialGridApi = e.api; }
  onHerramientaGridReady(e: GridReadyEvent) { this.herramientaGridApi = e.api; }
  onEquipoGridReady(e: GridReadyEvent)      { this.equipoGridApi = e.api; }

  onSelectionChanged() {
    const rows = this.gridApi.getSelectedRows();
    this.selectedAuxiliar = rows.length ? rows[0] : null;
    if (this.selectedAuxiliar?.id) {
      this.loadDetalle(this.selectedAuxiliar.id);
    } else {
      this.clearDetalle();
    }
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasMainChanges = true;
  }
  onCellEditingStopped(_: any) {}

  onCuadrillaItemSelectionChanged() {
    const r = this.cuadrillaGridApi?.getSelectedRows();
    this.selectedCuadrillaItem = r?.length ? r[0] : null;
  }
  onCuadrillaItemValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasDetailChanges = true;
  }
  onMaterialSelectionChanged()    { const r = this.materialGridApi?.getSelectedRows();    this.selectedMaterialRow    = r?.length ? r[0] : null; }
  onHerramientaSelectionChanged() { const r = this.herramientaGridApi?.getSelectedRows(); this.selectedHerramientaRow = r?.length ? r[0] : null; }
  onEquipoSelectionChanged()      { const r = this.equipoGridApi?.getSelectedRows();      this.selectedEquipoRow      = r?.length ? r[0] : null; }
  onItemValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasDetailChanges = true;
  }

  // ── Cuadrilla helpers ─────────────────────────────────────────────────
  selectCuadrilla(c: any) {
    this.selectedCuadrilla = c;
    this.cuadrillaItemRows = c.items ?? [];
    this.cuadrillaGridApi?.setGridOption('rowData', this.cuadrillaItemRows);
  }
  onCuadrillaChange(c: any) { c.__modified = true; this.hasDetailChanges = true; }

  addCuadrilla() {
    if (!this.selectedAuxiliar) return;
    const c = { id: null, idAuxiliar: this.selectedAuxiliar.id, name: 'CUADRILLA', cantidad: 1, sortOrder: this.cuadrillas.length + 1, active: true, __isNew: true, items: [] };
    this.cuadrillas = [...this.cuadrillas, c];
    this.selectCuadrilla(c);
    this.hasDetailChanges = true;
  }

  async deleteCuadrilla() {
    if (!this.selectedCuadrilla) return;
    const r = await alerts.confirmAlert('¿Eliminar cuadrilla?', `"${this.selectedCuadrilla.name}"`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedCuadrilla.id) await this.auxiliarItemsService.deleteCuadrilla(this.selectedCuadrilla.id).toPromise();
    this.cuadrillas = this.cuadrillas.filter((x) => x !== this.selectedCuadrilla);
    this.selectedCuadrilla = this.cuadrillas.length ? this.cuadrillas[0] : null;
    this.cuadrillaItemRows = this.selectedCuadrilla?.items ?? [];
  }

  addCuadrillaItem() {
    if (!this.selectedCuadrilla) return;
    const item = { id: null, idCuadrilla: this.selectedCuadrilla.id, description: '', unit: 'JORNADA', quantity: 1, unitCost: 0, active: true, __isNew: true };
    this.cuadrillaItemRows = [item, ...this.cuadrillaItemRows];
    if (!this.selectedCuadrilla.items) this.selectedCuadrilla.items = [];
    this.selectedCuadrilla.items = this.cuadrillaItemRows;
    this.cuadrillaGridApi?.setGridOption('rowData', this.cuadrillaItemRows);
    this.hasDetailChanges = true;
    setTimeout(() => this.cuadrillaGridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  async deleteCuadrillaItem() {
    if (!this.selectedCuadrillaItem) return;
    const r = await alerts.confirmAlert('¿Eliminar trabajador?', `"${this.selectedCuadrillaItem.description}"`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedCuadrillaItem.id) await this.auxiliarItemsService.deleteCuadrillaItem(this.selectedCuadrillaItem.id).toPromise();
    this.cuadrillaItemRows = this.cuadrillaItemRows.filter((x) => x !== this.selectedCuadrillaItem);
    this.selectedCuadrilla.items = this.cuadrillaItemRows;
    this.cuadrillaGridApi?.setGridOption('rowData', this.cuadrillaItemRows);
    this.selectedCuadrillaItem = null;
  }

  // ── Items (Material / Herr / Equipo) ──────────────────────────────────
  addItem(type: 'MATERIAL' | 'HERR' | 'EQUIPO') {
    if (!this.selectedAuxiliar) return;
    const item = { id: null, idAuxiliar: this.selectedAuxiliar.id, type, description: '', unit: 'PZA', quantity: 1, unitCost: 0, active: true, __isNew: true };
    if (type === 'MATERIAL')    { this.materialItemRows    = [item, ...this.materialItemRows];    this.materialGridApi?.setGridOption('rowData',    this.materialItemRows);    setTimeout(() => this.materialGridApi?.startEditingCell({    rowIndex: 0, colKey: 'description' }), 100); }
    if (type === 'HERR')        { this.herramientaItemRows = [item, ...this.herramientaItemRows]; this.herramientaGridApi?.setGridOption('rowData', this.herramientaItemRows); setTimeout(() => this.herramientaGridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100); }
    if (type === 'EQUIPO')      { this.equipoItemRows      = [item, ...this.equipoItemRows];      this.equipoGridApi?.setGridOption('rowData',      this.equipoItemRows);      setTimeout(() => this.equipoGridApi?.startEditingCell({      rowIndex: 0, colKey: 'description' }), 100); }
    this.hasDetailChanges = true;
  }

  async deleteItem(row: any) {
    if (!row) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `"${row.description}"`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (row.id) await this.auxiliarItemsService.deleteItem(row.id).toPromise();
    this.materialItemRows    = this.materialItemRows.filter((x) => x !== row);
    this.herramientaItemRows = this.herramientaItemRows.filter((x) => x !== row);
    this.equipoItemRows      = this.equipoItemRows.filter((x) => x !== row);
    this.materialGridApi?.setGridOption('rowData', this.materialItemRows);
    this.herramientaGridApi?.setGridOption('rowData', this.herramientaItemRows);
    this.equipoGridApi?.setGridOption('rowData', this.equipoItemRows);
  }

  // ── Flag toggles ──────────────────────────────────────────────────────
  onFlagChange() {
    if (!this.selectedAuxiliar) return;
    this.selectedAuxiliar.__modified = true;
    this.hasMainChanges = true;
  }

  // ── Save detalle ──────────────────────────────────────────────────────
  async saveDetalle() {
    if (!this.selectedAuxiliar) return;
    try {
      // Cuadrillas
      for (const c of this.cuadrillas) {
        const payload = { idAuxiliar: this.selectedAuxiliar.id, name: c.name, cantidad: Number(c.cantidad), sortOrder: c.sortOrder ?? 1, active: true };
        if (c.__isNew) { const saved = await this.auxiliarItemsService.saveCuadrilla(payload).toPromise(); c.id = saved.id; c.__isNew = false; }
        else if (c.__modified) { await this.auxiliarItemsService.updateCuadrilla(c.id, payload).toPromise(); c.__modified = false; }
        // Items de cuadrilla
        for (const wi of (c.items ?? [])) {
          const wp = { idCuadrilla: c.id, description: wi.description?.trim() ?? '', unit: wi.unit ?? 'JORNADA', quantity: Number(wi.quantity) || 0, unitCost: Number(wi.unitCost) || 0, active: true };
          if (wi.__isNew) { const s = await this.auxiliarItemsService.saveCuadrillaItem(wp).toPromise(); wi.id = s.id; wi.__isNew = false; }
          else if (wi.__modified) { await this.auxiliarItemsService.updateCuadrillaItem(wi.id, wp).toPromise(); wi.__modified = false; }
        }
      }
      // Items (Material / Herr / Equipo)
      for (const item of [...this.materialItemRows, ...this.herramientaItemRows, ...this.equipoItemRows]) {
        const ip = { idAuxiliar: this.selectedAuxiliar.id, type: item.type, description: item.description?.trim() ?? '', unit: item.unit ?? 'PZA', quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0, active: true };
        if (item.__isNew) { const s = await this.auxiliarItemsService.saveItem(ip).toPromise(); item.id = s.id; item.__isNew = false; }
        else if (item.__modified) { await this.auxiliarItemsService.updateItem(item.id, ip).toPromise(); item.__modified = false; }
      }
      // Actualizar flags en el Auxiliar si cambió
      if (this.selectedAuxiliar.__modified) {
        await this.auxiliarService.update(this.selectedAuxiliar.id, this.selectedAuxiliar).toPromise();
        this.selectedAuxiliar.__modified = false;
        this.hasMainChanges = false;
      }
      this.hasDetailChanges = false;
      alerts.basicAlert('Guardado', 'Detalle guardado correctamente', 'success');
    } catch { alerts.basicAlert('Error', 'No se pudo guardar el detalle', 'error'); }
  }

  // ── Master CRUD ───────────────────────────────────────────────────────
  addRow() {
    const newRow = { id: null, idCompany: this.idCompany, idContract: null, description: '', unit: 'M2', clave: '', hasPersonal: false, hasMaterial: false, hasHerramienta: false, hasEquipo: false, active: true, __isNew: true };
    this.rowData = [newRow, ...this.rowData];
    this.hasMainChanges = true;
    setTimeout(() => {
      this.gridApi?.getDisplayedRowAtIndex(0)?.setSelected(true, true);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 100);
  }

  async saveChanges() {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;
    try {
      for (const row of toSave) {
        const payload = { ...row }; delete payload.__isNew; delete payload.__modified;
        if (row.__isNew) {
          const saved = await this.auxiliarService.add(payload).toPromise();
          row.id = saved.id ?? saved.Id; row.__isNew = false;
        } else {
          await this.auxiliarService.update(row.id, payload).toPromise();
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
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasMainChanges = false;
    this.selectedAuxiliar = null;
    this.clearDetalle();
  }

  async deleteRow() {
    if (!this.selectedAuxiliar) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `"${this.selectedAuxiliar.description}"`, 'warning', 'Sí, eliminar');
    if (!r.isConfirmed) return;
    if (this.selectedAuxiliar.id) {
      try { await this.auxiliarService.delete(this.selectedAuxiliar.id).toPromise(); }
      catch { alerts.basicAlert('Error', 'No se pudo eliminar', 'error'); return; }
    }
    this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
    this.selectedAuxiliar = null; this.clearDetalle();
  }
}
