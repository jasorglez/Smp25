import { Component, inject, effect, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { ProductoTerminadoBomService, ProductoTerminadoBom } from 'app/services/producto-terminado-bom.service';
import { CostosPonderadosService, CostoPonderado, ModoCosto } from 'app/services/costos-ponderados.service';

// Fila del grid (Tree Data). Incluye campos de control de UI.
interface BomRow extends ProductoTerminadoBom {
  key: string;            // id real (string) o tmp-N para nuevas
  parentKey: string | null;
  path: string[];         // ruta de claves para AG Grid Tree Data
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-costos-producto-terminado',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './costos-producto-terminado.component.html',
  styleUrls: ['./costos-producto-terminado.component.scss']
})
export class CostosProductoTerminadoComponent {
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);
  private bomService = inject(ProductoTerminadoBomService);
  private costosService = inject(CostosPonderadosService);
  private cdr = inject(ChangeDetectorRef);

  private gridApi!: GridApi;
  idRoot: number | null = null;

  // Productos terminados (raíz) y catálogo de materiales (hijos).
  finalProducts: any[] = [];
  selectedProductId: number | null = null;
  materials: any[] = [];
  private materialById = new Map<number, any>();
  materialArticulos: string[] = [];

  // Datos del árbol.
  rowData = signal<BomRow[]>([]);
  private originalRows: BomRow[] = [];
  hasUnsavedChanges = false;
  selectedRow: BomRow | null = null;
  private tempSeq = 0;

  unidades = ['kg', 'L', 'pz', 'g', 'ml'];

  // ─── Costos ponderados de básicos ────────────────────────────────
  // KPIs por material básico (promedio/última/máximo) traídos en lote.
  private costosMap = new Map<number, CostoPonderado>();
  // Simulación temporal: cuando está activa, TODOS los básicos se costean con simulModo
  // SIN persistir (no toca modoCosto de cada fila ni marca cambios).
  simulModo: ModoCosto | null = null;
  readonly modos: { v: ModoCosto; label: string }[] = [
    { v: 'PONDERADO', label: 'Promedio Ponderado' },
    { v: 'ULTIMA', label: 'Última Compra' },
    { v: 'MAXIMO', label: 'Máximo (peor caso)' },
  ];

  // Modal de costo por fila.
  showCostoModal = false;
  modalRow: BomRow | null = null;
  modalCosto: CostoPonderado | null = null;
  modalModo: ModoCosto = 'PONDERADO';

  constructor() {
    effect(() => {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (idRoot) {
        this.idRoot = idRoot;
        this.loadInitial();
      }
    });
  }

  private async loadInitial() {
    if (!this.idRoot) return;
    try {
      const [fps, mats] = await Promise.all([
        lastValueFrom(this.materialsService.getFinalProduct(this.idRoot)),
        lastValueFrom(this.materialsService.getMaterialsxview(this.idRoot)),
      ]);
      this.finalProducts = (fps ?? []).map((p: any) => ({
        id: p.id,
        label: [p.category, p.flavor, p.presentation].filter(Boolean).join(' / ').toUpperCase(),
      }));
      this.materials = mats ?? [];
      this.materialById.clear();
      this.materials.forEach(m => this.materialById.set(Number(m.id), m));
      this.materialArticulos = this.materials
        .map(m => (m.articulo || '').toUpperCase())
        .filter((v: string) => v.length > 0)
        .sort();
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error cargando catálogos:', e);
      alerts.basicAlert('Error', 'No se pudieron cargar productos/materiales.', 'error');
    }
  }

  // ─── Carga del árbol de un producto ──────────────────────────────
  async onProductChange() {
    if (!this.idRoot || !this.selectedProductId) {
      this.rowData.set([]);
      return;
    }
    try {
      const nodes = await lastValueFrom(
        this.bomService.getByRoot(this.idRoot, this.selectedProductId)
      );
      let rows = this.toRows(nodes ?? []);
      if (rows.length === 0) {
        // Sembrar raíz en memoria (producto terminado) si aún no tiene BOM.
        rows = [this.makeRootRow()];
      }
      this.simulModo = null;
      await this.loadCostos(rows);          // trae KPIs de los básicos del árbol
      this.recomputeAll(rows);
      this.commit(rows);
      this.originalRows = JSON.parse(JSON.stringify(rows));
      this.hasUnsavedChanges = false;
      this.selectedRow = null;
    } catch (e) {
      console.error('Error cargando BOM:', e);
      alerts.basicAlert('Error', 'No se pudo cargar la estructura del producto.', 'error');
    }
  }

  private makeRootRow(): BomRow {
    const prod = this.finalProducts.find(p => p.id === this.selectedProductId);
    const key = `tmp-${++this.tempSeq}`;
    return {
      key, parentKey: null, path: [key],
      id: null, idCompany: this.idRoot!, idProductoRoot: this.selectedProductId!,
      idPadre: null, idMaterial: null, nombre: prod?.label ?? 'PRODUCTO TERMINADO',
      esBasico: false, cantidad: 1, unidad: 'pz', mermaPct: 0,
      costoUnitario: 0, costoTotal: 0, active: true, __isNew: true,
    };
  }

  // Convierte nodos planos del backend en filas con key/parentKey/path.
  private toRows(nodes: ProductoTerminadoBom[]): BomRow[] {
    const rows: BomRow[] = nodes.map(n => ({
      ...n,
      key: String(n.id),
      parentKey: n.idPadre != null ? String(n.idPadre) : null,
      path: [],
    }));
    this.rebuildPaths(rows);
    return rows;
  }

  // Reconstruye los path[] caminando por parentKey.
  private rebuildPaths(rows: BomRow[]) {
    const byKey = new Map(rows.map(r => [r.key, r]));
    for (const r of rows) {
      const path: string[] = [];
      let cur: BomRow | undefined = r;
      const guard = new Set<string>();
      while (cur && !guard.has(cur.key)) {
        guard.add(cur.key);
        path.unshift(cur.key);
        cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined;
      }
      r.path = path;
      r.nivel = path.length - 1;
    }
  }

  // ─── Costos (roll-up de abajo hacia arriba) ──────────────────────
  private recomputeAll(rows: BomRow[]) {
    const byKey = new Map(rows.map(r => [r.key, r]));
    const childrenOf = new Map<string, BomRow[]>();
    for (const r of rows) {
      if (r.parentKey) {
        if (!childrenOf.has(r.parentKey)) childrenOf.set(r.parentKey, []);
        childrenOf.get(r.parentKey)!.push(r);
      }
    }
    const compute = (row: BomRow): number => {
      const kids = childrenOf.get(row.key) ?? [];
      if (kids.length === 0) {
        // Hoja: costo total = cantidad × costo unitario × (1 + merma%)
        // Para básicos, el costo unitario sale del promedio ponderado según el modo efectivo.
        if (row.esBasico && row.idMaterial) {
          row.costoUnitario = this.costoUnitarioBasico(row);
        }
        const cant = Number(row.cantidad) || 0;
        const cu = Number(row.costoUnitario) || 0;
        const merma = Number(row.mermaPct) || 0;
        row.costoTotal = +(cant * cu * (1 + merma / 100)).toFixed(4);
        return row.costoTotal;
      }
      // Nodo con hijos: costo total = suma de hijos (roll-up).
      let sum = 0;
      for (const k of kids) sum += compute(k);
      row.costoTotal = +sum.toFixed(4);
      row.costoUnitario = row.costoTotal; // informativo para intermedios/raíz
      return row.costoTotal;
    };
    rows.filter(r => !r.parentKey).forEach(compute);
    byKey.size; // noop para mantener referencia
  }

  private commit(rows: BomRow[]) {
    this.rowData.set([...rows]);
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData());
  }

  // Trae en lote los KPIs de costo de todos los materiales básicos del árbol.
  private async loadCostos(rows: BomRow[]) {
    if (!this.idRoot) return;
    const ids = Array.from(new Set(
      rows.filter(r => r.esBasico && r.idMaterial).map(r => Number(r.idMaterial))
    ));
    if (ids.length === 0) { this.costosMap.clear(); return; }
    try {
      const list = await lastValueFrom(this.costosService.getBatch(this.idRoot, ids));
      this.costosMap.clear();
      (list ?? []).forEach(c => this.costosMap.set(c.idMaterial, c));
    } catch (e) {
      console.warn('No se pudieron cargar costos ponderados del BOM', e);
    }
  }

  // Modo efectivo de una fila: la simulación (temporal) gana sobre el modo guardado.
  effectiveModo(row: BomRow): ModoCosto {
    return this.simulModo ?? ((row.modoCosto as ModoCosto) || 'PONDERADO');
  }

  // Costo unitario de un básico según su modo efectivo (cae a costoUnitario guardado si no hay datos).
  private costoUnitarioBasico(row: BomRow): number {
    const c = this.costosMap.get(Number(row.idMaterial));
    if (!c || c.sinDatos) return Number(row.costoUnitario) || 0;
    return CostosPonderadosService.valorPorModo(c, this.effectiveModo(row));
  }

  modoLabel(row: BomRow): string {
    if (!row.esBasico) return '';
    const m = this.effectiveModo(row);
    return m === 'ULTIMA' ? 'Últ.' : m === 'MAXIMO' ? 'Máx.' : 'Pond.';
  }

  // ─── Controles de base de costo ──────────────────────────────────
  // Global: aplica un modo a TODOS los básicos (persiste; marca cambios).
  applyGlobalModo(modo: ModoCosto) {
    const rows = this.rowData();
    let changed = false;
    for (const r of rows) {
      if (r.esBasico && r.idMaterial && r.modoCosto !== modo) {
        r.modoCosto = modo;
        if (!r.__isNew) r.__modified = true;
        changed = true;
      }
    }
    if (changed) this.hasUnsavedChanges = true;
    this.simulModo = null;
    this.recomputeAll(rows);
    this.commit(rows);
  }

  // Simular: vista temporal con un modo (NO persiste). Volver a pulsar el mismo = quitar.
  simular(modo: ModoCosto) {
    this.simulModo = this.simulModo === modo ? null : modo;
    const rows = this.rowData();
    this.recomputeAll(rows);
    this.commit(rows);
  }

  clearSimular() {
    if (!this.simulModo) return;
    this.simulModo = null;
    const rows = this.rowData();
    this.recomputeAll(rows);
    this.commit(rows);
  }

  // ─── Modal por fila ──────────────────────────────────────────────
  openCostoModal(row: BomRow) {
    if (!row?.esBasico || !row.idMaterial) return;
    this.modalRow = row;
    this.modalCosto = this.costosMap.get(Number(row.idMaterial)) ?? null;
    this.modalModo = (row.modoCosto as ModoCosto) || 'PONDERADO';
    this.showCostoModal = true;
  }

  valorModal(modo: ModoCosto): number {
    return CostosPonderadosService.valorPorModo(this.modalCosto, modo);
  }

  confirmCostoModal() {
    if (this.modalRow) {
      if (this.modalRow.modoCosto !== this.modalModo) {
        this.modalRow.modoCosto = this.modalModo;
        if (!this.modalRow.__isNew) this.modalRow.__modified = true;
        this.hasUnsavedChanges = true;
      }
      this.simulModo = null;
      const rows = this.rowData();
      this.recomputeAll(rows);
      this.commit(rows);
    }
    this.closeCostoModal();
  }

  closeCostoModal() {
    this.showCostoModal = false;
    this.modalRow = null;
    this.modalCosto = null;
  }

  // ─── Grid config ─────────────────────────────────────────────────
  gridOptions: any = {
    treeData: true,
    groupDefaultExpanded: -1,
    animateRows: true,
    headerHeight: 36,
    rowHeight: 32,
    getDataPath: (data: BomRow) => data.path,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    getRowId: (p: any) => p.data.key,
    context: { parent: this },
  };

  autoGroupColumnDef: ColDef = {
    headerName: 'Artículo',
    minWidth: 320,
    cellRendererParams: { suppressCount: true },
    editable: (p: any) => !!p.data && !!p.data.parentKey, // la raíz no se edita
    cellEditor: 'agRichSelectCellEditor',
    cellEditorParams: () => ({ values: this.materialArticulos }),
    valueGetter: (p: any) => p.data?.nombre ?? '',
    valueSetter: (p: any) => this.onArticuloSet(p),
  };

  columnDefs: ColDef[] = [
    {
      headerName: 'Cantidad', field: 'cantidad', width: 120, editable: (p: any) => !!p.data?.parentKey,
      type: 'numericColumn',
      valueParser: (p: any) => Number(p.newValue) || 0,
      valueSetter: (p: any) => { p.data.cantidad = Number(p.newValue) || 0; this.markChanged(p.data); return true; },
    },
    {
      headerName: 'Unidad', field: 'unidad', width: 110, editable: (p: any) => !!p.data?.parentKey,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: () => ({ values: this.unidades }),
      valueSetter: (p: any) => { p.data.unidad = p.newValue; this.markChanged(p.data); return true; },
    },
    {
      headerName: '% Merma', field: 'mermaPct', width: 110, editable: (p: any) => !!p.data?.parentKey,
      type: 'numericColumn',
      valueParser: (p: any) => Number(p.newValue) || 0,
      valueFormatter: (p: any) => p.value != null ? `${p.value}%` : '',
      valueSetter: (p: any) => { p.data.mermaPct = Number(p.newValue) || 0; this.markChanged(p.data); return true; },
    },
    {
      // Para BÁSICOS la celda es verde y clickeable: abre el modal para elegir base de costo
      // (Ponderado/Última/Máximo). Para semi-elaborados es informativa (suma de formulación).
      headerName: 'Costo Unit.', field: 'costoUnitario', width: 160, editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) => {
        const base = this.money(p.value);
        return p.data?.esBasico ? `${base}  (${this.modoLabel(p.data)})` : base;
      },
      cellStyle: (p: any) => p.data?.esBasico
        ? { backgroundColor: '#c8e6c9', cursor: 'pointer', textDecoration: 'underline' }
        : { backgroundColor: '#f5f5f5' },
      onCellClicked: (p: any) => { if (p.data?.esBasico) this.openCostoModal(p.data); },
    },
    {
      headerName: 'Costo Total', field: 'costoTotal', width: 140, editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) => this.money(p.value),
      cellStyle: (p: any) => ({ backgroundColor: '#e8f5e9', fontWeight: p.data && !p.data.parentKey ? '700' : '400' }),
    },
    {
      headerName: 'Activo', field: 'active', width: 90, editable: (p: any) => !!p.data?.parentKey,
      cellRenderer: 'agCheckboxCellRenderer',
      valueSetter: (p: any) => { p.data.active = !!p.newValue; this.markChanged(p.data); return true; },
    },
    {
      headerName: 'Comentarios', field: 'comentarios', flex: 1, minWidth: 180,
      editable: (p: any) => !!p.data?.parentKey,
      valueSetter: (p: any) => { p.data.comentarios = (p.newValue || '').toString().toUpperCase(); this.markChanged(p.data); return true; },
    },
  ];

  defaultColDef: ColDef = { resizable: true, sortable: false, suppressMovable: true };

  // Resuelve el material seleccionado en la columna Artículo.
  private onArticuloSet(p: any): boolean {
    const articulo = (p.newValue || '').toString().toUpperCase().trim();
    if (!articulo) return false;
    const mat = this.materials.find(m => (m.articulo || '').toUpperCase() === articulo);
    if (!mat) { alerts.basicAlert('Aviso', 'Material no encontrado en el catálogo.', 'warning'); return false; }
    p.data.idMaterial = Number(mat.id);
    p.data.nombre = articulo;
    p.data.esBasico = (mat.categoria || '').toUpperCase().includes('BASIC');
    // Hojas básicas: costo de última compra (costoMN) como respaldo. Semi-elaborados: costo_base (Capa 1) — aún 0.
    p.data.costoUnitario = Number(mat.costoMN) || 0;
    if (p.data.esBasico) {
      if (!p.data.modoCosto) p.data.modoCosto = 'PONDERADO';
      // Trae los KPIs ponderados del básico recién elegido (si no estaban en el mapa).
      const idMat = Number(mat.id);
      if (!this.costosMap.has(idMat) && this.idRoot) {
        this.costosService.getByMaterial(this.idRoot, idMat).subscribe({
          next: (c) => {
            if (c) this.costosMap.set(idMat, c);
            const rows = this.rowData();
            this.recomputeAll(rows);
            this.commit(rows);
          },
          error: () => {}
        });
      }
    }
    this.markChanged(p.data);
    return true;
  }

  private markChanged(row: BomRow) {
    if (!row.__isNew) row.__modified = true;
    this.hasUnsavedChanges = true;
    const rows = this.rowData();
    this.recomputeAll(rows);
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
  }

  private money(v: any): string {
    const n = Number(v) || 0;
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  // ─── Acciones CRUD ───────────────────────────────────────────────
  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    if (this.rowData().length) this.gridApi.setGridOption('rowData', this.rowData());
  }

  onSelectionChanged() {
    const sel = this.gridApi?.getSelectedRows?.() ?? [];
    this.selectedRow = sel.length ? sel[0] : null;
  }

  // Agrega un hijo bajo la fila seleccionada (o bajo la raíz si no hay selección).
  add() {
    const rows = [...this.rowData()];
    if (rows.length === 0) { alerts.basicAlert('Aviso', 'Selecciona un producto terminado primero.', 'warning'); return; }
    const parent = this.selectedRow ?? rows.find(r => !r.parentKey)!;
    const key = `tmp-${++this.tempSeq}`;
    const child: BomRow = {
      key, parentKey: parent.key, path: [...parent.path, key],
      id: null, idCompany: this.idRoot!, idProductoRoot: this.selectedProductId!,
      idPadre: parent.id ?? null, idMaterial: null, nombre: '',
      esBasico: false, cantidad: 1, unidad: 'kg', mermaPct: 0,
      costoUnitario: 0, costoTotal: 0, comentarios: '', modoCosto: 'PONDERADO',
      active: true, __isNew: true,
    };
    rows.push(child);
    this.rebuildPaths(rows);
    this.recomputeAll(rows);
    this.commit(rows);
    this.hasUnsavedChanges = true;
    setTimeout(() => this.gridApi?.ensureNodeVisible((n: any) => n.data?.key === key), 50);
  }

  async saveChanges() {
    const rows = [...this.rowData()];
    const tmpToReal = new Map<string, number>();

    // 1) Guardar nuevos por niveles (padre antes que hijo).
    let pending = rows.filter(r => r.__isNew);
    let guard = 0;
    while (pending.length && guard++ < 50) {
      const ready = pending.filter(r => !r.parentKey || tmpToReal.has(r.parentKey) || !r.parentKey.startsWith('tmp-'));
      if (ready.length === 0) break;
      for (const r of ready) {
        const idPadre = r.parentKey
          ? (r.parentKey.startsWith('tmp-') ? tmpToReal.get(r.parentKey)! : Number(r.parentKey))
          : null;
        const payload = this.toPayload(r, idPadre);
        const created = await lastValueFrom(this.bomService.create(payload));
        tmpToReal.set(r.key, created.id!);
      }
      pending = pending.filter(r => !ready.includes(r));
    }

    // 2) Actualizar modificados existentes.
    const modified = rows.filter(r => !r.__isNew && r.__modified && r.id);
    for (const r of modified) {
      const idPadre = r.parentKey
        ? (r.parentKey.startsWith('tmp-') ? (tmpToReal.get(r.parentKey) ?? null) : Number(r.parentKey))
        : null;
      await lastValueFrom(this.bomService.update(r.id!, this.toPayload(r, idPadre)));
    }

    alerts.basicAlert('Guardado', 'Cambios guardados correctamente.', 'success');
    await this.onProductChange(); // recarga limpia desde BD
  }

  private toPayload(r: BomRow, idPadre: number | null): ProductoTerminadoBom {
    return {
      id: r.id ?? undefined as any,
      idCompany: this.idRoot!,
      idProductoRoot: this.selectedProductId!,
      idPadre,
      idMaterial: r.idMaterial ?? null,
      nombre: r.nombre ?? null,
      esBasico: !!r.esBasico,
      cantidad: Number(r.cantidad) || 0,
      unidad: r.unidad ?? null,
      mermaPct: Number(r.mermaPct) || 0,
      costoUnitario: Number(r.costoUnitario) || 0,
      costoTotal: Number(r.costoTotal) || 0,
      orden: r.orden ?? 0,
      nivel: r.nivel ?? 0,
      comentarios: r.comentarios ?? null,
      modoCosto: r.modoCosto ?? 'PONDERADO',
      active: r.active !== false,
    };
  }

  revertChanges() {
    const rows = JSON.parse(JSON.stringify(this.originalRows));
    this.recomputeAll(rows);
    this.commit(rows);
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
  }

  async deleteSelected() {
    if (!this.selectedRow) { alerts.basicAlert('Aviso', 'Selecciona una fila para borrar.', 'warning'); return; }
    if (!this.selectedRow.parentKey) { alerts.basicAlert('Aviso', 'No se puede borrar la raíz (producto terminado).', 'warning'); return; }

    const res = await alerts.confirmAlert('Confirmar', `¿Borrar "${this.selectedRow.nombre}" y sus componentes?`, 'warning', 'Sí, borrar');
    if (!res.isConfirmed) return;

    if (this.selectedRow.id) {
      await lastValueFrom(this.bomService.delete(this.selectedRow.id));
      await this.onProductChange();
    } else {
      // Fila nueva sin guardar: quitar en memoria (con descendientes).
      const rows = this.rowData();
      const toRemove = new Set<string>([this.selectedRow.key]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const r of rows) {
          if (r.parentKey && toRemove.has(r.parentKey) && !toRemove.has(r.key)) { toRemove.add(r.key); grew = true; }
        }
      }
      const kept = rows.filter(r => !toRemove.has(r.key));
      this.rebuildPaths(kept);
      this.recomputeAll(kept);
      this.commit(kept);
    }
    this.selectedRow = null;
  }

  get productoTotal(): number {
    const root = this.rowData().find(r => !r.parentKey);
    return root ? Number(root.costoTotal) || 0 : 0;
  }
}
