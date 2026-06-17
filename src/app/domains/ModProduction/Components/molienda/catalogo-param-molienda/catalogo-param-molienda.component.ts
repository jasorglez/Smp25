import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialXModuloService } from 'app/services/materialxmodulo.service';
import { MaterialsService } from 'app/services/materials.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-catalogo-param-molienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:10px;">

      <!-- ─── Panel superior: lista de parámetros ─── -->
      <div style="display:flex;flex-direction:column;flex:0 0 auto;min-height:220px;max-height:38vh;">

        <div class="d-flex align-items-center justify-content-between mb-1">
          <h6 class="mb-0 text-primary">
            <i class="bi bi-sliders me-1"></i>Parámetros de Molienda
          </h6>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-success" (click)="addParam()" [disabled]="!paramGridApi">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="saveParams()" [disabled]="!paramHasChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span *ngIf="paramHasChanges"
                    class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
            </button>
            <button class="btn btn-sm btn-warning" (click)="revertParams()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteParam()" [disabled]="!selectedParam">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>

        <div style="flex:1 1 auto;min-height:0;">
          <ag-grid-angular
            class="ag-theme-quartz"
            style="width:100%;height:100%;"
            [rowData]="paramRows"
            [columnDefs]="paramColDefs"
            [gridOptions]="paramGridOptions"
            (gridReady)="onParamGridReady($event)"
            (selectionChanged)="onParamSelected($event)"
            (cellValueChanged)="paramHasChanges = true">
          </ag-grid-angular>
        </div>
      </div>

      <!-- ─── Panel inferior: configuración por materia prima ─── -->
      <div style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0;border-top:2px solid #e0e0e0;padding-top:8px;">

        <div class="d-flex align-items-center justify-content-between mb-1" *ngIf="selectedParam">
          <h6 class="mb-0 text-secondary" style="font-size:0.85rem;">
            <i class="bi bi-table me-1"></i>
            Configuración por Materia Prima —
            <strong class="text-primary">{{ selectedParam?.nombre }}</strong>
          </h6>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveConfig()" [disabled]="!configHasChanges">
            <i class="bi bi-floppy"></i> Guardar config
            <span *ngIf="configHasChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
          </button>
        </div>

        <div *ngIf="!selectedParam"
             style="flex:1;display:flex;align-items:center;justify-content:center;color:#9e9e9e;font-size:0.85rem;">
          <div class="text-center">
            <i class="bi bi-hand-index-thumb" style="font-size:1.8rem;display:block;opacity:0.3;margin-bottom:6px;"></i>
            Selecciona un parámetro para configurar sus rangos por materia prima
          </div>
        </div>

        <div *ngIf="selectedParam && configLoading"
             style="flex:1;display:flex;align-items:center;justify-content:center;color:#9e9e9e;">
          <i class="bi bi-hourglass-split me-2"></i>Cargando…
        </div>

        <div *ngIf="selectedParam && !configLoading" style="flex:1 1 auto;min-height:0;">
          <ag-grid-angular
            class="ag-theme-quartz"
            style="width:100%;height:100%;"
            [rowData]="configRows"
            [columnDefs]="configColDefs"
            [gridOptions]="configGridOptions"
            (gridReady)="onConfigGridReady($event)"
            (cellValueChanged)="onConfigCellChanged()">
          </ag-grid-angular>
        </div>

      </div>
    </div>
  `,
})
export class CatalogoParamMoliendaComponent implements OnInit {
  private productionService = inject(ProductionService);
  private signalsService    = inject(SignalsService);
  private mxmService        = inject(MaterialXModuloService);
  private materialsService  = inject(MaterialsService);
  private cdr               = inject(ChangeDetectorRef);

  // ── Parámetros (master) ────────────────────────────────────────────────────
  paramGridApi!: GridApi;
  paramRows: any[] = [];
  private paramOriginal: any[] = [];
  paramHasChanges = false;
  selectedParam: any = null;

  paramColDefs: ColDef[] = [
    {
      field: 'nombre', headerName: 'Nombre del Parámetro',
      editable: true, flex: 1,
      valueSetter: (p: any) => { p.data.nombre = p.newValue; p.data.__modified = true; return true; },
    },
  ];

  paramGridOptions: any = {
    getRowId: (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight: 26, rowHeight: 24,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  // ── Config por materia prima (detail) ─────────────────────────────────────
  configGridApi!: GridApi;
  configRows: any[] = [];
  configHasChanges = false;
  configLoading = false;
  private articuloOptions: { id: number; name: string }[] = [];

  configColDefs: ColDef[] = [
    {
      field: 'articuloName', headerName: 'Materia Prima',
      editable: false, width: 220,
      cellStyle: { color: '#495057', fontWeight: '600', backgroundColor: '#f8f9fa' },
    },
    {
      field: 'active', headerName: 'Activo',
      editable: true, width: 90,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor:   'agCheckboxCellEditor',
      cellStyle: (p: any) => ({
        backgroundColor: p.value ? '#d4edda' : '#f8f9fa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }),
      valueSetter: (p: any) => { p.data.active = p.newValue; p.data.__modified = true; return true; },
    },
    {
      field: 'valorMin', headerName: 'Valor Mín',
      editable: (p: any) => !!p.data.active,
      width: 120,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.data.active && p.value != null ? Number(p.value).toFixed(4) : '—',
      cellStyle: (p: any) => ({ color: p.data.active ? '#000' : '#aaa' }),
      valueSetter: (p: any) => { p.data.valorMin = p.newValue ?? null; p.data.__modified = true; return true; },
    },
    {
      field: 'valorMax', headerName: 'Valor Máx',
      editable: (p: any) => !!p.data.active,
      width: 120,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.data.active && p.value != null ? Number(p.value).toFixed(4) : '—',
      cellStyle: (p: any) => ({ color: p.data.active ? '#000' : '#aaa' }),
      valueSetter: (p: any) => { p.data.valorMax = p.newValue ?? null; p.data.__modified = true; return true; },
    },
  ];

  configGridOptions: any = {
    getRowId: (p: any) => String(p.data.idArticulo),
    headerHeight: 26, rowHeight: 24,
    stopEditingWhenCellsLoseFocus: true,
  };

  // ── Init ──────────────────────────────────────────────────────────────────

  async ngOnInit() {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (idCompany) {
      const [mxm, mats] = await Promise.all([
        lastValueFrom(this.mxmService.getByType(idCompany, 'MOLIENDA')).catch(() => []),
        lastValueFrom(this.materialsService.getMaterialsxview(idCompany)).catch(() => []),
      ]);
      const nameMap = new Map<number, string>(
        ((mats ?? []) as any[]).map((m: any) => [m.id as number, (m.articulo ?? '') as string])
      );
      this.articuloOptions = ((mxm ?? []) as any[])
        .filter((m: any) => m.idArticulo != null)
        .map((m: any) => ({ id: m.idArticulo as number, name: nameMap.get(m.idArticulo) ?? `Art. ${m.idArticulo}` }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }
    await this.loadParams();
  }

  // ── Parámetros CRUD ───────────────────────────────────────────────────────

  async loadParams() {
    try {
      const items = await lastValueFrom(this.productionService.getMoliendaParamCatalog());
      const mapped = (items ?? []).map((i: any) => ({
        id: i.id, nombre: i.nombre ?? '',
        __isNew: false, __modified: false,
      }));
      this.paramOriginal = JSON.parse(JSON.stringify(mapped));
      this.paramRows = mapped;
      if (this.paramGridApi) this.paramGridApi.setGridOption('rowData', mapped);
    } catch (e) { console.error('Error cargando parámetros:', e); }
  }

  onParamGridReady(e: GridReadyEvent) {
    this.paramGridApi = e.api;
    if (this.paramRows.length) this.paramGridApi.setGridOption('rowData', this.paramRows);
  }

  onParamSelected(e: any) {
    const nodes = e.api.getSelectedNodes();
    const row = nodes.length ? nodes[0].data : null;
    if (row?.id !== this.selectedParam?.id) {
      this.selectedParam = row;
      this.cdr.detectChanges();
      if (row?.id) this.loadConfig(row.id);
      else { this.configRows = []; this.cdr.detectChanges(); }
    }
  }

  addParam() {
    const newRow = { id: null, __tempId: `new_${Date.now()}`, __isNew: true, __modified: false, nombre: '' };
    this.paramRows = [newRow, ...this.paramRows];
    this.paramHasChanges = true;
    if (this.paramGridApi) {
      this.paramGridApi.setGridOption('rowData', this.paramRows);
      setTimeout(() => this.paramGridApi.startEditingCell({ rowIndex: 0, colKey: 'nombre' }), 50);
    }
  }

  async saveParams() {
    const newRows = this.paramRows.filter(r => r.__isNew && r.nombre?.trim());
    const modRows = this.paramRows.filter(r => r.__modified && !r.__isNew);
    try {
      for (const row of newRows) {
        await lastValueFrom(this.productionService.createMoliendaParamCatalog({ nombre: row.nombre }));
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMoliendaParamCatalog(row.id, { nombre: row.nombre }));
      }
      this.paramHasChanges = false;
      // Recargar del servidor para que los IDs reales no generen duplicados en AG Grid
      await this.loadParams();
    } catch (e) { alerts.reqErrorToast('Error al guardar parámetros'); }
  }

  revertParams() {
    this.paramRows = JSON.parse(JSON.stringify(this.paramOriginal));
    this.paramHasChanges = false;
    this.selectedParam = null;
    this.configRows = [];
    if (this.paramGridApi) this.paramGridApi.setGridOption('rowData', this.paramRows);
  }

  async deleteParam() {
    if (!this.selectedParam) return;
    if (this.selectedParam.__isNew) {
      this.paramRows = this.paramRows.filter(r => r !== this.selectedParam);
      this.selectedParam = null; this.configRows = [];
      this.paramHasChanges = this.paramRows.some(r => r.__isNew || r.__modified);
      if (this.paramGridApi) this.paramGridApi.setGridOption('rowData', this.paramRows);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaParamCatalog(this.selectedParam.id));
      this.paramRows = this.paramRows.filter(r => r.id !== this.selectedParam!.id);
      this.paramOriginal = this.paramOriginal.filter(r => r.id !== this.selectedParam!.id);
      this.selectedParam = null; this.configRows = [];
      if (this.paramGridApi) this.paramGridApi.setGridOption('rowData', this.paramRows);
    } catch (e) { alerts.reqErrorToast('Error al eliminar'); }
  }

  // ── Config CRUD ───────────────────────────────────────────────────────────

  async loadConfig(idParam: number) {
    this.configLoading = true;
    this.configHasChanges = false;
    try {
      const existing = await lastValueFrom(
        this.productionService.getMoliendaParamConfigByParam(idParam)
      ).catch(() => [] as any[]);

      const existingMap = new Map<number, any>((existing as any[]).map(c => [c.idArticulo, c]));

      // Una fila por cada materia prima; si ya tiene config la usa, si no la inicializa apagada
      this.configRows = this.articuloOptions.map(art => {
        const cfg = existingMap.get(art.id);
        return {
          idArticulo:   art.id,
          articuloName: art.name,
          active:       cfg ? !!cfg.active   : false,
          valorMin:     cfg ? cfg.valorMin   ?? null : null,
          valorMax:     cfg ? cfg.valorMax   ?? null : null,
          __modified:   false,
        };
      });
      if (this.configGridApi) this.configGridApi.setGridOption('rowData', this.configRows);
    } catch (e) { console.error('Error cargando config:', e); }
    finally {
      this.configLoading = false;
      this.cdr.detectChanges();
    }
  }

  onConfigGridReady(e: GridReadyEvent) {
    this.configGridApi = e.api;
    if (this.configRows.length) this.configGridApi.setGridOption('rowData', this.configRows);
  }

  onConfigCellChanged() {
    this.configHasChanges = true;
    // Refrescar celdas para que editable y cellStyle se actualicen tras cambiar "active"
    if (this.configGridApi) this.configGridApi.refreshCells({ force: true });
  }

  async saveConfig() {
    if (!this.selectedParam?.id) return;
    const dirty = this.configRows.filter(r => r.__modified);
    try {
      for (const row of dirty) {
        await lastValueFrom(this.productionService.upsertMoliendaParamConfig({
          idParam:    this.selectedParam.id,
          idArticulo: row.idArticulo,
          valorMin:   row.active ? row.valorMin ?? undefined : undefined,
          valorMax:   row.active ? row.valorMax ?? undefined : undefined,
          active:     row.active,
        }));
        row.__modified = false;
      }
      this.configHasChanges = false;
    } catch (e) { alerts.reqErrorToast('Error al guardar configuración'); }
  }
}
