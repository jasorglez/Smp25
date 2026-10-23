import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { InandoutService } from 'app/services/inandout.service';
import { MaterialsService } from 'app/services/materials.service';
import { PermitionsService } from 'app/services/permitions.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="p-3 kardex-page">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div><h5 class="mb-1"><i class="bi bi-journal-arrow-up me-2 text-primary"></i>Kardex de materiales</h5>
          <small class="text-muted">Historial cronológico de entradas, salidas, traspasos y ajustes por material y marca.</small></div>
        <button class="btn btn-sm btn-outline-primary" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>
      </div>
      <div class="filters card card-body py-2 mb-2">
        <div class="row g-2 align-items-end">
          <div class="col-xl-4 col-md-6"><label class="form-label">Material / marca</label><input class="form-control form-control-sm" [(ngModel)]="materialSearch" (ngModelChange)="applyFilters()" placeholder="Buscar por código, descripción o marca"></div>
          <div class="col-xl-3 col-md-6"><label class="form-label">Almacén</label><select class="form-select form-select-sm" [(ngModel)]="warehouseFilter" (ngModelChange)="applyFilters()"><option value="">Todos los almacenes</option><option *ngFor="let w of warehouses" [value]="warehouseId(w)">{{warehouseName(w)}}</option></select></div>
          <div class="col-xl-2 col-6"><label class="form-label">Desde</label><input class="form-control form-control-sm" type="date" [(ngModel)]="dateFrom" (ngModelChange)="applyFilters()"></div>
          <div class="col-xl-2 col-6"><label class="form-label">Hasta</label><input class="form-control form-control-sm" type="date" [(ngModel)]="dateTo" (ngModelChange)="applyFilters()"></div>
          <div class="col-xl-1 col-12"><button class="btn btn-sm btn-light w-100" (click)="clearFilters()"><i class="bi bi-x-circle me-1"></i>Limpiar</button></div>
        </div>
      </div>
      <div class="alert alert-info py-2" *ngIf="materialIdFilter">Kardex filtrado por material seleccionado. <button class="btn btn-link btn-sm p-0 ms-1" (click)="clearMaterialFilter()">Ver todos</button></div>
      <div class="alert alert-warning py-2" *ngIf="!projectId">Selecciona un proyecto en el menú lateral para consultar sus movimientos.</div>
      <div class="text-muted py-5 text-center" *ngIf="loading"><span class="spinner-border spinner-border-sm me-2"></span>Cargando movimientos...</div>
      <div class="alert alert-light border text-center" *ngIf="!loading && !allRows.length">No se encontraron movimientos de entradas o salidas para este proyecto.</div>
      <ag-grid-angular *ngIf="!loading && allRows.length" class="ag-theme-quartz small-text-ag-grid" style="width:100%;height:70vh"
        [rowData]="rowData" [columnDefs]="columnDefs" [defaultColDef]="defaultColDef" [pagination]="true" [paginationPageSize]="50"
        [localeText]="AG_GRID_LOCALE_ES" (gridReady)="onGridReady($event)"></ag-grid-angular>
    </div>`,
  styles: [`
    :host ::ng-deep .small-text-ag-grid { --ag-font-size: 11px; }
    .filters { background: #f8fafc; border-color: #e2e8f0; }
    .form-label { font-size: 11px; margin-bottom: 3px; color: #475569; }
  `]
})
export class KardexComponent {
  private readonly signals = inject(SignalsService);
  private readonly tracking = inject(TrackingService);
  private readonly movementService = inject(InandoutService);
  private readonly permissions = inject(PermitionsService);
  private readonly materialsService = inject(MaterialsService);
  private readonly route = inject(ActivatedRoute);
  idRoot: number | null = null;
  projectId: number | null = null;
  materialIdFilter: number | null = null;
  warehouses: any[] = [];
  allRows: any[] = [];
  rowData: any[] = [];
  loading = false;
  materialSearch = '';
  warehouseFilter = '';
  dateFrom = '';
  dateTo = '';
  gridApi?: GridApi;
  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 105 };
  readonly columnDefs: ColDef[] = [
    { field: 'fecha', headerName: 'Fecha', minWidth: 150, sort: 'desc', valueFormatter: p => this.formatDate(p.value) },
    { field: 'folio', headerName: 'Folio', minWidth: 125 },
    { field: 'tipo', headerName: 'Movimiento', minWidth: 150 },
    { field: 'codigo', headerName: 'Código', minWidth: 130 },
    { field: 'material', headerName: 'Material', minWidth: 260, flex: 2 },
    { field: 'marca', headerName: 'Marca', minWidth: 140 },
    { field: 'almacen', headerName: 'Almacén', minWidth: 170 },
    { field: 'entrada', headerName: 'Entrada', type: 'numericColumn', minWidth: 105, valueFormatter: p => this.formatQty(p.value) },
    { field: 'salida', headerName: 'Salida', type: 'numericColumn', minWidth: 105, valueFormatter: p => this.formatQty(p.value) },
    { field: 'saldo', headerName: 'Saldo acumulado', type: 'numericColumn', minWidth: 140, valueFormatter: p => this.formatQty(p.value) },
    { field: 'referencia', headerName: 'Referencia / nota', minWidth: 180 }
  ];

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('materialId'));
      this.materialIdFilter = Number.isFinite(id) && id > 0 ? id : null;
      this.applyFilters();
    });
    effect(() => {
      const root = this.signals.getRootSelectedBySidebar()();
      const project = this.signals.getProjectSelectedBySidebar()();
      if (root !== this.idRoot || project !== this.projectId) {
        this.idRoot = root;
        this.projectId = project;
        if (root) this.load();
      }
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; }

  load(): void {
    if (!this.idRoot || !this.projectId) return;
    this.loading = true;
    const reference = Number(this.projectId);
    this.permissions.getPermisionswarehousexEmail(this.tracking.getEmail()).pipe(
      catchError(() => of([])),
      switchMap((raw: any) => {
        this.warehouses = this.asArray(raw);
        const requests = this.warehouses.flatMap(w => ['IN', 'OUT'].map(type =>
          this.movementService.getInAndOuts(reference, this.warehouseId(w), type).pipe(
            catchError(error => { console.warn('[Kardex] No se pudieron cargar encabezados', { warehouse: this.warehouseId(w), type, error }); return of([]); }),
            map((masters: any) => ({ warehouse: w, type, masters: this.asArray(masters) }))
          )
        ));
        return requests.length ? forkJoin(requests) : of([]);
      }),
      switchMap(groups => {
        const masters = this.asArray(groups).flatMap((g: any) => g.masters.map((m: any) => ({ ...m, __warehouse: g.warehouse, __movementType: g.type })));
        const details$ = masters.map(m => this.movementService.getInAndOutItems(Number(m.id)).pipe(
          catchError(error => { console.warn('[Kardex] No se pudieron cargar partidas', { id: m.id, error }); return of([]); }),
          map((items: any) => ({ master: m, items: this.asArray(items) }))
        ));
        return forkJoin({ masters: of(masters), details: details$.length ? forkJoin(details$) : of([]) });
      }),
      switchMap(result => this.materialsService.getMaterials2Fields(this.idRoot!).pipe(
        catchError(() => of([])), map((materials: any) => ({ ...result, materials: this.asArray(materials) }))
      ))
    ).subscribe({
      next: result => {
        const materialMap = new Map(result.materials.map((m: any) => [Number(m.id), m]));
        const rows = result.details.flatMap((group: any) => group.items.map((item: any) => {
          const materialId = Number(item.idProduct || item.idSupplie || 0);
          const material = materialMap.get(materialId) as any;
          const quantity = Number(item.quantity ?? item.total ?? item.amount ?? 0);
          const isIn = group.master.__movementType === 'IN';
          const date = group.master.date || group.master.deliveryDate || group.master.dateCreate || group.master.datecreate;
          return {
            fechaRaw: date, fecha: date, folio: group.master.folio || group.master.number || group.master.id,
            tipo: this.getMovementLabel(group.master, isIn), materialId,
            codigo: material?.insumo || material?.code || material?.barcode || item.code || '',
            material: item.materialName || item.description || item.nameArticle || material?.description || `Material #${materialId}`,
            marca: item.brand || item.brandName || item.nameBrand || '',
            brandId: Number(item.idBrand || item.brandId || 0),
            warehouseId: this.warehouseId(group.master.__warehouse),
            almacen: this.warehouseName(group.master.__warehouse),
            entrada: isIn ? quantity : 0, salida: isIn ? 0 : quantity, saldo: 0,
            referencia: group.master.notes || group.master.observation || group.master.comments || ''
          };
        }));
        this.allRows = this.addRunningBalances(rows);
        this.applyFilters();
        this.loading = false;
      },
      error: error => { console.error('[Kardex] Error cargando movimientos', error); this.allRows = []; this.rowData = []; this.loading = false; }
    });
  }

  private addRunningBalances(rows: any[]): any[] {
    const ordered = [...rows].sort((a, b) => this.toTimestamp(a.fechaRaw) - this.toTimestamp(b.fechaRaw) || String(a.folio).localeCompare(String(b.folio), 'es', { numeric: true }));
    const balances = new Map<string, number>();
    for (const row of ordered) {
      const key = `${row.warehouseId}|${row.materialId}|${row.brandId || row.marca}`;
      const balance = (balances.get(key) || 0) + Number(row.entrada || 0) - Number(row.salida || 0);
      row.saldo = balance;
      balances.set(key, balance);
    }
    return ordered.reverse();
  }

  applyFilters(): void {
    const term = this.materialSearch.trim().toLocaleLowerCase();
    const from = this.dateFrom ? new Date(`${this.dateFrom}T00:00:00`).getTime() : null;
    const to = this.dateTo ? new Date(`${this.dateTo}T23:59:59`).getTime() : null;
    this.rowData = this.allRows.filter(row => {
      const timestamp = this.toTimestamp(row.fechaRaw);
      return (!this.materialIdFilter || row.materialId === this.materialIdFilter)
        && (!this.warehouseFilter || String(row.warehouseId) === this.warehouseFilter)
        && (!term || `${row.codigo} ${row.material} ${row.marca}`.toLocaleLowerCase().includes(term))
        && (from === null || timestamp >= from) && (to === null || timestamp <= to);
    });
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  clearFilters(): void { this.materialSearch = ''; this.warehouseFilter = ''; this.dateFrom = ''; this.dateTo = ''; this.applyFilters(); }
  clearMaterialFilter(): void { this.materialIdFilter = null; this.applyFilters(); }
  warehouseId(w: any): number { return Number(w?.idAlmacen ?? w?.idWarehouse ?? w?.warehouseId ?? w?.id ?? 0); }
  warehouseName(w: any): string { return w?.nombreAlmacen || w?.nameWarehouse || w?.name || w?.description || `Almacén ${this.warehouseId(w)}`; }
  private asArray(value: any): any[] { return Array.isArray(value) ? value : (value?.data || value?.result || value?.items || []); }
  private toTimestamp(value: any): number { const date = value ? new Date(value).getTime() : 0; return Number.isFinite(date) ? date : 0; }
  private formatDate(value: any): string { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('es-MX') : ''; }
  private formatQty(value: any): string { return Number(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 4 }); }
  private getMovementLabel(master: any, isIn: boolean): string {
    const kind = String(master.movementName || master.typeName || master.descriptionType || master.typeDescription || '').trim();
    return kind || (isIn ? 'Entrada' : 'Salida');
  }
}
