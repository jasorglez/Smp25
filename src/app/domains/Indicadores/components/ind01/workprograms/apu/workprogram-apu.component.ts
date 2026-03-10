import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi } from 'ag-grid-enterprise';
import { WorkprogramApuService } from 'app/services/workprogram-apu.service';
import { WorkprogramApuFactorService } from 'app/services/workprogram-apu-factor.service';
import { WorkprogramApuCuadrillaService } from 'app/services/workprogram-apu-cuadrilla.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { EquipmentService } from 'app/services/equipment.service';
import { MaterialsService } from 'app/services/materials.service';
import { HerramientaService } from 'app/services/herramienta.service';
import { AuxiliarService } from 'app/services/auxiliar.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-workprogram-apu',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './workprogram-apu.component.html',
})
export class WorkprogramApuComponent implements OnChanges {
  @Input() visible = false;
  @Input() idWorkprogram: number | null = null;
  @Input() idContract: number | null = null;
  @Input() taskName = '';
  @Output() closed = new EventEmitter<void>();
  @Output() costUpdated = new EventEmitter<number>();

  private apuService          = inject(WorkprogramApuService);
  private factorService       = inject(WorkprogramApuFactorService);
  private cuadrillaService    = inject(WorkprogramApuCuadrillaService);
  private posService          = inject(PosicionesService);
  private equipService        = inject(EquipmentService);
  private materialService     = inject(MaterialsService);
  private herramientaService  = inject(HerramientaService);
  private auxiliarService     = inject(AuxiliarService);
  private signalsService      = inject(SignalsService);

  // ── Estado APU items (MATERIAL / EQUIPO) ─────────────────────────────
  gridApi!: GridApi;
  rowData: any[] = [];
  displayRows: any[] = [];
  activeType = 'PERSONAL';
  hasChanges = false;
  selectedRow: any = null;
  appliedTotal = 0;

  // ── Estado Cuadrillas (PERSONAL) ─────────────────────────────────────
  cuadrillas: any[] = [];
  selectedCuadrilla: any = null;
  cuadrillaItemRows: any[] = [];
  cuadrillaHasChanges = false;
  selectedCuadrillaItem: any = null;
  cuadrillaGridApi!: GridApi;
  private _cuadrillaItemColDefs: ColDef[] = [];

  // ── Estado Factores ───────────────────────────────────────────────────
  factors: any[] = [];
  factorHasChanges = false;
  selectedFactor: any = null;

  // ── Catálogos normalizados ────────────────────────────────────────────
  catalogPersonal:    any[] = [];
  catalogEquipo:      any[] = [];
  catalogMaterial:    any[] = [];
  catalogHerramienta: any[] = [];
  catalogAuxiliar:    any[] = [];

  private _colDefs: ColDef[] = [];
  private _herramientaColDefs: ColDef[] = [];
  private _auxColDefs: ColDef[] = [];

  readonly types = [
    { key: 'PERSONAL',  label: 'Personal',    icon: 'bi-people'       },
    { key: 'MATERIAL',  label: 'Material',    icon: 'bi-box-seam'     },
    { key: 'HERR',      label: 'Herramienta', icon: 'bi-tools'        },
    { key: 'EQUIPO',    label: 'Equipo',      icon: 'bi-truck'        },
    { key: 'AUX',       label: 'Auxiliares',  icon: 'bi-layers'       },
    { key: 'FACTORES',  label: 'Factores',    icon: 'bi-percent'      },
  ];

  readonly rowClassRules = {
    'new-row-highlight': (p: any) => !!p.data?.__isNew,
  };

  readonly defaultColDef: ColDef = { resizable: true, sortable: true, minWidth: 80 };

  // ── ColDefs MATERIAL / EQUIPO ─────────────────────────────────────────
  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;
    this._colDefs = [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, editable: false },
      {
        field: 'description', headerName: 'Descripcion', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (p: any) => ({
          values: this.getCatalogByType(p.data?.type ?? this.activeType).map((i) => i.description),
        }),
        valueSetter: (p: any) => {
          const type = p.data?.type ?? this.activeType;
          const item = this.getCatalogByType(type).find((i) => i.description === p.newValue);
          if (item) {
            const duplicate = this.rowData.find(
              (r) => r !== p.data && r.type === type && r.id_reference === item.id
            );
            if (duplicate) {
              alerts.basicAlert('Duplicado', `"${p.newValue}" ya existe en este APU`, 'warning');
              return false;
            }
            p.data.id_reference = item.id;
            if (!p.data.unit_cost || p.data.unit_cost === 0) p.data.unit_cost = item.cost ?? 0;
            if (!p.data.unit) p.data.unit = item.unit ?? '';
          }
          p.data.description = p.newValue;
          return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 90, editable: true },
      {
        field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '',
      },
      {
        field: 'unit_cost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? ('$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })) : '',
      },
      {
        field: 'total', headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (p.data?.quantity ?? 0) * (p.data?.unit_cost ?? 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
      {
        field: 'apply_to_cost', headerName: 'Aplicar', width: 80, editable: false,
        cellRenderer: (p: any) => '<input type="checkbox" ' + (p.value ? 'checked' : '') + ' style="cursor:pointer;width:16px;height:16px;">',
        onCellClicked: (p) => {
          p.data.apply_to_cost = !p.data.apply_to_cost;
          if (!p.data.__isNew) p.data.__modified = true;
          this.hasChanges = true;
          this.recalcAppliedTotal();
          this.gridApi?.refreshCells({ rowNodes: [p.node!] });
        },
      },
    ];
    return this._colDefs;
  }

  // ── ColDefs Herramienta (% de MO) ────────────────────────────────────
  get herramientaColDefs(): ColDef[] {
    if (this._herramientaColDefs.length > 0) return this._herramientaColDefs;
    this._herramientaColDefs = [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, editable: false },
      {
        field: 'description', headerName: 'Herramienta', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.catalogHerramienta.map((h) => h.description),
        }),
        valueSetter: (p: any) => {
          const item = this.catalogHerramienta.find((h) => h.description === p.newValue);
          if (item) {
            p.data.id_reference = item.id;
            if (!p.data.unit) p.data.unit = item.unit ?? '(%)mo';
          }
          p.data.description = p.newValue;
          return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      {
        field: 'quantity', headerName: '% de MO', width: 110, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? (Number(p.value) * 100).toFixed(2) + '%' : '',
      },
      {
        headerName: 'Base MO', width: 130, editable: false, type: 'numericColumn',
        valueGetter: () => this.totalPersonal,
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { color: '#666' },
      },
      {
        headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (p.data?.quantity ?? 0) * this.totalPersonal,
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
      {
        field: 'apply_to_cost', headerName: 'Aplicar', width: 80, editable: false,
        cellRenderer: (p: any) => '<input type="checkbox" ' + (p.value ? 'checked' : '') + ' style="cursor:pointer;width:16px;height:16px;">',
        onCellClicked: (p) => {
          p.data.apply_to_cost = !p.data.apply_to_cost;
          if (!p.data.__isNew) p.data.__modified = true;
          this.hasChanges = true;
          this.recalcAppliedTotal();
          this.gridApi?.refreshCells({ rowNodes: [p.node!] });
        },
      },
    ];
    return this._herramientaColDefs;
  }

  // ── ColDefs Auxiliares (sub-APU, descripción libre) ──────────────────
  get auxColDefs(): ColDef[] {
    if (this._auxColDefs.length > 0) return this._auxColDefs;
    this._auxColDefs = [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, editable: false },
      {
        field: 'description', headerName: 'Sub-APU / Auxiliar', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.catalogAuxiliar.map((a) => a.description),
        }),
        valueSetter: (p: any) => {
          const item = this.catalogAuxiliar.find((a) => a.description === p.newValue);
          if (item) {
            p.data.id_reference = item.id;
            if (!p.data.unit)     p.data.unit      = item.unit ?? 'M2';
            if (!p.data.unit_cost || p.data.unit_cost === 0) p.data.unit_cost = item.cost ?? 0;
          }
          p.data.description = p.newValue;
          return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 90, editable: true },
      {
        field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(5) : '',
      },
      {
        field: 'unit_cost', headerName: 'Precio U.', width: 130, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? ('$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })) : '',
      },
      {
        field: 'total', headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (p.data?.quantity ?? 0) * (p.data?.unit_cost ?? 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
      {
        field: 'apply_to_cost', headerName: 'Aplicar', width: 80, editable: false,
        cellRenderer: (p: any) => '<input type="checkbox" ' + (p.value ? 'checked' : '') + ' style="cursor:pointer;width:16px;height:16px;">',
        onCellClicked: (p) => {
          p.data.apply_to_cost = !p.data.apply_to_cost;
          if (!p.data.__isNew) p.data.__modified = true;
          this.hasChanges = true;
          this.recalcAppliedTotal();
          this.gridApi?.refreshCells({ rowNodes: [p.node!] });
        },
      },
    ];
    return this._auxColDefs;
  }

  // ── ColDefs items de cuadrilla ─────────────────────────────────────────
  get cuadrillaItemColDefs(): ColDef[] {
    if (this._cuadrillaItemColDefs.length > 0) return this._cuadrillaItemColDefs;
    this._cuadrillaItemColDefs = [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, editable: false },
      {
        field: 'description', headerName: 'Descripcion', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.catalogPersonal.map((i) => i.description) }),
        valueSetter: (p: any) => {
          const item = this.catalogPersonal.find((i) => i.description === p.newValue);
          if (item) {
            p.data.id_reference = item.id;
            if (!p.data.unit_cost || p.data.unit_cost === 0) p.data.unit_cost = item.cost ?? 0;
            if (!p.data.unit) p.data.unit = item.unit ?? 'JORNADA';
          }
          p.data.description = p.newValue;
          return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 90, editable: true },
      {
        field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '',
      },
      {
        field: 'unit_cost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? ('$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })) : '',
      },
      {
        field: 'total', headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (p.data?.quantity ?? 0) * (p.data?.unit_cost ?? 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
    ];
    return this._cuadrillaItemColDefs;
  }

  // ── Cálculos ──────────────────────────────────────────────────────────

  getCuadrillaSubtotal(c: any): number {
    return (c.items ?? [])
      .reduce((sum: number, i: any) => {
        const qty  = Number(i.quantity  ?? i.Quantity  ?? 0) || 0;
        const cost = Number(i.unit_cost ?? i.unitCost  ?? i.UnitCost ?? 0) || 0;
        return sum + (qty * cost);
      }, 0);
  }

  getCuadrillaTotal(c: any): number {
    return this.getCuadrillaSubtotal(c) * Number(c.cantidad);
  }

  get totalPersonal(): number {
    return this.cuadrillas.reduce((sum, c) => sum + this.getCuadrillaTotal(c), 0);
  }

  get herramientaTotal(): number {
    return this.rowData
      .filter((r) => r.apply_to_cost && r.type === 'HERR')
      .reduce((sum, r) => sum + (Number(r.quantity) * this.totalPersonal), 0);
  }

  get auxiliaresTotal(): number {
    return this.rowData
      .filter((r) => r.apply_to_cost && r.type === 'AUX')
      .reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unit_cost ?? r.unitCost ?? 0)), 0);
  }

  get costoDirecto(): number {
    return this.appliedTotal;
  }

  get factorBreakdown(): { name: string; pct: number; amount: number; subtotal: number }[] {
    const sorted = [...this.factors].sort((a, b) => a.sort_order - b.sort_order);
    const result: { name: string; pct: number; amount: number; subtotal: number }[] = [];
    let subtotal = this.costoDirecto;
    for (const f of sorted) {
      const amount = subtotal * (Number(f.percentage) / 100);
      subtotal += amount;
      result.push({ name: f.name, pct: Number(f.percentage), amount, subtotal });
    }
    return result;
  }

  get precioUnitario(): number {
    if (this.factors.length === 0) return this.appliedTotal;
    const bd = this.factorBreakdown;
    return bd.length > 0 ? bd[bd.length - 1].subtotal : this.appliedTotal;
  }

  // ── Utilidades ────────────────────────────────────────────────────────

  private refreshDisplayRows(): void {
    this.displayRows = this.rowData.filter((r) => r.type === this.activeType);
    this.gridApi?.setGridOption('rowData', this.displayRows);
  }

  get allApplied(): boolean {
    return this.displayRows.length > 0 && this.displayRows.every((r) => r.apply_to_cost);
  }

  countByType(type: string): number {
    if (type === 'PERSONAL') return this.cuadrillas.length;
    if (type === 'FACTORES') return this.factors.length;
    return this.rowData.filter((r) => r.type === type).length;
  }

  ngOnChanges(): void {
    if (this.visible && this.idWorkprogram) {
      this.loadCatalogs();
      this.loadData();
      this.loadCuadrillas();
      if (this.idContract) this.loadFactors();
    }
  }

  private loadCatalogs(): void {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;

    this.posService.getPositionsByCompany(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogPersonal = data
          .filter((d) => d.active !== false)
          .map((d) => ({ id: d.Id ?? d.id, description: d.description, unit: 'JORNADA', cost: 0 }));
        this.cuadrillaGridApi?.refreshCells();
      },
    });

    this.equipService.getEquipment(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogEquipo = data
          .filter((d) => d.active !== false)
          .map((d) => ({ id: d.Id ?? d.id, description: d.description, unit: d.measure ?? 'HR', cost: d.costMN ?? d.costMX ?? 0 }));
        this.gridApi?.refreshCells();
      },
    });

    this.materialService.getMaterialsForApu(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogMaterial = data
          .map((d) => ({ id: d.id, description: d.description ?? '', unit: d.measure ?? '', cost: d.costoMN ?? 0 }));
        this.gridApi?.refreshCells();
      },
    });

    this.herramientaService.getByCompany(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogHerramienta = data
          .map((d) => ({ id: d.Id ?? d.id, description: d.description ?? '', unit: d.unit ?? 'HR', cost: d.costMN ?? 0 }));
        this.gridApi?.refreshCells();
      },
    });

    this.auxiliarService.getByCompany(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogAuxiliar = data
          .map((d) => ({ id: d.Id ?? d.id, description: d.description ?? '', unit: d.unit ?? 'M2', cost: d.costMN ?? 0 }));
        this.gridApi?.refreshCells();
      },
    });
  }

  getCatalogByType(type: string): any[] {
    if (type === 'EQUIPO')      return this.catalogEquipo;
    if (type === 'HERR') return this.catalogHerramienta;
    return this.catalogMaterial;
  }

  onGridReady(params: any): void { this.gridApi = params.api; }
  onCuadrillaGridReady(params: any): void { this.cuadrillaGridApi = params.api; }

  private loadData(): void {
    this.apuService.getByWorkprogram(this.idWorkprogram!).subscribe({
      next: (data) => {
        this.rowData = data.map((d) => ({ ...d, __isNew: false, __modified: false }));
        this.recalcAppliedTotal();
        this.hasChanges = false;
        this.refreshDisplayRows();
      },
      error: () => alerts.basicAlert('Error', 'No se pudo cargar el APU', 'error'),
    });
  }

  private loadCuadrillas(): void {
    this.cuadrillaService.getByWorkprogram(this.idWorkprogram!).subscribe({
      next: (data) => {
        this.cuadrillas = data.map((c) => ({
          ...c,
          items: (c.items ?? []).map((i: any) => ({ ...i, __isNew: false, __modified: false })),
          __isNew: false,
          __modified: false,
        }));
        if (this.cuadrillas.length > 0) this.selectCuadrilla(this.cuadrillas[0]);
        this.cuadrillaHasChanges = false;
        this.recalcAppliedTotal();
      },
      error: () => alerts.basicAlert('Error', 'No se pudieron cargar las cuadrillas', 'error'),
    });
  }

  private loadFactors(): void {
    this.factorService.getByContract(this.idContract!).subscribe({
      next: (data) => {
        this.factors = data.map((f) => ({ ...f, __isNew: false, __modified: false }));
        this.factorHasChanges = false;
      },
      error: () => alerts.basicAlert('Error', 'No se pudieron cargar los factores APU', 'error'),
    });
  }

  setType(type: string): void {
    this.activeType = type;
    this.selectedRow = null;
    this.selectedFactor = null;
    if (type !== 'PERSONAL' && type !== 'FACTORES') {
      if (type === 'HERR') {
        this._herramientaColDefs = [];
        setTimeout(() => this.gridApi?.setGridOption('columnDefs', this.herramientaColDefs), 0);
      } else if (type === 'AUX') {
        this._auxColDefs = [];
        setTimeout(() => this.gridApi?.setGridOption('columnDefs', this.auxColDefs), 0);
      } else {
        this._colDefs = [];
        setTimeout(() => this.gridApi?.setGridOption('columnDefs', this.colDefs), 0);
      }
      this.refreshDisplayRows();
    }
  }

  // ── APU items CRUD (MATERIAL / EQUIPO) ───────────────────────────────

  addRow(): void {
    const isHerramienta = this.activeType === 'HERR';
    const newRow = {
      id: null, id_workprogram: this.idWorkprogram, type: this.activeType,
      id_reference: null, description: '',
      unit: isHerramienta ? '(%)mo' : '',
      quantity: isHerramienta ? 0.03 : 0,
      unit_cost: isHerramienta ? this.totalPersonal : 0,
      unit_cost_dll: 0,
      apply_to_cost: isHerramienta,
      active: true, __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    this.refreshDisplayRows();
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 50);
  }

  onCellValueChanged(event: any): void {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasChanges = true;
    this.recalcAppliedTotal();
    this.gridApi?.refreshCells({ rowNodes: [event.node] });
  }

  onSelectionChanged(): void {
    const rows = this.gridApi?.getSelectedRows();
    this.selectedRow = rows?.length ? rows[0] : null;
  }

  async saveChanges(): Promise<void> {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) { this.hasChanges = false; return; }
    try {
      for (const row of toSave) {
        const payload = {
          idWorkprogram: this.idWorkprogram, type: row.type,
          idReference: row.id_reference ?? null, description: row.description?.trim() ?? '',
          unit: row.unit?.trim() ?? null, quantity: Number(row.quantity) || 0,
          unitCost: row.type === 'HERR' ? this.totalPersonal : (Number(row.unit_cost) || 0),
          unitCostDll: Number(row.unit_cost_dll) || 0,
          applyToCost: row.apply_to_cost ?? false, active: true,
        };
        if (row.__isNew) {
          const saved = await this.apuService.add(payload).toPromise();
          row.id = saved.id; row.__isNew = false;
        } else {
          await this.apuService.update(row.id, payload).toPromise();
          row.__modified = false;
        }
      }
      this.hasChanges = false;
      this.recalcAppliedTotal();
      this.refreshDisplayRows();
      alerts.basicAlert('Guardado', 'APU guardado correctamente', 'success');
    } catch (e: any) {
      console.error('Error guardando APU:', e);
      alerts.basicAlert('Error', 'Error al guardar el APU: ' + (e?.message ?? ''), 'error');
    }
  }

  revertChanges(): void { this.loadData(); }

  deleteSelected(): void {
    if (!this.selectedRow) return;
    alerts.confirmAlert('Eliminar?', 'Se eliminara este item del APU', 'warning', 'Eliminar').then((r) => {
      if (!r.isConfirmed) return;
      if (this.selectedRow.id) {
        this.apuService.delete(this.selectedRow.id).subscribe({
          next: () => {
            this.rowData = this.rowData.filter((x) => x !== this.selectedRow);
            this.selectedRow = null;
            this.recalcAppliedTotal();
            this.refreshDisplayRows();
          },
          error: () => alerts.basicAlert('Error', 'No se pudo eliminar', 'error'),
        });
      } else {
        this.rowData = this.rowData.filter((x) => x !== this.selectedRow);
        this.selectedRow = null;
        this.refreshDisplayRows();
      }
    });
  }

  toggleApplyAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.displayRows.forEach((r) => {
      r.apply_to_cost = checked;
      if (!r.__isNew) r.__modified = true;
    });
    this.hasChanges = true;
    this.recalcAppliedTotal();
    this.gridApi?.refreshCells();
  }

  private recalcAppliedTotal(): void {
    const flatTotal = this.rowData
      .filter((r) => r.apply_to_cost && r.type !== 'HERR')
      .reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unit_cost)), 0);
    const herramienta = this.rowData
      .filter((r) => r.apply_to_cost && r.type === 'HERR')
      .reduce((sum, r) => sum + (Number(r.quantity) * this.totalPersonal), 0);
    this.appliedTotal = this.totalPersonal + herramienta + flatTotal;
  }

  // ── Cuadrillas CRUD ───────────────────────────────────────────────────

  selectCuadrilla(c: any): void {
    this.selectedCuadrilla = c;
    this.selectedCuadrillaItem = null;
    this.cuadrillaItemRows = c?.items ?? [];
    this.cuadrillaGridApi?.setGridOption('rowData', this.cuadrillaItemRows);
  }

  addCuadrilla(): void {
    const newC = {
      id: null, id_workprogram: this.idWorkprogram,
      name: '', cantidad: 1, sort_order: this.cuadrillas.length + 1,
      active: true, items: [], __isNew: true, __modified: false,
    };
    this.cuadrillas = [...this.cuadrillas, newC];
    this.selectCuadrilla(newC);
    this.cuadrillaHasChanges = true;
  }

  onCuadrillaChange(c: any): void {
    if (!c.__isNew) c.__modified = true;
    this.cuadrillaHasChanges = true;
    this.recalcAppliedTotal();
  }

  addCuadrillaItem(): void {
    if (!this.selectedCuadrilla) return;
    const newItem = {
      id: null, id_cuadrilla: this.selectedCuadrilla.id,
      id_reference: null, description: '', unit: 'JORNADA',
      quantity: 0, unit_cost: 0, active: true,
      __isNew: true, __modified: false,
    };
    this.selectedCuadrilla.items = [newItem, ...this.selectedCuadrilla.items];
    this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
    this.cuadrillaGridApi?.setGridOption('rowData', this.cuadrillaItemRows);
    this.cuadrillaHasChanges = true;
    setTimeout(() => this.cuadrillaGridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 50);
  }

  onCuadrillaItemValueChanged(event: any): void {
    if (!event.data.__isNew) event.data.__modified = true;
    this.cuadrillaHasChanges = true;
    this.recalcAppliedTotal();
    this.cuadrillaGridApi?.refreshCells({ rowNodes: [event.node] });
  }

  onCuadrillaItemSelectionChanged(): void {
    const rows = this.cuadrillaGridApi?.getSelectedRows();
    this.selectedCuadrillaItem = rows?.length ? rows[0] : null;
  }

  async saveCuadrillas(): Promise<void> {
    try {
      for (const c of this.cuadrillas) {
        const cPayload = {
          idWorkprogram: this.idWorkprogram,
          name: c.name?.trim() ?? '',
          cantidad: Number(c.cantidad) || 1,
          sortOrder: Number(c.sort_order) || 0,
          active: true,
        };
        if (c.__isNew) {
          const saved = await this.cuadrillaService.saveCuadrilla(cPayload).toPromise();
          c.id = saved.id;
          c.__isNew = false;
          c.items.forEach((i: any) => i.id_cuadrilla = saved.id);
        } else if (c.__modified) {
          await this.cuadrillaService.updateCuadrilla(c.id, cPayload).toPromise();
          c.__modified = false;
        }

        for (const item of (c.items ?? []).filter((i: any) => i.__isNew || i.__modified)) {
          const iPayload = {
            idCuadrilla: c.id,
            idReference: item.id_reference ?? null,
            description: item.description?.trim() ?? '',
            unit: item.unit?.trim() ?? null,
            quantity: Number(item.quantity) || 0,
            unitCost: Number(item.unit_cost) || 0,
            active: true,
          };
          if (item.__isNew) {
            const saved = await this.cuadrillaService.saveItem(iPayload).toPromise();
            item.id = saved.id; item.__isNew = false;
          } else {
            await this.cuadrillaService.updateItem(item.id, iPayload).toPromise();
            item.__modified = false;
          }
        }
      }
      this.cuadrillaHasChanges = false;
      this.recalcAppliedTotal();
      alerts.basicAlert('Guardado', 'Cuadrillas guardadas correctamente', 'success');
    } catch {
      alerts.basicAlert('Error', 'Error al guardar las cuadrillas', 'error');
    }
  }

  revertCuadrillas(): void { this.loadCuadrillas(); }

  deleteCuadrilla(): void {
    if (!this.selectedCuadrilla) return;
    alerts.confirmAlert('Eliminar?', `Se eliminara "${this.selectedCuadrilla.name}" y todos sus trabajadores`, 'warning', 'Eliminar').then((r) => {
      if (!r.isConfirmed) return;
      if (this.selectedCuadrilla.id) {
        this.cuadrillaService.deleteCuadrilla(this.selectedCuadrilla.id).subscribe({
          next: () => {
            this.cuadrillas = this.cuadrillas.filter((x) => x !== this.selectedCuadrilla);
            this.selectedCuadrilla = this.cuadrillas[0] ?? null;
            if (this.selectedCuadrilla) this.selectCuadrilla(this.selectedCuadrilla);
            else { this.cuadrillaItemRows = []; }
            this.recalcAppliedTotal();
          },
          error: () => alerts.basicAlert('Error', 'No se pudo eliminar la cuadrilla', 'error'),
        });
      } else {
        this.cuadrillas = this.cuadrillas.filter((x) => x !== this.selectedCuadrilla);
        this.selectedCuadrilla = this.cuadrillas[0] ?? null;
        if (this.selectedCuadrilla) this.selectCuadrilla(this.selectedCuadrilla);
        else { this.cuadrillaItemRows = []; }
        this.cuadrillaHasChanges = this.cuadrillas.some((c) => c.__isNew || c.__modified);
      }
    });
  }

  deleteCuadrillaItem(): void {
    if (!this.selectedCuadrillaItem || !this.selectedCuadrilla) return;
    alerts.confirmAlert('Eliminar?', 'Se eliminara este trabajador de la cuadrilla', 'warning', 'Eliminar').then((r) => {
      if (!r.isConfirmed) return;
      const item = this.selectedCuadrillaItem;
      if (item.id) {
        this.cuadrillaService.deleteItem(item.id).subscribe({
          next: () => {
            this.selectedCuadrilla.items = this.selectedCuadrilla.items.filter((x: any) => x !== item);
            this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
            this.selectedCuadrillaItem = null;
            this.recalcAppliedTotal();
          },
          error: () => alerts.basicAlert('Error', 'No se pudo eliminar', 'error'),
        });
      } else {
        this.selectedCuadrilla.items = this.selectedCuadrilla.items.filter((x: any) => x !== item);
        this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
        this.selectedCuadrillaItem = null;
        this.recalcAppliedTotal();
      }
    });
  }

  // ── Factores CRUD ─────────────────────────────────────────────────────

  addFactor(): void {
    const nextOrder = this.factors.length > 0
      ? Math.max(...this.factors.map((f) => f.sort_order)) + 1 : 1;
    this.factors = [...this.factors, {
      id: null, id_contract: this.idContract, name: '', percentage: 0,
      sort_order: nextOrder, active: true, __isNew: true, __modified: false,
    }];
    this.factorHasChanges = true;
  }

  onFactorChange(factor: any): void {
    if (!factor.__isNew) factor.__modified = true;
    this.factorHasChanges = true;
  }

  selectFactor(factor: any): void {
    this.selectedFactor = this.selectedFactor === factor ? null : factor;
  }

  async saveFactors(): Promise<void> {
    const toSave = this.factors.filter((f) => f.__isNew || f.__modified);
    if (!toSave.length) { this.factorHasChanges = false; return; }
    try {
      for (const f of toSave) {
        const payload = {
          idContract: this.idContract, name: f.name?.trim() ?? '',
          percentage: Number(f.percentage) || 0,
          sortOrder: Number(f.sort_order) || 0, active: true,
        };
        if (f.__isNew) {
          const saved = await this.factorService.add(payload).toPromise();
          f.id = saved.id; f.__isNew = false;
        } else {
          await this.factorService.update(f.id, payload).toPromise();
          f.__modified = false;
        }
      }
      this.factorHasChanges = false;
      alerts.basicAlert('Guardado', 'Factores guardados correctamente', 'success');
    } catch {
      alerts.basicAlert('Error', 'Error al guardar los factores', 'error');
    }
  }

  revertFactors(): void { this.loadFactors(); }

  deleteFactor(): void {
    if (!this.selectedFactor) return;
    alerts.confirmAlert('Eliminar?', 'Se eliminara este factor', 'warning', 'Eliminar').then((r) => {
      if (!r.isConfirmed) return;
      if (this.selectedFactor.id) {
        this.factorService.delete(this.selectedFactor.id).subscribe({
          next: () => { this.factors = this.factors.filter((x) => x !== this.selectedFactor); this.selectedFactor = null; },
          error: () => alerts.basicAlert('Error', 'No se pudo eliminar el factor', 'error'),
        });
      } else {
        this.factors = this.factors.filter((x) => x !== this.selectedFactor);
        this.selectedFactor = null;
        this.factorHasChanges = this.factors.some((f) => f.__isNew || f.__modified);
      }
    });
  }

  // ── Aplicar al concepto ───────────────────────────────────────────────

  applyToConcept(): void {
    const finalValue = this.precioUnitario;
    if (finalValue === 0) return;
    const label = this.factors.length > 0 ? 'Precio Unitario' : 'Costo Directo';
    const msg = `Se actualizara el Costo MXN del concepto a $${finalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${label}). Continuar?`;
    alerts.confirmAlert('Aplicar al Concepto', msg, 'question', 'Si, aplicar').then((r) => {
      if (r.isConfirmed) { this.costUpdated.emit(finalValue); this.close(); }
    });
  }

  close(): void {
    this.visible = false;
    this.rowData = []; this.cuadrillas = []; this.factors = [];
    this.hasChanges = false; this.cuadrillaHasChanges = false; this.factorHasChanges = false;
    this.selectedRow = null; this.selectedCuadrilla = null; this.selectedCuadrillaItem = null; this.selectedFactor = null;
    this._colDefs = []; this._herramientaColDefs = []; this._auxColDefs = []; this._cuadrillaItemColDefs = [];
    this.closed.emit();
  }
}
