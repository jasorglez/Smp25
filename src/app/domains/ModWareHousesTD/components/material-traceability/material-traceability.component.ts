import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { catchError, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { MaterialsService } from 'app/services/materials.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { InandoutService } from 'app/services/inandout.service';
import { PermitionsService } from 'app/services/permitions.service';
import { RootService } from 'app/services/root.service';
import { PdfReportViewerComponent } from 'app/shared/pdf-report-viewer/pdf-report-viewer.component';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-material-traceability',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PdfReportViewerComponent],
  template: `
    <div class="p-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div><h5 class="mb-0"><i class="bi bi-diagram-3 me-2"></i>Trazabilidad de materiales</h5>
          <small class="text-muted">Requisiciones, órdenes de compra, entradas y salidas</small></div>
        <div class="d-flex align-items-center gap-3"><label class="form-check form-switch d-flex align-items-center gap-2 mb-0 small text-nowrap">
          <input class="form-check-input m-0" type="checkbox" [(ngModel)]="showZeroInventory" (ngModelChange)="applyInventoryFilter()">
          <span>Mostrar inventario en cero <span class="badge bg-light text-secondary">{{ zeroInventoryCount }}</span></span>
        </label>
        <button class="btn btn-sm btn-outline-primary" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>
        <button class="btn btn-sm btn-danger" (click)="previewPdf()" [disabled]="loading || pdfGenerating || dataWarnings.length > 0 || !rowData.length"><i class="bi bi-file-earmark-pdf"></i> {{ pdfGenerating ? 'Preparando…' : 'Ver PDF' }}</button></div>
      </div>
      <div class="alert alert-info py-2" *ngIf="!projectId">Selecciona un proyecto para consultar sus movimientos.</div>
      <div class="alert alert-warning py-2 small" *ngIf="dataWarnings.length" role="alert">
        <strong>La trazabilidad está incompleta y no se puede conciliar.</strong>
        <div *ngFor="let warning of dataWarnings">{{ warning }}</div>
        <span>Actualiza la consulta antes de generar el PDF.</span>
      </div>
      <div class="text-muted py-4 text-center" *ngIf="loading"><span class="spinner-border spinner-border-sm me-2"></span>Preparando trazabilidad...</div>
      <ag-grid-angular *ngIf="!loading && !pdfPreviewUrl" class="ag-theme-quartz small-text-ag-grid" style="width:100%;height:78vh"
        [rowData]="rowData" [columnDefs]="columnDefs" [defaultColDef]="defaultColDef" [autoGroupColumnDef]="autoGroupColumnDef"
        [pagination]="true" [paginationPageSize]="25" [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)" (columnResized)="onColumnResized($event)"></ag-grid-angular>
      <section *ngIf="pdfPreviewUrl" class="traceability-pdf-preview">
        <div class="traceability-pdf-preview__heading">
          <div><i class="bi bi-file-earmark-pdf me-2"></i>Vista previa · Trazabilidad de materiales</div>
          <button type="button" class="btn btn-sm btn-light" (click)="closePdfPreview()"><i class="bi bi-arrow-left me-1"></i>Volver a la tabla</button>
        </div>
        <div class="traceability-pdf-preview__viewer">
          <app-pdf-report-viewer [sourceUrl]="pdfPreviewUrl" title="Trazabilidad de materiales" fileName="Trazabilidad_Materiales.pdf"></app-pdf-report-viewer>
        </div>
      </section>
    </div>`
  ,
  styles: [`
    :host ::ng-deep .small-text-ag-grid { --ag-font-size: 10px; }
    .traceability-pdf-preview { margin-top: 16px; overflow: hidden; border: 1px solid #d9e2ec; border-radius: 12px; background: #fff; box-shadow: 0 8px 28px rgba(20, 47, 76, .08); }
    .traceability-pdf-preview__heading { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; color: #fff; background: linear-gradient(110deg, #173f68, #287aa5); font-size: 13px; font-weight: 700; }
    .traceability-pdf-preview__viewer { height: min(72vh, 760px); min-height: 360px; padding: 10px; }
  `]
})
export class MaterialTraceabilityComponent implements OnDestroy {
  private signals = inject(SignalsService);
  private tracking = inject(TrackingService);
  private materials = inject(MaterialsService);
  private docs = inject(OcAndReqsService);
  private movements = inject(InandoutService);
  private permissions = inject(PermitionsService);
  private roots = inject(RootService);
  idRoot: number | null = null;
  projectId: number | null = null;
  rowData: any[] = [];
  private allRows: any[] = [];
  showZeroInventory = false;
  loading = false;
  dataWarnings: string[] = [];
  pdfGenerating = false;
  pdfPreviewUrl: string | null = null;
  private defaultWarehouseName = '';
  gridApi!: GridApi;
  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly autoGroupColumnDef: ColDef = { headerName: 'Almacén / Material', minWidth: 300, flex: 2 };
  readonly columnDefs: ColDef[] = [
    { field: 'material', headerName: 'Descripción', minWidth: 360, width: 420, flex: 0, suppressSizeToFit: true },
    { field: 'marca', headerName: 'Marca', minWidth: 130 },
    { field: 'almacen', headerName: 'Almacén', rowGroup: true, hide: true },
    { field: 'unidad', headerName: 'Unidad', maxWidth: 110 },
    { field: 'requisicion', headerName: 'Requisición (cantidad)', minWidth: 180 },
    { field: 'oc', headerName: 'OC (cantidad)', minWidth: 170 },
    { field: 'entrada', headerName: 'Entrada', type: 'numericColumn', maxWidth: 110 },
    { field: 'salida', headerName: 'Salida', type: 'numericColumn', maxWidth: 110 },
    { field: 'inventario', headerName: 'Inventario', type: 'numericColumn', maxWidth: 120 },
    { field: 'movimientos', headerName: 'Movimientos', minWidth: 180 }
  ];

  constructor() {
    effect(() => {
      this.idRoot = this.signals.getRootSelectedBySidebar()();
      this.projectId = this.signals.getProjectSelectedBySidebar()();
      if (this.idRoot && this.tracking.getEmail()) this.load();
    });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    const savedWidth = this.getSavedDescriptionWidth();
    if (savedWidth) {
      event.api.applyColumnState({ state: [{ colId: 'material', width: savedWidth }], applyOrder: false });
    }
  }

  onColumnResized(event: any): void {
    if (!event.finished || event.column?.getColId() !== 'material') return;
    const width = event.column.getActualWidth();
    try { localStorage.setItem(this.descriptionWidthStorageKey(), String(width)); } catch { /* almacenamiento del navegador no disponible */ }
  }

  private getSavedDescriptionWidth(): number | null {
    try {
      const width = Number(localStorage.getItem(this.descriptionWidthStorageKey()));
      return Number.isFinite(width) && width >= 200 ? width : null;
    } catch { return null; }
  }

  private descriptionWidthStorageKey(): string {
    const user = (this.tracking.getEmail() || 'usuario').trim().toLocaleLowerCase();
    return `smp:${user}:material-traceability:description-width`;
  }

  ngOnDestroy(): void {
    this.releasePdfPreview();
  }

  load(): void {
    if (!this.idRoot) return;
    this.loading = true;
    this.dataWarnings = [];
    const warn = (message: string) => {
      if (!this.dataWarnings.includes(message)) this.dataWarnings = [...this.dataWarnings, message];
    };
    const reference = this.projectId || this.idRoot;
    forkJoin({
      materialList: this.materials.getMaterials2Fields(this.idRoot).pipe(catchError(() => { warn('No se pudo cargar el catálogo de materiales.'); return of([]); })),
      brands: this.materials.getMaterialBrands(this.idRoot).pipe(catchError(() => { warn('No se pudo cargar el catálogo de marcas.'); return of([]); })),
      requisitions: this.docs.getOcAndReqs('project', reference, 'REQUIS').pipe(catchError(() => { warn('No se pudieron cargar las requisiciones.'); return of([]); })),
      orders: this.docs.getOcAndReqs('project', reference, 'OC').pipe(catchError(() => { warn('No se pudieron cargar las órdenes de compra.'); return of([]); })),
      warehouses: this.permissions.getPermisionswarehousexEmail(this.tracking.getEmail()).pipe(catchError(() => { warn('No se pudieron cargar los almacenes autorizados.'); return of([]); }))
    }).pipe(switchMap(base => {
      const materialMap = new Map((this.asArray(base.materialList)).map((m: any) => [+m.id, m]));
      const brandMap = new Map(this.asArray(base.brands).map((brand: any) => [`${Number(brand.idMaterial)}|${Number(brand.id)}`, brand.brand]));
      const reqs = this.asArray(base.requisitions).filter((d: any) => d.active !== false && Number(d.active) !== 0);
      const orders = this.asArray(base.orders).filter((d: any) => d.active !== false && Number(d.active) !== 0);
      const documents$ = [...reqs, ...orders].map(d => this.docs.getReqItems(+d.id).pipe(
        catchError(() => { warn('No se pudieron cargar partidas de una requisición u orden de compra.'); return of([]); }),
        map(items => ({ d, items: this.asArray(items).filter((item: any) => item.active !== false && Number(item.active) !== 0), materialMap, brandMap }))
      ));
      const whs = this.asArray(base.warehouses);
      this.defaultWarehouseName = whs[0]?.nombreAlmacen || whs[0]?.name || whs[0]?.description || '';
      const movement$ = whs.flatMap(w => ['IN', 'OUT'].map(type => this.movements.getInAndOuts(reference, +(w.id || w.idWarehouse || w.idAlmacen), type).pipe(
        catchError(() => { warn('No se pudieron cargar algunos encabezados de entradas o salidas.'); return of([]); }),
        switchMap((masters: any) => {
        const rows = this.asArray(masters).filter((m: any) => m.active !== false && Number(m.active) !== 0);
        return rows.length ? forkJoin(rows.map(m => this.movements.getInAndOutItems(+m.id).pipe(
          catchError(() => { warn('No se pudieron cargar partidas de una entrada o salida.'); return of([]); }),
          map(details => ({ m, details: this.asArray(details).filter((detail: any) => detail.active !== false && Number(detail.active) !== 0) }))
        ))).pipe(map(details => ({ w, type, items: details, materialMap, brandMap }))) : of({ w, type, items: [], materialMap, brandMap });
      }))));
      return forkJoin({ documents: documents$.length ? forkJoin(documents$) : of([]), movements: movement$.length ? forkJoin(movement$) : of([]) });
    })).subscribe({
      next: result => { this.allRows = this.groupByMaterial([...this.flattenDocuments(result.documents), ...this.flattenMovements(result.movements)]); this.applyInventoryFilter(); this.loading = false; },
      error: () => { warn('No se pudo completar la consulta de trazabilidad.'); this.allRows = []; this.rowData = []; this.loading = false; }
    });
  }

  get zeroInventoryCount(): number {
    return this.allRows.filter(row => Math.abs(Number(row.inventario) || 0) <= 0.000001).length;
  }

  applyInventoryFilter(): void {
    this.rowData = this.showZeroInventory
      ? [...this.allRows]
      : this.allRows.filter(row => Math.abs(Number(row.inventario) || 0) > 0.000001);
  }

  private flattenDocuments(groups: any[]): any[] {
    return groups.flatMap(g => g.items.map((i: any) => {
      const materialId = Number(i.idSupplie || i.idProduct || 0);
      const brandId = i.idBrand == null ? null : Number(i.idBrand);
      return {
        materialId,
        brandId,
        material: i.nameArticle || i.materialName || i.description || g.materialMap.get(materialId)?.description || `Material #${materialId}`,
        marca: i.brandName || i.brand || (brandId ? g.brandMap.get(`${materialId}|${brandId}`) : '') || '',
        unidad: i.measure || i.unit || g.materialMap.get(materialId)?.measure || '',
        almacen: this.defaultWarehouseName || 'OAXACA',
        tipo: String(g.d.type || '').toUpperCase() === 'OC' ? 'Orden de compra' : 'Requisición',
        folio: g.d.folio, documento: g.d.id, fecha: g.d.dateCreate || g.d.datecreate,
        cantidad: i.quantity, proveedor: g.d.nameProvider || i.nameProvider || '', estado: g.d.close ? 'Cerrado' : 'Abierto'
      };
    }));
  }
  private flattenMovements(groups: any[]): any[] {
    return groups.flatMap(g => g.items.flatMap((entry: any) => entry.details.map((i: any) => {
      const materialId = Number(i.idProduct || 0);
      const brandId = i.idBrand == null ? null : Number(i.idBrand);
      return {
        materialId,
        brandId,
        material: i.materialName || i.description || g.materialMap.get(materialId)?.description || `Material #${materialId}`,
        marca: i.brand || i.brandName || (brandId ? g.brandMap.get(`${materialId}|${brandId}`) : '') || '',
        unidad: i.measure || i.unit || g.materialMap.get(materialId)?.measure || '',
        tipo: g.type === 'IN' ? 'Entrada' : 'Salida', folio: entry.m.folio, documento: entry.m.id,
        fecha: entry.m.date || entry.m.deliveryDate, cantidad: i.quantity || i.total,
        almacen: g.w.nombreAlmacen || g.w.name || g.w.description || g.w.nameWarehouse || this.defaultWarehouseName,
        estado: entry.m.active === false ? 'Inactivo' : 'Activo'
      };
    })));
  }
  private asArray(value: any): any[] { return Array.isArray(value) ? value : (value?.data || value?.result || value?.items || []); }

  private groupByMaterial(rows: any[]): any[] {
    const grouped = new Map<string, any>();
    rows.forEach(r => {
      const warehouse = String(r.almacen || 'General').trim();
      const marca = String(r.marca || '').trim();
      const materialKey = r.materialId ? `id:${r.materialId}` : `name:${String(r.material || '').trim().toUpperCase()}`;
      const brandKey = r.brandId ? `id:${r.brandId}` : `name:${marca.toUpperCase()}`;
      const key = `${warehouse}|${materialKey}|${brandKey}`;
      if (!key) return;
      const current = grouped.get(key) || { material: r.material, marca, almacen: warehouse, unidad: r.unidad, requisicion: '', oc: '', entrada: 0, salida: 0, inventario: 0, movimientos: '' };
      const folio = r.folio || r.documento || '';
      const documentWithQuantity = `${folio} (${Number(r.cantidad || 0)})`;
      if (r.tipo === 'Requisición') current.requisicion = this.joinUnique(current.requisicion, documentWithQuantity);
      else if (r.tipo === 'Orden de compra') current.oc = this.joinUnique(current.oc, documentWithQuantity);
      else if (r.tipo === 'Entrada') current.entrada += Number(r.cantidad || 0);
      else if (r.tipo === 'Salida') current.salida += Number(r.cantidad || 0);
      current.inventario = current.entrada - current.salida;
      if (r.tipo === 'Entrada' || r.tipo === 'Salida') current.movimientos = this.joinUnique(current.movimientos, `${r.tipo}: ${folio}`);
      grouped.set(key, current);
    });
    return [...grouped.values()];
  }

  private joinUnique(existing: string, value: string): string {
    if (!value) return existing || '';
    return existing ? (existing.split(', ').includes(value) ? existing : `${existing}, ${value}`) : value;
  }

  async previewPdf(): Promise<void> {
    if (this.dataWarnings.length) return;
    this.pdfGenerating = true;
    let companyName = this.tracking.getnameComp() || this.tracking.getCompany() || '';
    let companyLogo = '';
    if (this.idRoot) {
      try {
        const company: any = await firstValueFrom(this.roots.getRootbyId(this.idRoot));
        companyName = company?.name || companyName;
        if (company?.picture) companyLogo = await this.convertImageToBase64(company.picture);
      } catch (error) {
        console.warn('No se pudo cargar el logo o nombre de la empresa para el PDF de trazabilidad.', error);
      }
    }
    const body: any[] = [[
      { text: 'Material', bold: true, color: '#fff' }, { text: 'Marca', bold: true, color: '#fff' }, { text: 'Unidad', bold: true, color: '#fff' },
      { text: 'Requisición (cantidad)', bold: true, color: '#fff' }, { text: 'OC (cantidad)', bold: true, color: '#fff' },
      { text: 'Entrada', bold: true, color: '#fff' }, { text: 'Salida', bold: true, color: '#fff' },
      { text: 'Inventario', bold: true, color: '#fff' }, { text: 'Movimientos', bold: true, color: '#fff' }
    ]];
    this.rowData.forEach((r, i) => body.push([
      `${r.almacen || 'General'} / ${r.material || ''}`, r.marca || '', r.unidad || '', r.requisicion || '', r.oc || '',
      r.entrada || 0, r.salida || 0, r.inventario || 0, r.movimientos || ''
    ].map((text: any) => ({ text, fontSize: 7, fillColor: i % 2 ? '#f4f7fb' : '#fff' }))));
    const centeredHeader: any[] = [];
    if (companyName) centeredHeader.push({ text: companyName, alignment: 'center', color: '#003366', bold: true, fontSize: 13, margin: [0, 0, 0, 2] });
    centeredHeader.push({ text: 'TRAZABILIDAD DE MATERIALES', alignment: 'center', color: '#1a5a9a', bold: true, fontSize: 11 });
    const doc: any = {
      pageOrientation: 'landscape', pageSize: 'LEGAL', pageMargins: [24, 100, 24, 35],
      header: () => ({
        margin: [24, 10, 24, 0],
        columns: [
          companyLogo ? { image: companyLogo, fit: [100, 42], width: 100, alignment: 'left' } : { text: '', width: 100 },
          { stack: centeredHeader, width: '*', alignment: 'center' },
          { text: '', width: 100 }
        ]
      }),
      content: [{ text: `Proyecto: ${this.projectId || 'Todos'}   |   Generado: ${new Date().toLocaleString('es-MX')}`, fontSize: 8, color: '#555', margin: [0, 0, 0, 10] }, { table: { headerRows: 1, widths: ['*', 70, 55, 130, 100, 65, 65, 75, 170], body }, layout: { fillColor: (row: number) => row === 0 ? '#1a5a9a' : null, hLineColor: () => '#d5dbe3', vLineColor: () => '#d5dbe3', paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 } }],
      footer: (current: number, total: number) => ({ text: `Trazabilidad de materiales · Página ${current} de ${total}`, alignment: 'center', fontSize: 8, color: '#777' })
    };
    try {
      pdfMake.createPdf(doc).getBlob((blob: Blob) => {
        this.releasePdfPreview();
        this.pdfPreviewUrl = URL.createObjectURL(blob);
        this.pdfGenerating = false;
      });
    } catch (error) {
      console.error('No se pudo generar el PDF de trazabilidad:', error);
      this.pdfGenerating = false;
    }
  }

  private convertImageToBase64(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith('data:image/')) return Promise.resolve(imageUrl);
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => resolve('');
      image.src = imageUrl;
    });
  }

  closePdfPreview(): void {
    this.releasePdfPreview();
    this.pdfPreviewUrl = null;
  }

  private releasePdfPreview(): void {
    if (this.pdfPreviewUrl) {
      URL.revokeObjectURL(this.pdfPreviewUrl);
      this.pdfPreviewUrl = null;
    }
  }
}
