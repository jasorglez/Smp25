import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { MaterialsService } from 'app/services/materials.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { InandoutService } from 'app/services/inandout.service';
import { PermitionsService } from 'app/services/permitions.service';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-material-traceability',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="p-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div><h5 class="mb-0"><i class="bi bi-diagram-3 me-2"></i>Trazabilidad de materiales</h5>
          <small class="text-muted">Requisiciones, órdenes de compra, entradas y salidas</small></div>
        <div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>
        <button class="btn btn-sm btn-danger" (click)="printPdf()" [disabled]="loading || !rowData.length"><i class="bi bi-file-earmark-pdf"></i> PDF</button></div>
      </div>
      <div class="alert alert-info py-2" *ngIf="!projectId">Selecciona un proyecto para consultar sus movimientos.</div>
      <div class="text-muted py-4 text-center" *ngIf="loading"><span class="spinner-border spinner-border-sm me-2"></span>Preparando trazabilidad...</div>
      <ag-grid-angular *ngIf="!loading" class="ag-theme-quartz small-text-ag-grid" style="width:100%;height:78vh"
        [rowData]="rowData" [columnDefs]="columnDefs" [defaultColDef]="defaultColDef" [autoGroupColumnDef]="autoGroupColumnDef"
        [pagination]="true" [paginationPageSize]="25" [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="gridApi = $event.api"></ag-grid-angular>
    </div>`
})
export class MaterialTraceabilityComponent {
  private signals = inject(SignalsService);
  private tracking = inject(TrackingService);
  private materials = inject(MaterialsService);
  private docs = inject(OcAndReqsService);
  private movements = inject(InandoutService);
  private permissions = inject(PermitionsService);
  idRoot: number | null = null;
  projectId: number | null = null;
  rowData: any[] = [];
  loading = false;
  private defaultWarehouseName = '';
  gridApi!: GridApi;
  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };
  readonly autoGroupColumnDef: ColDef = { headerName: 'Almacén / Material', minWidth: 300, flex: 2 };
  readonly columnDefs: ColDef[] = [
    { field: 'material', headerName: 'Material', minWidth: 280, flex: 2 },
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

  load(): void {
    if (!this.idRoot) return;
    this.loading = true;
    const reference = this.projectId || this.idRoot;
    forkJoin({
      materialList: this.materials.getMaterials2Fields(this.idRoot).pipe(catchError(() => of([]))),
      requisitions: this.docs.getOcAndReqs('project', reference, 'REQUIS').pipe(catchError(() => of([]))),
      orders: this.docs.getOcAndReqs('project', reference, 'OC').pipe(catchError(() => of([]))),
      warehouses: this.permissions.getPermisionswarehousexEmail(this.tracking.getEmail()).pipe(catchError(() => of([])))
    }).pipe(switchMap(base => {
      const materialMap = new Map((this.asArray(base.materialList)).map((m: any) => [+m.id, m]));
      const reqs = this.asArray(base.requisitions); const orders = this.asArray(base.orders);
      const documents$ = [...reqs, ...orders].map(d => this.docs.getReqItems(+d.id).pipe(catchError(() => of([])), map(items => ({ d, items: this.asArray(items), materialMap }))));
      const whs = this.asArray(base.warehouses);
      this.defaultWarehouseName = whs[0]?.nombreAlmacen || whs[0]?.name || whs[0]?.description || '';
      const movement$ = whs.flatMap(w => ['IN', 'OUT'].map(type => this.movements.getInAndOuts(reference, +(w.id || w.idWarehouse || w.idAlmacen), type).pipe(catchError(() => of([])), switchMap((masters: any) => {
        const rows = this.asArray(masters);
        return rows.length ? forkJoin(rows.map(m => this.movements.getInAndOutItems(+m.id).pipe(catchError(() => of([])), map(details => ({ m, details: this.asArray(details) }))))).pipe(map(details => ({ w, type, items: details, materialMap }))) : of({ w, type, items: [], materialMap });
      }))));
      return forkJoin({ documents: documents$.length ? forkJoin(documents$) : of([]), movements: movement$.length ? forkJoin(movement$) : of([]) });
    })).subscribe({ next: result => { this.rowData = this.groupByMaterial([...this.flattenDocuments(result.documents), ...this.flattenMovements(result.movements)]); this.loading = false; }, error: () => { this.rowData = []; this.loading = false; } });
  }

  private flattenDocuments(groups: any[]): any[] {
    return groups.flatMap(g => g.items.map((i: any) => ({ material: i.nameArticle || i.materialName || i.description || g.materialMap.get(+i.idSupplie)?.description || `Material #${i.idSupplie}`, unidad: i.measure || i.unit || g.materialMap.get(+i.idSupplie)?.measure || '', almacen: this.defaultWarehouseName || 'OAXACA', tipo: String(g.d.type || '').toUpperCase() === 'OC' ? 'Orden de compra' : 'Requisición', folio: g.d.folio, documento: g.d.id, fecha: g.d.dateCreate || g.d.datecreate, cantidad: i.quantity, proveedor: g.d.nameProvider || i.nameProvider || '', estado: g.d.close ? 'Cerrado' : 'Abierto' })));
  }
  private flattenMovements(groups: any[]): any[] {
    return groups.flatMap(g => g.items.flatMap((entry: any) => entry.details.map((i: any) => ({ material: i.materialName || i.description || g.materialMap.get(+i.idProduct)?.description || `Material #${i.idProduct}`, unidad: i.measure || i.unit || g.materialMap.get(+i.idProduct)?.measure || '', tipo: g.type === 'IN' ? 'Entrada' : 'Salida', folio: entry.m.folio, documento: entry.m.id, fecha: entry.m.date || entry.m.deliveryDate, cantidad: i.quantity || i.total, almacen: g.w.nombreAlmacen || g.w.name || g.w.description || g.w.nameWarehouse || this.defaultWarehouseName, estado: entry.m.active === false ? 'Inactivo' : 'Activo' }))));
  }
  private asArray(value: any): any[] { return Array.isArray(value) ? value : (value?.data || value?.result || value?.items || []); }

  private groupByMaterial(rows: any[]): any[] {
    const grouped = new Map<string, any>();
    rows.forEach(r => {
      const warehouse = String(r.almacen || 'General').trim();
      const key = `${warehouse}|${String(r.material || '').trim().toUpperCase()}`;
      if (!key) return;
      const current = grouped.get(key) || { material: r.material, almacen: warehouse, unidad: r.unidad, requisicion: '', oc: '', entrada: 0, salida: 0, inventario: 0, movimientos: '' };
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

  printPdf(): void {
    const body: any[] = [[
      { text: 'Material', bold: true, color: '#fff' }, { text: 'Unidad', bold: true, color: '#fff' },
      { text: 'Requisición (cantidad)', bold: true, color: '#fff' }, { text: 'OC (cantidad)', bold: true, color: '#fff' },
      { text: 'Entrada', bold: true, color: '#fff' }, { text: 'Salida', bold: true, color: '#fff' },
      { text: 'Inventario', bold: true, color: '#fff' }, { text: 'Movimientos', bold: true, color: '#fff' }
    ]];
    this.rowData.forEach((r, i) => body.push([
      `${r.almacen || 'General'} / ${r.material || ''}`, r.unidad || '', r.requisicion || '', r.oc || '',
      r.entrada || 0, r.salida || 0, r.inventario || 0, r.movimientos || ''
    ].map((text: any) => ({ text, fontSize: 7, fillColor: i % 2 ? '#f4f7fb' : '#fff' }))));
    const doc: any = {
      pageOrientation: 'landscape', pageSize: 'LETTER', pageMargins: [24, 60, 24, 35],
      header: () => ({ margin: [24, 18, 24, 0], columns: [{ text: 'AZTECA', color: '#003366', bold: true, fontSize: 16 }, { text: 'TRAZABILIDAD DE MATERIALES', alignment: 'right', color: '#1a5a9a', bold: true, fontSize: 12 }] }),
      content: [{ text: `Proyecto: ${this.projectId || 'Todos'}   |   Generado: ${new Date().toLocaleString('es-MX')}`, fontSize: 8, color: '#555', margin: [0, 0, 0, 10] }, { table: { headerRows: 1, widths: ['*', 55, 130, 100, 65, 65, 75, 170], body }, layout: { fillColor: (row: number) => row === 0 ? '#1a5a9a' : null, hLineColor: () => '#d5dbe3', vLineColor: () => '#d5dbe3', paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 } }],
      footer: (current: number, total: number) => ({ text: `Trazabilidad de materiales · Página ${current} de ${total}`, alignment: 'center', fontSize: 8, color: '#777' })
    };
    pdfMake.createPdf(doc).print();
  }
}
