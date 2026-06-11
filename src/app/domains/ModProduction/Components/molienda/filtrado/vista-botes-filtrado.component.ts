import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SignalsService } from 'app/services/signals.service';
import { ExtractionFermentationCatalogService } from 'app/services/extraction-fermentation-catalog.service';
import { MaterialXModuloService } from 'app/services/materialxmodulo.service';
import { BranchsService } from 'app/services/branchs.service';
import { alerts } from 'app/helpers/alerts';
import { MedicionesBoteComponent } from './mediciones-bote.component';

interface BoteVista {
  id: number;
  description: string;  // clave completa = folio
  volumen: number;
  myLiters: number;
  totalLiters: number;
}

@Component({
  selector: 'app-vista-botes-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular, MedicionesBoteComponent],
  template: `
    <div style="height: 100%; display: flex; overflow: hidden; background: #fff8e1;">

      <!-- ─── Panel izquierdo: barriles ─── -->
      <div style="display: flex; flex-direction: column; overflow: hidden; transition: width 0.25s ease;"
           [style.width]="selectedBote ? '260px' : '100%'"
           [style.min-width]="selectedBote ? '200px' : '0'">

        <!-- Header barriles -->
        <div style="padding: 6px 8px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #ffe0b2;">
          <strong style="font-size: 0.85rem; color: #e65100; flex: 1;">
            <i class="bi bi-bucket-fill me-1"></i>Botes
            <span *ngIf="matPrimaName" style="font-weight: 400;"> — {{ matPrimaName }}</span>
          </strong>
          <span *ngIf="selectedBote"
                style="font-size: 0.7rem; color: #9e9e9e; cursor: pointer; text-decoration: underline;"
                (click)="closeBotePanel()">
            Cerrar
          </span>
        </div>

        <!-- Leyenda (solo cuando no hay bote seleccionado) -->
        <div *ngIf="!selectedBote"
             style="padding: 3px 8px; flex-shrink: 0; font-size: 0.72rem; color: #795548; display: flex; gap: 10px;">
          <span>
            <span style="display:inline-block;width:10px;height:10px;background:rgba(253,126,20,0.55);border-radius:2px;margin-right:3px;"></span>Este reg.
          </span>
          <span>
            <span style="display:inline-block;width:10px;height:10px;background:rgba(108,117,125,0.28);border-radius:2px;margin-right:3px;"></span>Otros
          </span>
        </div>

        <!-- Loading -->
        <div *ngIf="loading"
             style="flex:1;display:flex;align-items:center;justify-content:center;color:#9e9e9e;font-size:0.85rem;">
          <i class="bi bi-hourglass-split me-2"></i>Cargando…
        </div>

        <!-- Sin botes -->
        <div *ngIf="!loading && !botes.length"
             style="flex:1;display:flex;align-items:center;justify-content:center;color:#9e9e9e;font-size:0.82rem;text-align:center;padding:12px;">
          <div>
            <i class="bi bi-bucket" style="font-size:1.8rem;display:block;margin-bottom:6px;opacity:0.4;"></i>
            Sin botes para esta mat. prima
          </div>
        </div>

        <!-- Tarjetas de barriles -->
        <div *ngIf="!loading && botes.length"
             style="flex:1 1 auto;min-height:0;overflow-y:auto;padding:8px;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;">
          <ng-container *ngFor="let b of botes">
          <div *ngIf="!selectedBote || selectedBote.id === b.id"
               class="bote-card"
               [class.bote-card--selected]="selectedBote?.id === b.id"
               [class.bote-card--full]="totalPct(b) >= 100"
               [class.bote-card--empty]="totalPct(b) === 0"
               [class.bote-card--partial]="totalPct(b) > 0 && totalPct(b) < 100"
               (click)="selectBote(b)"
               style="cursor: pointer;">

            <div class="bote-barrel"
                 [class.bote-barrel--full]="totalPct(b) >= 100"
                 [class.bote-barrel--empty]="totalPct(b) === 0"
                 [class.bote-barrel--partial]="totalPct(b) > 0 && totalPct(b) < 100">
              <div class="bote-fill bote-fill--external" [style.height.%]="externalPct(b)"></div>
              <div class="bote-fill bote-fill--mine" [style.height.%]="minePct(b)" [style.bottom.%]="externalPct(b)"></div>
              <i class="bi bi-bucket-fill bote-icon"
                 [style.color]="totalPct(b) === 0 ? '#0a6640' : '#843f00'"></i>
              <span class="bote-pct">{{ disponible(b) | number:'1.0-0' }} L</span>
            </div>

            <div class="bote-label" [title]="b.description">{{ b.description }}</div>

            <div style="font-size:0.67rem;color:#6c757d;text-align:center;">
              {{ b.myLiters | number:'1.0-0' }} / {{ b.volumen | number:'1.0-0' }} L
            </div>
          </div>
          </ng-container>
        </div>
      </div>

      <!-- ─── Panel derecho: grid de parámetros ─── -->
      <div *ngIf="selectedBote"
           style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-left:2px solid #ffe0b2;background:#fffde7;">

        <!-- Header parámetros -->
        <div style="padding: 5px 8px; flex-shrink: 0; border-bottom: 1px solid #ffe0b2; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.8rem; color: #e65100; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <i class="bi bi-sliders me-1"></i>{{ selectedBote.description }}
          </span>
          <div class="d-flex gap-1" style="flex-shrink: 0;">
            <button class="btn btn-success btn-sm" style="padding:1px 6px;" (click)="addRow()" [disabled]="!paramsGridApi">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="btn btn-primary btn-sm position-relative" style="padding:1px 6px;" (click)="saveChanges()" [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i>
              <span *ngIf="hasChanges" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
            </button>
            <button class="btn btn-warning btn-sm" style="padding:1px 6px;" (click)="revert()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn btn-danger btn-sm" style="padding:1px 6px;" (click)="deleteRow()" [disabled]="!selectedParamRow">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>

        <!-- Grid -->
        <div style="flex:1 1 auto;min-height:0;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            style="width:100%;height:100%;"
            [rowData]="paramsRowData"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            [context]="{ idArticulo: matPrimaId, matPrimaOptions: matPrimaOptions }"
            (gridReady)="onParamsGridReady($event)"
            (selectionChanged)="onParamsSelectionChanged($event)"
            (cellValueChanged)="onCellValueChanged()">
          </ag-grid-angular>
        </div>

      </div>

    </div>

  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }

    .bote-card {
      display: flex; flex-direction: column; align-items: center;
      width: 120px; background: #fff; border: 1.5px solid #dee2e6;
      border-radius: 10px; padding: 8px 6px 6px; gap: 4px;
      transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
    }
    .bote-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.14); transform: translateY(-1px); }
    .bote-card--selected { border-color: #1565c0 !important; background: #e3f2fd !important; box-shadow: 0 0 0 3px rgba(21,101,192,0.25); }
    .bote-card--full    { border-color: #dc3545; background: #fff5f5; }
    .bote-card--empty   { border-color: #198754; border-width: 2px; background: #c8f7dc; }
    .bote-card--partial { border-color: #fd7e14; background: #fff3e0; }

    .bote-barrel {
      position: relative; width: 72px; height: 80px;
      border: 2px solid #adb5bd; border-radius: 10px;
      overflow: hidden; background: #f1f3f5;
      display: flex; align-items: center; justify-content: center;
    }
    .bote-barrel--full    { border-color: #dc3545; }
    .bote-barrel--empty   { border-color: #198754; background: #e6faf0; }
    .bote-barrel--partial { border-color: #fd7e14; }

    .bote-fill { position: absolute; left: 0; right: 0; bottom: 0; transition: height 0.35s ease; }
    .bote-fill--external { background: rgba(108,117,125,0.28); }
    .bote-fill--mine     { background: rgba(253,126,20,0.55); }

    .bote-icon { position: relative; z-index: 2; font-size: 1.5rem; filter: drop-shadow(0 1px 1px rgba(255,255,255,0.7)); }
    .bote-pct {
      position: absolute; bottom: 2px; right: 3px;
      font-size: 0.56rem; font-weight: 700; color: #343a40; z-index: 3;
    }
    .bote-label {
      font-size: 0.68rem; font-weight: 600; color: #343a40;
      text-align: center; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 108px;
    }
  `],
})
export class VistaBotesFiltradoComponent {
  private productionService = inject(ProductionService);
  private signalsService    = inject(SignalsService);
  private catalogService    = inject(ExtractionFermentationCatalogService);
  private mxmService        = inject(MaterialXModuloService);
  private branchsService    = inject(BranchsService);

  // Barriles
  botes: BoteVista[] = [];
  loading = false;
  matPrimaName = '';
  selectedBote: BoteVista | null = null;

  // Grid de parámetros
  paramsGridApi!: GridApi;
  paramsRowData: any[] = [];
  private originalParamsRowData: any[] = [];
  hasChanges = false;
  selectedParamRow: any = null;

  private idMolienda:  number | null = null;
  matPrimaId:          number | null = null;
  private rowBranchId: number | null = null;

  matPrimaOptions:   { id: number; name: string }[] = [];

  // ── Column defs para el grid de parámetros ────────────────────────────────
  colDefs: ColDef[] = [
    {
      field: 'folio',
      headerName: 'Folio',
      editable: false,       // auto-generado = clave del bote
      width: 160,
      cellStyle: { backgroundColor: '#f8f9fa', color: '#495057', fontWeight: '600' },
    },
    {
      field: 'parametros',
      headerName: 'Mediciones',
      editable: false,
      flex: 1,
      cellRenderer: (p: any) => {
        if (!p.data?.id) return '—';
        const a = document.createElement('a');
        a.href = '#';
        a.style.cssText = 'color:#1565c0;text-decoration:underline;font-size:0.78rem;';
        a.textContent = p.node?.expanded ? '▲ Ocultar' : '▼ Ver mediciones';
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          p.node.setExpanded(!p.node.expanded);
        });
        return a;
      },
    },
    {
      field: 'objetivo',
      headerName: 'Objetivo',
      editable: true,
      width: 100,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      valueSetter: (p: any) => { p.data.objetivo = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
    {
      field: 'libLimpieza',
      headerName: 'Liberación Limpieza',
      editable: true,
      width: 155,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      valueSetter: (p: any) => { p.data.libLimpieza = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
    },
  ];

  gridOptions: any = {
    getRowId:                      (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight:                  25,
    rowHeight:                     22,
    rowSelection:                  'single',
    suppressRowClickSelection:     false,
    stopEditingWhenCellsLoseFocus: true,
    masterDetail:                  true,
    isRowMaster:                   (data: any) => !!data?.id && !data?.__isNew,
    detailCellRenderer:            MedicionesBoteComponent,
    detailRowHeight:               300,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowSelected: (e: any) => { if (e.node.isSelected()) this.selectedParamRow = e.data; },
  };

  // ── Init ──────────────────────────────────────────────────────────────────

  agInit(params: any) {
    this.idMolienda  = params?.data?.id ?? null;
    this.matPrimaId  = params?.data?.matPrima ?? null;
    this.rowBranchId = params?.data?.sucursal ?? null;
    const opts: { id: number; name: string }[] = params?.context?.articuloOptions ?? [];
    this.matPrimaOptions = params?.context?.matPrimaOptions ?? opts;
    this.matPrimaName = opts.find(o => o.id === this.matPrimaId)?.name ?? '';
    // Reset state when switching tabs
    this.selectedBote = null;
    this.paramsRowData = [];
    this.hasChanges = false;
    this.loadBotes();
  }

  refresh(): boolean { return false; }

  onParamsGridReady(e: GridReadyEvent) {
    this.paramsGridApi = e.api;
    if (this.paramsRowData.length)
      this.paramsGridApi.setGridOption('rowData', this.paramsRowData);
  }

  onParamsSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedParamRow = nodes.length ? nodes[0].data : null;
  }

  onCellValueChanged() { this.hasChanges = true; }

  // ── Barriles ──────────────────────────────────────────────────────────────

  private async loadBotes() {
    this.loading = true;
    this.botes = [];
    try {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (!idCompany) return;

      const [catalogs, prefijosData, matData, branchesData] = await Promise.all([
        lastValueFrom(this.catalogService.getAll(idCompany)),
        lastValueFrom(this.productionService.getMoliendaPrefijos(idCompany)),
        lastValueFrom(this.mxmService.getByType(idCompany, 'MOLIENDA')),
        lastValueFrom(this.branchsService.getBranches(idCompany)),
      ]);

      const branchPrefijoMap = new Map<number, string>(
        ((branchesData ?? []) as any[]).map((b: any) => [b.id as number, (b.prefix ?? '') as string])
      );
      const fajePrefijoMap = new Map<number, string>(
        (prefijosData ?? []).map((p: any) => [p.id, p.prefijo ?? ''])
      );
      const artPrefijoMap = new Map<number, string>(
        (matData ?? []).filter((m: any) => m.idArticulo != null)
          .map((m: any) => [m.idArticulo, m.prefijo ?? ''])
      );

      const botesCatalog = (catalogs ?? []).find((c: any) => {
        const d = (c.description || '').trim().toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '');
        return d.startsWith('botes molienda') || d.startsWith('botes');
      });
      if (!botesCatalog) return;

      const items = await lastValueFrom(this.mxmService.getByCatalog(idCompany, botesCatalog.id));
      const moFaseId = (prefijosData ?? []).find((p: any) => p.prefijo === 'MO')?.id ?? null;

      const filtered = ((items ?? []) as any[]).filter((m: any) => {
        if (m.active === false) return false;
        if (moFaseId != null && m.idPrefijoFase !== moFaseId) return false;
        if (this.matPrimaId  != null && m.idMatPrima  !== this.matPrimaId)  return false;
        if (this.rowBranchId != null && m.idBranch    !== this.rowBranchId) return false;
        return true;
      });

      const [globalUsage, myUsage] = await Promise.all([
        lastValueFrom(this.productionService.getMoliendaBoteUsage())
          .then(u => u ?? {} as Record<number, number>).catch(() => ({} as Record<number, number>)),
        this.idMolienda
          ? lastValueFrom(this.productionService.getMoliendaBoteSumsByMolienda(this.idMolienda))
              .then(u => u ?? {} as Record<number, number>).catch(() => ({} as Record<number, number>))
          : Promise.resolve({} as Record<number, number>),
      ]);

      this.botes = filtered.map((item: any) => {
        const fasePrefijo = item.idPrefijoFase != null ? (fajePrefijoMap.get(item.idPrefijoFase) ?? '') : '';
        const artPrefijo  = item.idMatPrima    != null ? (artPrefijoMap.get(item.idMatPrima)     ?? '') : '';
        const branchPref  = item.idBranch      != null ? (branchPrefijoMap.get(item.idBranch)    ?? '') : '';
        const year   = String(item.anio ?? new Date().getFullYear()).slice(-2);
        const num    = item.numBote  ?? '';
        const count  = item.contador ?? 1;
        const description = `${branchPref}${fasePrefijo}${artPrefijo}${year}/${item.cantidad ?? ''}-${num}/${count}`;
        return {
          id:          item.id,
          description,
          volumen:     Number(item.cantidad ?? 0),
          myLiters:    Number(myUsage[item.id]    ?? 0),
          totalLiters: Number(globalUsage[item.id] ?? 0),
        };
      });

      // Auto-crear folios para botes que aún no tienen entrada en molienda_params
      if (this.idMolienda && this.botes.length) {
        const existing = await lastValueFrom(
          this.productionService.getMoliendaParamsByMolienda(this.idMolienda)
        ).catch(() => [] as any[]);
        const existingBoteIds = new Set((existing as any[]).map((p: any) => p.idBoteCatalog));
        const missing = this.botes.filter(b => !existingBoteIds.has(b.id));
        await Promise.all(missing.map(b =>
          lastValueFrom(this.productionService.createMoliendaParams({
            idMolienda:    this.idMolienda!,
            idBoteCatalog: b.id,
            folio:         b.description,
            libLimpieza:   false,
          })).catch(() => null)
        ));
      }
    } catch (e) {
      console.error('Error cargando botes:', e);
    } finally {
      this.loading = false;
    }
  }

  async selectBote(b: BoteVista) {
    if (this.selectedBote?.id === b.id) return;
    this.selectedBote = b;
    this.hasChanges = false;
    this.selectedParamRow = null;
    await this.loadParams(b);
  }

  closeBotePanel() {
    this.selectedBote = null;
    this.paramsRowData = [];
    this.hasChanges = false;
  }

  // ── Grid de parámetros ────────────────────────────────────────────────────

  private async loadParams(bote: BoteVista) {
    if (!this.idMolienda) { this.paramsRowData = []; return; }
    try {
      const items = await lastValueFrom(
        this.productionService.getMoliendaParamsByMoliendaAndBote(this.idMolienda, bote.id)
      );
      const mapped = (Array.isArray(items) ? items : []).map((i: any) => ({
        id:          i.id,
        folio:       i.folio       ?? bote.description,
        parametros:  i.parametros  ?? '',
        objetivo:    i.objetivo    ?? null,
        libLimpieza: !!i.libLimpieza,
        __isNew:     false,
        __modified:  false,
      }));
      this.originalParamsRowData = JSON.parse(JSON.stringify(mapped));
      this.paramsRowData = mapped;
      if (this.paramsGridApi && !this.paramsGridApi.isDestroyed())
        this.paramsGridApi.setGridOption('rowData', mapped);
    } catch (e) {
      console.error('Error cargando params:', e);
    }
  }

  addRow() {
    if (!this.selectedBote) return;
    const newRow = {
      id: null, __tempId: `new_${Date.now()}`,
      __isNew: true, __modified: false,
      folio:       this.selectedBote.description,   // clave del bote = folio
      parametros:  '',
      objetivo:    null,
      libLimpieza: false,
    };
    this.paramsRowData = [newRow, ...this.paramsRowData];
    this.hasChanges = true;
    if (this.paramsGridApi) {
      this.paramsGridApi.setGridOption('rowData', this.paramsRowData);
      setTimeout(() => this.paramsGridApi.startEditingCell({ rowIndex: 0, colKey: 'parametros' }), 50);
    }
  }

  async saveChanges() {
    if (!this.idMolienda || !this.selectedBote) return;
    const newRows = this.paramsRowData.filter(r => r.__isNew);
    const modRows = this.paramsRowData.filter(r => r.__modified && !r.__isNew);
    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.productionService.createMoliendaParams({
          idMolienda:    this.idMolienda!,
          idBoteCatalog: this.selectedBote!.id,
          folio:         row.folio       || undefined,
          parametros:    row.parametros  || undefined,
          objetivo:      row.objetivo    ?? undefined,
          libLimpieza:   !!row.libLimpieza,
        }));
        row.id = created.id; row.__isNew = false; row.__modified = false;
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMoliendaParams(row.id, {
          folio:       row.folio       || undefined,
          parametros:  row.parametros  || undefined,
          objetivo:    row.objetivo    ?? undefined,
          libLimpieza: !!row.libLimpieza,
        }));
        row.__modified = false;
      }
      this.originalParamsRowData = JSON.parse(JSON.stringify(this.paramsRowData));
      this.hasChanges = false;
      if (this.paramsGridApi) this.paramsGridApi.setGridOption('rowData', this.paramsRowData);
    } catch (e) {
      console.error('Error guardando params:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    this.paramsRowData = JSON.parse(JSON.stringify(this.originalParamsRowData));
    this.hasChanges = false;
    this.selectedParamRow = null;
    if (this.paramsGridApi) this.paramsGridApi.setGridOption('rowData', this.paramsRowData);
  }

  async deleteRow() {
    if (!this.selectedParamRow) return;
    if (this.selectedParamRow.__isNew) {
      this.paramsRowData = this.paramsRowData.filter(r => r !== this.selectedParamRow);
      this.selectedParamRow = null;
      this.hasChanges = this.paramsRowData.some(r => r.__isNew || r.__modified);
      if (this.paramsGridApi) this.paramsGridApi.setGridOption('rowData', this.paramsRowData);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaParams(this.selectedParamRow.id));
      this.paramsRowData = this.paramsRowData.filter(r => r.id !== this.selectedParamRow!.id);
      this.originalParamsRowData = this.originalParamsRowData.filter(r => r.id !== this.selectedParamRow!.id);
      this.selectedParamRow = null;
      if (this.paramsGridApi) this.paramsGridApi.setGridOption('rowData', this.paramsRowData);
    } catch (e) {
      console.error('Error eliminando param:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }

  // ── Cálculos visuales de barriles ─────────────────────────────────────────

  totalPct(b: BoteVista): number {
    return b.volumen ? Math.min(100, (b.totalLiters / b.volumen) * 100) : 0;
  }
  minePct(b: BoteVista): number {
    return b.volumen ? Math.min(100, (b.myLiters / b.volumen) * 100) : 0;
  }
  externalPct(b: BoteVista): number {
    if (!b.volumen) return 0;
    return Math.min(100, Math.max(0, ((b.totalLiters - b.myLiters) / b.volumen) * 100));
  }
  disponible(b: BoteVista): number {
    return Math.max(0, b.volumen - b.totalLiters);
  }
}
