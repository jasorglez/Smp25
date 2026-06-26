import { Component, effect, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { AuxiliarService } from 'app/services/auxiliar.service';
import { AuxiliarItemsService } from 'app/services/auxiliar-items.service';
import { MaterialsService } from 'app/services/materials.service';
import { EquipmentService } from 'app/services/equipment.service';
import { HerramientaService } from 'app/services/herramienta.service';
import { PosicionesService } from 'app/services/posiciones.service';
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
  private materialService      = inject(MaterialsService);
  private equipService         = inject(EquipmentService);
  private herramientaService   = inject(HerramientaService);
  private posService           = inject(PosicionesService);

  // ── Master ──────────────────────────────────────────────────────────────
  rowData: any[]        = [];
  originalData: any[]   = [];
  selectedAuxiliar: any = null;
  hasMainChanges        = false;
  gridApi!: GridApi;
  idCompany             = 0;
  private tempCounter   = 0;

  // ── Catalogs ─────────────────────────────────────────────────────────────
  catalogMaterial:    any[] = [];
  catalogEquipo:      any[] = [];
  catalogHerramienta: any[] = [];
  catalogPersonal:    any[] = [];

  // ── Sub-items ────────────────────────────────────────────────────────────
  allItems: any[]             = [];
  hasItemChanges              = false;
  selectedMaterialRow: any    = null;
  selectedHerramientaRow: any = null;
  selectedEquipoRow: any      = null;
  private materialGridApi!: GridApi;
  private herramientaGridApi!: GridApi;
  private equipoGridApi!: GridApi;

  // ── Cuadrillas ───────────────────────────────────────────────────────────
  cuadrillas: any[]          = [];
  selectedCuadrilla: any     = null;
  cuadrillaItemRows: any[]   = [];
  hasCuadrillaChanges        = false;
  selectedCuadrillaItem: any = null;
  private cuadrillaGridApi!: GridApi;

  // ── UI state ─────────────────────────────────────────────────────────────
  activeTab: 'personal' | 'material' | 'herramienta' | 'equipo' = 'personal';
  private enterPressed      = false;

  // ── Resizable splitter ────────────────────────────────────────────────────
  private readonly SPLIT_KEY   = 'auxiliares-cat-split';
  leftWidth                    = +(localStorage.getItem(this.SPLIT_KEY) ?? '460');
  isSplitterDragging           = false;
  private isDragging           = false;
  private dragStartX           = 0;
  private dragStartWidth       = 0;

  onSplitterMouseDown(e: MouseEvent) {
    this.isDragging         = true;
    this.isSplitterDragging = true;
    this.dragStartX         = e.clientX;
    this.dragStartWidth     = this.leftWidth;
    e.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const delta    = e.clientX - this.dragStartX;
    this.leftWidth = Math.max(220, Math.min(900, this.dragStartWidth + delta));
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.isDragging) localStorage.setItem(this.SPLIT_KEY, String(this.leftWidth));
    this.isDragging         = false;
    this.isSplitterDragging = false;
  }

  readonly rowClassRules = { 'new-row-highlight': (p: any) => !!p.data?.__isNew };

  // ── Master ColDefs ────────────────────────────────────────────────────────
  readonly colDefs: ColDef[] = [
    {
      headerName: '#', width: 45, editable: false,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { textAlign: 'center', color: '#888' },
    },
    {
      field: 'description', headerName: 'Descripción', flex: 1, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
    },
    { field: 'unit', headerName: 'Unidad', width: 90, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: ['M2', 'M3', 'ML', 'PZA', 'KG', 'TON', 'HR', 'DIA', 'JORNADA', 'JGO', 'GLB'] }),
    },
    {
      field: 'costMN', headerName: 'Costo', width: 110, editable: false, type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueFormatter: (p) => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00',
    },
  ];

  readonly gridOptions = {
    defaultColDef: {
      resizable: true, sortable: true, minWidth: 60,
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  // ── Sub-grid ColDefs ──────────────────────────────────────────────────────
  getItemColDefs(type: 'MATERIAL' | 'EQUIPO'): ColDef[] {
    const catalog = type === 'MATERIAL' ? this.catalogMaterial : this.catalogEquipo;
    return [
      { headerName: '#', width: 40, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
      {
        field: 'description', headerName: type === 'MATERIAL' ? 'Material' : 'Equipo', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: catalog.map((i) => i.description) }),
        valueSetter: (p: any) => {
          const item = catalog.find((i) => i.description === p.newValue);
          if (item) { p.data.idReference = item.id; p.data.unit = item.unit ?? ''; p.data.unitCost = item.cost ?? 0; }
          p.data.description = p.newValue; return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 80, editable: true },
      { field: 'quantity', headerName: 'Cant.', width: 90, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
      { field: 'unitCost', headerName: 'P.Unit.', width: 105, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
      {
        headerName: 'Total', width: 115, editable: false, type: 'numericColumn',
        valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
    ];
  }

  get herramientaItemColDefs(): ColDef[] {
    return [
      { headerName: '#', width: 40, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
      {
        field: 'description', headerName: 'Herramienta', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.catalogHerramienta.map((h) => h.description) }),
        valueSetter: (p: any) => {
          const item = this.catalogHerramienta.find((h) => h.description === p.newValue);
          if (item) { p.data.idReference = item.id; p.data.unit = '(%)mo'; }
          p.data.description = p.newValue; return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'quantity', headerName: '% MO', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? (Number(p.value) * 100).toFixed(2) + '%' : '' },
      { headerName: 'Base MO', width: 110, editable: false, type: 'numericColumn',
        valueGetter: () => this.totalPersonal,
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { color: '#666' } },
      {
        headerName: 'Total', width: 115, editable: false, type: 'numericColumn',
        valueGetter: (p) => (Number(p.data?.quantity) || 0) * this.totalPersonal,
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
    ];
  }

  get cuadrillaItemColDefs(): ColDef[] {
    return [
      { headerName: '#', width: 40, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
      {
        field: 'description', headerName: 'Trabajador', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.catalogPersonal.map((i) => i.description) }),
        valueSetter: (p: any) => {
          const item = this.catalogPersonal.find((i) => i.description === p.newValue);
          if (item) { p.data.idReference = item.id; p.data.unit = 'JORNADA'; p.data.unitCost = item.cost ?? 0; }
          p.data.description = p.newValue; return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 80, editable: true },
      { field: 'quantity', headerName: 'Cant.', width: 90, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
      { field: 'unitCost', headerName: 'Costo', width: 105, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
      {
        headerName: 'Total', width: 115, editable: false, type: 'numericColumn',
        valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
    ];
  }

  // ── Computed totals ───────────────────────────────────────────────────────
  get materialItems():    any[] { return this.allItems.filter((i) => i.type === 'MATERIAL'); }
  get herramientaItems(): any[] { return this.allItems.filter((i) => i.type === 'HERR'); }
  get equipoItems():      any[] { return this.allItems.filter((i) => i.type === 'EQUIPO'); }

  getCuadrillaSubtotal(c: any): number {
    return (c.items ?? []).reduce((sum: number, i: any) => {
      return sum + (Number(i.quantity ?? 0) || 0) * (Number(i.unitCost ?? i.unit_cost ?? 0) || 0);
    }, 0);
  }

  get totalPersonal():    number { return this.cuadrillas.reduce((s, c) => s + this.getCuadrillaSubtotal(c) * (Number(c.cantidad) || 1), 0); }
  get materialTotal():    number { return this.materialItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost ?? i.unit_cost) || 0), 0); }
  get herramientaTotal(): number { return this.herramientaItems.reduce((s, i) => s + (Number(i.quantity) || 0) * this.totalPersonal, 0); }
  get equipoTotal():      number { return this.equipoItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost ?? i.unit_cost) || 0), 0); }
  get costoTotal():       number { return this.totalPersonal + this.materialTotal + this.herramientaTotal + this.equipoTotal; }
  get hasDetailChanges(): boolean { return this.hasItemChanges || this.hasCuadrillaChanges; }

  // ── Init ──────────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadData();
      this.loadCatalogs();
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  loadData() {
    if (!this.idCompany) return;
    this.auxiliarService.getByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.rowData        = data;
        this.originalData   = JSON.parse(JSON.stringify(data));
        this.hasMainChanges = false;
        this.selectedAuxiliar = null;
        this.clearDetail();
      },
      error: (e) => console.error('Error cargando auxiliares', e),
    });
  }

  loadCatalogs() {
    if (!this.idCompany) return;
    this.materialService.getMaterialsForApu(this.idCompany).subscribe({
      next: (d) => this.catalogMaterial = d.map((i) => ({ id: i.id, description: i.description ?? '', unit: i.measure ?? '', cost: i.costoMN ?? 0 })),
    });
    this.equipService.getEquipment(this.idCompany).subscribe({
      next: (d: any[]) => this.catalogEquipo = d.map((i) => ({ id: i.Id ?? i.id, description: i.description ?? '', unit: i.measure ?? 'HR', cost: i.costMN ?? 0 })),
    });
    this.herramientaService.getByCompany(this.idCompany).subscribe({
      next: (d) => this.catalogHerramienta = d.map((i) => ({ id: i.Id ?? i.id, description: i.description ?? '', unit: i.unit ?? 'HR', cost: i.costMN ?? 0 })),
    });
    this.posService.getPositionsByCompany(this.idCompany).subscribe({
      next: (d: any[]) => this.catalogPersonal = d.filter((i) => i.active !== false).map((i) => ({ id: i.Id ?? i.id, description: i.description, unit: 'JORNADA', cost: 0 })),
    });
  }

  loadDetalle(idAuxiliar: number) {
    this.clearDetail();
    this.auxiliarItemsService.getDetalle(idAuxiliar).subscribe({
      next: (data) => {
        this.allItems = (data.items ?? []).map((i: any) => ({
          ...i, unitCost: i.unitCost ?? i.unit_cost ?? 0, __isNew: false, __modified: false,
        }));
        this.cuadrillas = (data.cuadrillas ?? []).map((c: any) => ({
          ...c,
          items: (c.items ?? []).map((i: any) => ({ ...i, unitCost: i.unitCost ?? i.unit_cost ?? 0, __isNew: false, __modified: false })),
          __isNew: false, __modified: false,
        }));
        if (this.cuadrillas.length) this.selectCuadrilla(this.cuadrillas[0]);
        this.refreshSubGrids();
        if (this.selectedAuxiliar) {
          if (this.selectedAuxiliar.hasPersonal)         this.activeTab = 'personal';
          else if (this.selectedAuxiliar.hasMaterial)    this.activeTab = 'material';
          else if (this.selectedAuxiliar.hasHerramienta) this.activeTab = 'herramienta';
          else if (this.selectedAuxiliar.hasEquipo)      this.activeTab = 'equipo';
        }
      },
    });
  }

  clearDetail() {
    this.allItems = []; this.cuadrillas = [];
    this.selectedCuadrilla = null; this.cuadrillaItemRows = [];
    this.hasItemChanges = false; this.hasCuadrillaChanges = false;
  }

  // ── Master grid events ────────────────────────────────────────────────────
  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  onSelectionChanged() {
    const rows = this.gridApi.getSelectedRows();
    this.selectedAuxiliar = rows.length ? rows[0] : null;
    if (this.selectedAuxiliar?.id && !String(this.selectedAuxiliar.id).startsWith('temp_')) {
      this.loadDetalle(this.selectedAuxiliar.id);
    } else {
      this.clearDetail();
    }
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasMainChanges = true;
  }

  onCellEditingStopped(_: any) { this.enterPressed = false; }

  onFlagChange() {
    if (this.selectedAuxiliar) { this.selectedAuxiliar.__modified = true; this.hasMainChanges = true; }
  }

  // ── Master CRUD ───────────────────────────────────────────────────────────
  addRow() {
    const newRow = {
      id: `temp_${++this.tempCounter}`,
      idCompany: this.idCompany, idContract: null,
      description: '', unit: 'M2', costMN: 0,
      hasPersonal: false, hasMaterial: false, hasHerramienta: false, hasEquipo: false,
      active: true, __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasMainChanges = true;
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  async saveChanges() {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;
    try {
      for (const row of toSave) {
        const payload = this.cleanRow(row);
        if (row.__isNew) {
          const saved = await this.auxiliarService.add(payload).toPromise();
          row.id = saved.id; row.__isNew = false;
        } else {
          await this.auxiliarService.update(row.id, payload).toPromise();
          row.__modified = false;
        }
      }
      this.hasMainChanges = false;
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.gridApi?.refreshCells({ force: true });
      alerts.basicAlert('Guardado', `${toSave.length} auxiliar(es) guardados`, 'success');
    } catch { alerts.basicAlert('Error', 'No se pudieron guardar', 'error'); }
  }

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasMainChanges = false;
    this.selectedAuxiliar = null;
    this.clearDetail();
  }

  async deleteRow() {
    if (!this.selectedAuxiliar) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar "${this.selectedAuxiliar.description}"?`, 'warning', 'Sí, eliminar');
    if (!r.isConfirmed) return;
    if (typeof this.selectedAuxiliar.id === 'string') {
      this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
      this.selectedAuxiliar = null; return;
    }
    try {
      await this.auxiliarService.delete(this.selectedAuxiliar.id).toPromise();
      this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
      this.selectedAuxiliar = null;
      this.clearDetail();
    } catch { alerts.basicAlert('Error', 'No se pudo eliminar', 'error'); }
  }

  // ── Sub-items CRUD ────────────────────────────────────────────────────────
  addItem(type: 'MATERIAL' | 'HERR' | 'EQUIPO') {
    if (!this.selectedAuxiliar) return;
    const newItem = {
      id: null, idAuxiliar: this.selectedAuxiliar.id, type,
      idReference: null, description: '', unit: type === 'HERR' ? '(%)mo' : '',
      quantity: type === 'HERR' ? 0.03 : 0, unitCost: 0, active: true, __isNew: true, __modified: false,
    };
    this.allItems = [newItem, ...this.allItems];
    this.hasItemChanges = true;
    this.refreshSubGrids();
    setTimeout(() => {
      const api = type === 'MATERIAL' ? this.materialGridApi : type === 'HERR' ? this.herramientaGridApi : this.equipoGridApi;
      api?.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 100);
  }

  onItemValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasItemChanges = true;
  }

  onMaterialSelectionChanged()    { const r = this.materialGridApi?.getSelectedRows(); this.selectedMaterialRow = r?.length ? r[0] : null; }
  onHerramientaSelectionChanged() { const r = this.herramientaGridApi?.getSelectedRows(); this.selectedHerramientaRow = r?.length ? r[0] : null; }
  onEquipoSelectionChanged()      { const r = this.equipoGridApi?.getSelectedRows(); this.selectedEquipoRow = r?.length ? r[0] : null; }

  async deleteItem(item: any) {
    if (!item) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar "${item.description}"?`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (item.id) await this.auxiliarItemsService.deleteItem(item.id).toPromise();
    this.allItems = this.allItems.filter((x) => x !== item);
    this.selectedMaterialRow = null; this.selectedHerramientaRow = null; this.selectedEquipoRow = null;
    this.refreshSubGrids();
  }

  // ── Cuadrillas CRUD ───────────────────────────────────────────────────────
  selectCuadrilla(c: any) {
    this.selectedCuadrilla = c;
    this.cuadrillaItemRows = c?.items ?? [];
    this.cuadrillaGridApi?.setGridOption('rowData', this.cuadrillaItemRows);
  }

  addCuadrilla() {
    const newC = {
      id: null, idAuxiliar: this.selectedAuxiliar?.id, name: 'Cuadrilla',
      cantidad: 1, sort_order: this.cuadrillas.length + 1,
      active: true, items: [], __isNew: true, __modified: false,
    };
    this.cuadrillas = [...this.cuadrillas, newC];
    this.selectCuadrilla(newC);
    this.hasCuadrillaChanges = true;
  }

  onCuadrillaChange(c: any) { if (!c.__isNew) c.__modified = true; this.hasCuadrillaChanges = true; }

  addCuadrillaItem() {
    if (!this.selectedCuadrilla) return;
    const newItem = {
      id: null, idCuadrilla: this.selectedCuadrilla.id,
      idReference: null, description: '', unit: 'JORNADA',
      quantity: 0, unitCost: 0, active: true, __isNew: true, __modified: false,
    };
    this.selectedCuadrilla.items = [newItem, ...this.selectedCuadrilla.items];
    this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
    this.hasCuadrillaChanges = true;
    setTimeout(() => this.cuadrillaGridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  onCuadrillaItemValueChanged(event: any) { if (!event.data.__isNew) event.data.__modified = true; this.hasCuadrillaChanges = true; }
  onCuadrillaItemSelectionChanged() { const r = this.cuadrillaGridApi?.getSelectedRows(); this.selectedCuadrillaItem = r?.length ? r[0] : null; }

  async deleteCuadrilla() {
    if (!this.selectedCuadrilla) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar cuadrilla "${this.selectedCuadrilla.name}"?`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedCuadrilla.id) await this.auxiliarItemsService.deleteCuadrilla(this.selectedCuadrilla.id).toPromise();
    this.cuadrillas = this.cuadrillas.filter((x) => x !== this.selectedCuadrilla);
    this.selectedCuadrilla = this.cuadrillas[0] ?? null;
    if (this.selectedCuadrilla) this.selectCuadrilla(this.selectedCuadrilla);
    else this.cuadrillaItemRows = [];
  }

  async deleteCuadrillaItem() {
    if (!this.selectedCuadrillaItem || !this.selectedCuadrilla) return;
    const item = this.selectedCuadrillaItem;
    if (item.id) await this.auxiliarItemsService.deleteCuadrillaItem(item.id).toPromise();
    this.selectedCuadrilla.items = this.selectedCuadrilla.items.filter((x: any) => x !== item);
    this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
    this.selectedCuadrillaItem = null;
  }

  // ── Save Detail ───────────────────────────────────────────────────────────
  async saveDetalle() {
    if (!this.selectedAuxiliar) return;
    try {
      for (const item of this.allItems.filter((i) => i.__isNew || i.__modified)) {
        const payload = {
          idAuxiliar: this.selectedAuxiliar.id, type: item.type,
          idReference: item.idReference ?? null, description: item.description?.trim() ?? '',
          unit: item.unit ?? null, quantity: Number(item.quantity) || 0,
          unitCost: item.type === 'HERR' ? this.totalPersonal : (Number(item.unitCost) || 0),
          active: true,
        };
        if (item.__isNew) { const saved = await this.auxiliarItemsService.saveItem(payload).toPromise(); item.id = saved.id; item.__isNew = false; }
        else { await this.auxiliarItemsService.updateItem(item.id, payload).toPromise(); item.__modified = false; }
      }
      for (const c of this.cuadrillas) {
        const cPayload = { idAuxiliar: this.selectedAuxiliar.id, name: c.name?.trim() ?? '', cantidad: Number(c.cantidad) || 1, sortOrder: Number(c.sort_order) || 0, active: true };
        if (c.__isNew) { const saved = await this.auxiliarItemsService.saveCuadrilla(cPayload).toPromise(); c.id = saved.id; c.__isNew = false; c.items.forEach((i: any) => i.idCuadrilla = saved.id); }
        else if (c.__modified) { await this.auxiliarItemsService.updateCuadrilla(c.id, cPayload).toPromise(); c.__modified = false; }
        for (const item of (c.items ?? []).filter((i: any) => i.__isNew || i.__modified)) {
          const iPayload = { idCuadrilla: c.id, idReference: item.idReference ?? null, description: item.description?.trim() ?? '', unit: item.unit ?? null, quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0, active: true };
          if (item.__isNew) { const saved = await this.auxiliarItemsService.saveCuadrillaItem(iPayload).toPromise(); item.id = saved.id; item.__isNew = false; }
          else { await this.auxiliarItemsService.updateCuadrillaItem(item.id, iPayload).toPromise(); item.__modified = false; }
        }
      }
      this.selectedAuxiliar.costMN = this.costoTotal;
      await this.auxiliarService.update(this.selectedAuxiliar.id, this.cleanRow(this.selectedAuxiliar)).toPromise();
      this.hasItemChanges = false; this.hasCuadrillaChanges = false;
      this.gridApi?.refreshCells({ force: true });
      alerts.basicAlert('Guardado', 'Costo directo: $' + this.costoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 }), 'success');
    } catch (e: any) { console.error(e); alerts.basicAlert('Error', 'Error al guardar componentes', 'error'); }
  }

  // ── Grid ready ─────────────────────────────────────────────────────────────
  onMaterialGridReady(e: GridReadyEvent)    { this.materialGridApi    = e.api; }
  onHerramientaGridReady(e: GridReadyEvent) { this.herramientaGridApi = e.api; }
  onEquipoGridReady(e: GridReadyEvent)      { this.equipoGridApi      = e.api; }
  onCuadrillaGridReady(e: GridReadyEvent)   { this.cuadrillaGridApi   = e.api; }

  refreshSubGrids() {
    this.materialGridApi?.setGridOption('rowData',    this.materialItems);
    this.herramientaGridApi?.setGridOption('rowData', this.herramientaItems);
    this.equipoGridApi?.setGridOption('rowData',      this.equipoItems);
  }

  private cleanRow(row: any) {
    const clean = { ...row };
    delete clean.__isNew; delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
