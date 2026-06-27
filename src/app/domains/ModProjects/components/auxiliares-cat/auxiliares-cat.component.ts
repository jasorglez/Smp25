import { Component, effect, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { AuxiliarItemsService } from 'app/services/auxiliar-items.service';
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
  private auxiliarItemsService = inject(AuxiliarItemsService);
  private posService           = inject(PosicionesService);

  // ── Master ──────────────────────────────────────────────────────────────
  rowData: any[]        = [];
  originalData: any[]   = [];
  selectedAuxiliar: any = null;
  hasMainChanges        = false;
  gridApi!: GridApi;
  idCompany             = 0;
  private tempCounter   = 0;

  // ── Catálogo personal ─────────────────────────────────────────────────
  catalogPersonal: any[] = [];

  // ── Items del Auxiliar seleccionado ──────────────────────────────────
  itemRows: any[]            = [];
  hasItemChanges             = false;
  selectedItem: any          = null;
  private itemGridApi!: GridApi;

  // ── UI ────────────────────────────────────────────────────────────────
  private enterPressed = false;

  // ── Resizable splitter ────────────────────────────────────────────────
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

  // ── ColDefs master (Auxiliares catálogo) ──────────────────────────────
  readonly colDefs: ColDef[] = [
    { headerName: '#', width: 45, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1, cellStyle: { textAlign: 'center', color: '#888' } },
    { field: 'name', headerName: 'Nombre del Auxiliar', flex: 1, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {} },
    { field: 'cantidad', headerName: 'Cant.', width: 80, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
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

  // ── ColDefs items del Auxiliar (personal) ────────────────────────────
  readonly itemColDefs: ColDef[] = [
    { headerName: '#', width: 40, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
    { field: 'description', headerName: 'Trabajador / Categoría', flex: 2, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.catalogPersonal.map((i) => i.description) }),
      valueSetter: (p: any) => {
        const item = this.catalogPersonal.find((i) => i.description === p.newValue);
        if (item) { p.data.idReference = item.id; p.data.unitCost = item.cost ?? 0; }
        p.data.description = p.newValue; return true;
      },
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
    },
    { field: 'unit', headerName: 'Unidad', width: 90, editable: true },
    { field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
    { field: 'unitCost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
    { headerName: 'Total', width: 120, editable: false, type: 'numericColumn',
      valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
      valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { fontWeight: '600', color: '#0e4491' } },
  ];

  get subtotal(): number {
    return this.itemRows.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);
  }

  // ── Init ──────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadData();
      this.loadCatalogs();
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.auxiliarItemsService.getCatalogByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.rowData      = data;
        this.originalData = JSON.parse(JSON.stringify(data));
        this.hasMainChanges = false;
        if (this.selectedAuxiliar) {
          const still = data.find((r: any) => r.id === this.selectedAuxiliar.id);
          if (!still) { this.selectedAuxiliar = null; this.clearItems(); }
        }
      },
      error: (e) => console.error('Error cargando auxiliares', e),
    });
  }

  loadCatalogs() {
    if (!this.idCompany) return;
    this.posService.getPositionsByCompany(this.idCompany).subscribe({
      next: (d: any[]) => this.catalogPersonal = d
        .filter((i) => i.active !== false)
        .map((i) => ({ id: i.Id ?? i.id, description: i.description, unit: 'JORNADA', cost: 0 })),
    });
  }

  loadItems(idCuadrilla: number) {
    this.auxiliarItemsService.getCatalogItems(idCuadrilla).subscribe({
      next: (data) => {
        this.itemRows = data.map((i: any) => ({
          ...i, unitCost: i.unitCost ?? i.unit_cost ?? 0, __isNew: false, __modified: false,
        }));
        this.itemGridApi?.setGridOption('rowData', this.itemRows);
        this.hasItemChanges = false;
      },
    });
  }

  clearItems() {
    this.itemRows = []; this.hasItemChanges = false; this.selectedItem = null;
    this.itemGridApi?.setGridOption('rowData', []);
  }

  // ── Grid events ───────────────────────────────────────────────────────
  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }
  onItemGridReady(e: GridReadyEvent) { this.itemGridApi = e.api; }

  onSelectionChanged() {
    const rows = this.gridApi.getSelectedRows();
    this.selectedAuxiliar = rows.length ? rows[0] : null;
    if (this.selectedAuxiliar?.id && !String(this.selectedAuxiliar.id).startsWith('temp_')) {
      this.loadItems(this.selectedAuxiliar.id);
    } else {
      this.clearItems();
    }
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasMainChanges = true;
  }
  onCellEditingStopped(_: any) { this.enterPressed = false; }

  onItemValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasItemChanges = true;
  }
  onItemSelectionChanged() {
    const r = this.itemGridApi?.getSelectedRows();
    this.selectedItem = r?.length ? r[0] : null;
  }

  // ── Master CRUD ───────────────────────────────────────────────────────
  addRow() {
    const newRow = {
      id: `temp_${++this.tempCounter}`, idCompany: this.idCompany, idAuxiliar: null,
      name: '', cantidad: 1, sortOrder: this.rowData.length + 1,
      active: true, __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasMainChanges = true;
    setTimeout(() => {
      this.gridApi?.getDisplayedRowAtIndex(0)?.setSelected(true, true);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'name' });
    }, 100);
  }

  async saveChanges() {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;
    try {
      for (const row of toSave) {
        const payload = this.cleanRow(row);
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
    } catch { alerts.basicAlert('Error', 'No se pudieron guardar', 'error'); }
  }

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasMainChanges = false;
    this.selectedAuxiliar = null;
    this.clearItems();
  }

  async deleteRow() {
    if (!this.selectedAuxiliar) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar "${this.selectedAuxiliar.name}"?`, 'warning', 'Sí, eliminar');
    if (!r.isConfirmed) return;
    if (typeof this.selectedAuxiliar.id === 'string') {
      this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
      this.selectedAuxiliar = null; return;
    }
    try {
      await this.auxiliarItemsService.deleteCuadrilla(this.selectedAuxiliar.id).toPromise();
      this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
      this.selectedAuxiliar = null; this.clearItems();
    } catch { alerts.basicAlert('Error', 'No se pudo eliminar', 'error'); }
  }

  // ── Items CRUD ────────────────────────────────────────────────────────
  addItem() {
    if (!this.selectedAuxiliar) return;
    const newItem = {
      id: null, idCuadrilla: this.selectedAuxiliar.id,
      idReference: null, description: '', unit: 'JORNADA',
      quantity: 1, unitCost: 0, active: true, __isNew: true, __modified: false,
    };
    this.itemRows = [newItem, ...this.itemRows];
    this.hasItemChanges = true;
    this.itemGridApi?.setGridOption('rowData', this.itemRows);
    setTimeout(() => this.itemGridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  async deleteItem() {
    if (!this.selectedItem) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar "${this.selectedItem.description}"?`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedItem.id) await this.auxiliarItemsService.deleteCuadrillaItem(this.selectedItem.id).toPromise();
    this.itemRows = this.itemRows.filter((x) => x !== this.selectedItem);
    this.selectedItem = null;
    this.itemGridApi?.setGridOption('rowData', this.itemRows);
  }

  async saveItems() {
    if (!this.selectedAuxiliar) return;
    const toSave = this.itemRows.filter((i) => i.__isNew || i.__modified);
    if (!toSave.length) return;
    try {
      for (const item of toSave) {
        const payload = {
          idCuadrilla: this.selectedAuxiliar.id, idReference: item.idReference ?? null,
          description: item.description?.trim() ?? '', unit: item.unit ?? 'JORNADA',
          quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0, active: true,
        };
        if (item.__isNew) {
          const saved = await this.auxiliarItemsService.saveCuadrillaItem(payload).toPromise();
          item.id = saved.id; item.__isNew = false;
        } else {
          await this.auxiliarItemsService.updateCuadrillaItem(item.id, payload).toPromise();
          item.__modified = false;
        }
      }
      this.hasItemChanges = false;
      alerts.basicAlert('Guardado', 'Items guardados', 'success');
    } catch { alerts.basicAlert('Error', 'Error al guardar items', 'error'); }
  }

  get hasDetailChanges(): boolean { return this.hasItemChanges; }

  private cleanRow(row: any) {
    const clean = { ...row };
    delete clean.__isNew; delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
