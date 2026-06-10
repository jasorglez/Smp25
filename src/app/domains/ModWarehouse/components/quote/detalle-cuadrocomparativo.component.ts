import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const LBLUE = '#e8f0f8';
const GREEN = '#155724';
const GRAY  = '#555555';

@Component({
  selector: 'app-detalle-cuadrocomparativo',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 12px; height: 100%; background: #f0f4ff;">

      <div *ngIf="loading" class="d-flex align-items-center justify-content-center gap-2 py-4">
        <div class="spinner-border spinner-border-sm text-primary"></div>
        <span class="text-muted small">Cargando cuadro comparativo...</span>
      </div>

      <ng-container *ngIf="!loading">
        <!-- Barra superior -->
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-table text-primary"></i>
          <strong class="text-primary small">Cuadro Comparativo de Precios</strong>
          <span class="badge bg-secondary">{{ rowData.length }} materiales</span>

          <!-- Botón PDF -->
          <button class="btn btn-sm btn-danger ms-2" (click)="generatePdf()" title="Exportar PDF">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>

          <!-- Botón cerrar -->
          <button class="btn btn-sm btn-outline-secondary ms-auto" (click)="closeDetail()" title="Cerrar">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div *ngIf="rowData.length === 0" class="text-center text-muted py-3 small">
          <i class="bi bi-info-circle me-1"></i>
          Sin datos — los proveedores aún no han cotizado items.
        </div>

        <ag-grid-angular *ngIf="rowData.length > 0"
          style="width: 100%; height: 300px;"
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="innerGridOptions"
          [pinnedBottomRowData]="pinnedTotals"
          (gridReady)="onGridReady($event)"
        ></ag-grid-angular>
      </ng-container>

    </div>
  `
})
export class DetalleCuadroComparativoComponent implements ICellRendererAngularComp {
  private quotesService = inject(OcAndReqsService);
  private rootService   = inject(RootService);
  private b64Service    = inject(Base64EncodeService);

  private params: any;
  private quoteRow: any;
  private activeProviders: any[] = [];

  loading = true;
  rowData: any[] = [];
  colDefs: ColDef[] = [];
  pinnedTotals: any[] = [];

  innerGridOptions: any = {
    headerHeight: 25,
    rowHeight: 42,
    suppressRowClickSelection: true,
    defaultColDef: { resizable: true, sortable: false }
  };

  agInit(params: any): void {
    this.params   = params;
    this.quoteRow = params.data;
    this.loadData(params.data);
  }

  refresh(): boolean { return false; }

  onGridReady(event: GridReadyEvent) {
    event.api.sizeColumnsToFit();
  }

  closeDetail(): void {
    const api  = this.quoteRow?._masterGridApi;
    const qid  = this.quoteRow?.id;
    if (api) {
      api.forEachNode((node: any) => {
        if (node.data?.id === qid) node.setExpanded(false);
      });
    }
  }

  // ==================== LOAD DATA ====================

  private async loadData(rowData: any) {
    this.loading = true;

    const STYLES = [
      { bg: '#dbeafe', border: '#3b82f6' },
      { bg: '#dcfce7', border: '#22c55e' },
      { bg: '#fef9c3', border: '#eab308' },
    ];

    this.activeProviders = [
      { slot: 1, cotizId: rowData.proveedor1CotizId, name: rowData.proveedor1Name || 'Proveedor 1', style: STYLES[0] },
      { slot: 2, cotizId: rowData.proveedor2CotizId, name: rowData.proveedor2Name || 'Proveedor 2', style: STYLES[1] },
      { slot: 3, cotizId: rowData.proveedor3CotizId, name: rowData.proveedor3Name || 'Proveedor 3', style: STYLES[2] },
    ].filter(p => p.cotizId > 0);

    try {
      const allItems: any[] = [];
      for (const prov of this.activeProviders) {
        const items: any[] = await lastValueFrom(this.quotesService.getReqItems(prov.cotizId));
        items.forEach(item => allItems.push({ ...item, providerSlot: prov.slot }));
      }

      const productMap = new Map<number, any>();
      allItems.forEach(item => {
        if (!productMap.has(item.idSupplie)) {
          productMap.set(item.idSupplie, {
            productName: item.productName || item.description || `Producto ${item.idSupplie}`,
            p1: null, p2: null, p3: null
          });
        }
        const entry = productMap.get(item.idSupplie);
        entry[`p${item.providerSlot}`] = {
          price: item.price ?? 0,
          total: (item.quantity ?? 0) * (item.price ?? 0),
          quantity: item.quantity ?? 0
        };
      });

      this.rowData = Array.from(productMap.values());
      this.buildColDefs(this.activeProviders);
      this.buildPinnedTotals(this.activeProviders);
    } catch (e) {
      console.error('Error loading comparison detail', e);
      this.rowData = [];
    }

    this.loading = false;
  }

  // ==================== GRID COLUMNS ====================

  private buildColDefs(providers: any[]) {
    this.colDefs = [
      {
        headerName: '#',
        valueGetter: (p: any) => p.node?.rowPinned ? '' : (p.node?.rowIndex ?? 0) + 1,
        width: 50,
        pinned: 'left',
        cellStyle: { textAlign: 'center', color: '#999' }
      },
      {
        field: 'productName',
        headerName: 'Material',
        flex: 2,
        minWidth: 160,
        pinned: 'left',
        cellStyle: (p: any) => p.node?.rowPinned
          ? { fontWeight: 'bold', textAlign: 'right', paddingRight: '8px' }
          : {}
      }
    ];

    providers.forEach(prov => {
      const slot = prov.slot;
      this.colDefs.push({
        headerName: prov.name,
        field: `p${slot}`,
        width: 75,
        cellRenderer: (params: any) => {
          if (params.node?.rowPinned) {
            const total = params.value ?? 0;
            return `<div style="text-align:right;padding:2px 4px;font-size:9px;font-weight:bold;color:${GREEN};">
                      $${Number(total).toFixed(2)}
                    </div>`;
          }
          const data = params.value;
          if (!data) return '<span style="color:#bbb;font-size:8px;padding:2px 4px;">N/C</span>';
          const best   = this.isBestPrice(params.node?.data, slot);
          const color  = best ? GREEN : '#555';
          const weight = best ? 'bold' : 'normal';
          const check  = best ? ' ✓' : '';
          return `<div style="text-align:right;padding:1px 4px;line-height:1.3;">
                    <div style="font-size:8px;color:#999;">$${Number(data.price).toFixed(1)} × ${data.quantity}</div>
                    <div style="font-size:9px;font-weight:${weight};color:${color};">= $${Number(data.total).toFixed(1)}${check}</div>
                  </div>`;
        },
        cellStyle: (params: any) => {
          if (params.node?.rowPinned) {
            return { background: '#d4edda', borderLeft: `3px solid ${prov.style.border}` };
          }
          return this.isBestPrice(params.data, slot)
            ? { background: '#d4edda', borderLeft: `3px solid ${prov.style.border}` }
            : { background: prov.style.bg };
        }
      });
    });
  }

  private buildPinnedTotals(providers: any[]) {
    const row: any = { productName: 'TOTAL' };
    providers.forEach(prov => {
      row[`p${prov.slot}`] = this.rowData.reduce(
        (sum, r) => sum + (r[`p${prov.slot}`]?.total ?? 0), 0
      );
    });
    this.pinnedTotals = [row];
  }

  private isBestPrice(rowData: any, slot: number): boolean {
    if (!rowData) return false;
    const prices = [rowData.p1?.price, rowData.p2?.price, rowData.p3?.price]
      .filter((p): p is number => p != null && p > 0);
    if (prices.length === 0) return false;
    return rowData[`p${slot}`]?.price === Math.min(...prices);
  }

  // ==================== PDF ====================

  async generatePdf(): Promise<void> {
    const q      = this.quoteRow;
    const idRoot = q._idRoot;
    const depts  = q._departamentos ?? [];
    const reqs   = q._requisiciones ?? [];

    // Datos empresa
    let rootData: any = {};
    try {
      rootData = await lastValueFrom(this.rootService.getRootbyId(idRoot));
    } catch { /* sin datos empresa */ }

    // Logos — convertImageToBase64 resuelve siempre (fallback interno si falla)
    const logoB64  = await this.b64Service.convertImageToBase64(rootData?.picture  ?? '');
    const logo2B64 = rootData?.picture2
      ? await this.b64Service.convertImageToBase64(rootData.picture2)
      : logoB64;   // fallback al logo principal si no hay logo2

    const companyName  = rootData?.name    ?? rootData?.company ?? 'Empresa';
    const companyRfc   = rootData?.rfc     ?? '';
    const companyAddr  = rootData?.address ?? rootData?.city ?? '';
    const companyTel   = rootData?.phone   ?? rootData?.tel ?? '';
    const companyEmail = rootData?.email   ?? '';

    const deptName = depts.find((d: any) => d.id === q.idDepartament)?.description ?? '';
    const reqFolio = reqs.find((r: any)  => r.id === q.idReq)?.folio ?? q.idReq ?? '';
    const fecha    = q.dateCreate ? String(q.dateCreate).substring(0, 10) : '';

    // ── ENCABEZADO (logos por nombre, diccionario images:) ──
    const header: any = {
      columns: [
        { image: 'logo',  width: 80, alignment: 'left'  },
        {
          stack: [
            { text: companyName.toUpperCase(), fontSize: 11, bold: true, color: NAVY, alignment: 'center' },
            companyRfc  ? { text: `RFC: ${companyRfc}`,  fontSize: 7, color: GRAY, alignment: 'center', margin: [0,1,0,0] } : null,
            companyAddr ? { text: companyAddr,            fontSize: 7, color: GRAY, alignment: 'center', margin: [0,1,0,0] } : null,
            companyTel  ? { text: `Tel: ${companyTel}`,  fontSize: 7, color: GRAY, alignment: 'center', margin: [0,1,0,0] } : null,
            { text: 'CUADRO COMPARATIVO DE PRECIOS', fontSize: 9, bold: true, color: BLUE, alignment: 'center', margin: [0,4,0,0] },
          ].filter(Boolean),
          margin: [8, 0, 8, 0],
        },
        { image: 'logo2', width: 80, alignment: 'right' },
      ],
      margin: [0, 0, 0, 8],
    };

    // ── DATOS COTIZACIÓN ──
    const infoTable: any = {
      table: {
        widths: [60, '*', 60, '*'],
        body: [
          [
            { text: 'Folio:',        bold: true, fontSize: 7, color: NAVY },
            { text: q.folio ?? '',   fontSize: 7 },
            { text: 'Fecha:',        bold: true, fontSize: 7, color: NAVY },
            { text: fecha,           fontSize: 7 },
          ],
          [
            { text: 'Solicitante:',  bold: true, fontSize: 7, color: NAVY },
            { text: q.solicit ?? '', fontSize: 7 },
            { text: 'Depto.:',       bold: true, fontSize: 7, color: NAVY },
            { text: deptName,        fontSize: 7 },
          ],
          [
            { text: 'Requisición:',  bold: true, fontSize: 7, color: NAVY },
            { text: String(reqFolio), fontSize: 7, colSpan: 3 }, {}, {},
          ],
        ],
      },
      layout: { hLineWidth: () => 0.3, vLineWidth: () => 0.3, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc' },
      margin: [0, 0, 0, 10],
      fillColor: LBLUE,
    };

    // ── TABLA COMPARATIVA ──
    const provCols  = this.activeProviders;
    const provColors = ['#1a5a9a', '#28a745', '#d4a017'];

    const tableWidths = [20, '*', ...provCols.map(() => 90)];

    const tableHeader: any[] = [
      { text: '#',        fontSize: 7, bold: true, fillColor: NAVY, color: '#fff', alignment: 'center' },
      { text: 'Material', fontSize: 7, bold: true, fillColor: NAVY, color: '#fff' },
      ...provCols.map((p, i) => ({
        text: p.name, fontSize: 7, bold: true,
        fillColor: provColors[i] ?? NAVY, color: '#fff', alignment: 'center'
      })),
    ];

    const tableRows = this.rowData.map((row, idx) => {
      const bg = idx % 2 === 1 ? LBLUE : null;
      const cells: any[] = [
        { text: idx + 1, fontSize: 7, alignment: 'center', fillColor: bg },
        { text: row.productName ?? '', fontSize: 7, fillColor: bg },
      ];
      provCols.forEach(p => {
        const d = row[`p${p.slot}`];
        const best = this.isBestPrice(row, p.slot);
        if (!d) {
          cells.push({ text: 'N/C', fontSize: 7, alignment: 'center', color: '#aaa', fillColor: bg });
        } else {
          cells.push({
            stack: [
              { text: `$${Number(d.price).toFixed(2)} × ${d.quantity}`, fontSize: 6, color: GRAY },
              { text: `= $${Number(d.total).toFixed(2)}${best ? ' ✓' : ''}`, fontSize: 8,
                bold: best, color: best ? GREEN : '#333' },
            ],
            fillColor: best ? '#d4edda' : bg,
            alignment: 'right',
          });
        }
      });
      return cells;
    });

    // Fila totales
    const totalRow: any[] = [
      { text: '', fillColor: '#f0f0f0' },
      { text: 'TOTAL', fontSize: 7, bold: true, fillColor: '#f0f0f0', color: NAVY },
    ];
    provCols.forEach(p => {
      const tot = this.rowData.reduce((s, r) => s + (r[`p${p.slot}`]?.total ?? 0), 0);
      totalRow.push({ text: `$${Number(tot).toFixed(2)}`, fontSize: 8, bold: true,
        alignment: 'right', fillColor: '#d4edda', color: GREEN });
    });

    const tabla: any = {
      table: {
        headerRows: 1,
        widths: tableWidths,
        body: [tableHeader, ...tableRows, totalRow],
      },
      layout: {
        hLineWidth: () => 0.4, vLineWidth: () => 0.4,
        hLineColor: () => '#cccccc', vLineColor: () => '#cccccc',
      },
      margin: [0, 0, 0, 10],
    };

    // ── LEYENDA ──
    const leyenda: any = {
      columns: [
        { canvas: [{ type: 'rect', x: 0, y: 2, w: 10, h: 10, color: '#d4edda' }], width: 14 },
        { text: ' Mejor precio por material', fontSize: 7, color: GRAY },
      ],
      margin: [0, 0, 0, 0],
    };

    // ── docDefinition ──
    const docDef: any = {
      pageSize:    'LETTER',
      pageOrientation: provCols.length >= 3 ? 'landscape' : 'portrait',
      pageMargins: [40, 40, 40, 55],
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: companyEmail, fontSize: 6, color: GRAY, margin: [40, 0, 0, 0] },
          { text: companyName,  fontSize: 6, color: GRAY, alignment: 'center' },
          { text: `Pág. ${currentPage} / ${pageCount}`, fontSize: 6, color: GRAY, alignment: 'right', margin: [0, 0, 40, 0] },
        ],
        margin: [0, 8, 0, 0],
      }),
      content: [header, infoTable, tabla, leyenda],
      images: {
        logo:  logoB64,
        logo2: logo2B64,
      },
      styles: { thCell: { fontSize: 7, bold: true } },
      defaultStyle: { font: 'Roboto' },
    };

    pdfMake.createPdf(docDef).open();
  }
}
