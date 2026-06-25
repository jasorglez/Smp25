import { Component, Input, Output, EventEmitter, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RootService }         from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { DistributionService } from 'app/services/distribution.service';
import { ManoObraService }     from 'app/services/mano-obra.service';
import { SignalsService }      from 'app/services/signals.service';
import { lastValueFrom }       from 'rxjs';
import pdfMake   from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const LBLUE = '#e8f0f8';
const WHITE = '#ffffff';
const ALT   = '#f4f7fb';
const GRAY  = '#888888';

const MONTHS_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const TBL_LAYOUT = {
  hLineWidth: (i: number, node: any) =>
    (i === 0 || i === node.table.body.length) ? 0.8 : (i === 1 ? 0.8 : 0.3),
  vLineWidth: () => 0.3,
  hLineColor: (i: number, node: any) =>
    (i === 0 || i === node.table.body.length || i === 1) ? NAVY : '#cccccc',
  vLineColor: () => '#cccccc',
  paddingLeft: () => 4, paddingRight: () => 4,
  paddingTop:  () => 3, paddingBottom: () => 3,
};

const hCell = (txt: string, align: 'left'|'center'|'right' = 'center'): any => ({
  text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: BLUE, alignment: align,
});
const dCell = (txt: string, alt: boolean, align: 'left'|'center'|'right' = 'left'): any => ({
  text: String(txt ?? ''), fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: align,
});
const nCell = (val: number | null, alt: boolean, decimals = 4): any => ({
  text: val != null && val !== 0 ? Number(val).toFixed(decimals) : '',
  fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right',
});
const totalCell = (txt: string, align: 'left'|'center'|'right' = 'right'): any => ({
  text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: NAVY, alignment: align,
});

@Component({
  selector: 'app-pdf-mano-obra',
  standalone: true,
  imports: [CommonModule, PdfShareButtonsComponent],
  template: `
<div *ngIf="mode === 'embed'" style="padding:10px; background:#f8f9fa; border-radius:6px;">
  <div class="d-flex justify-content-between align-items-center mb-2">
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-file-earmark-pdf-fill text-danger" style="font-size:1.3rem;"></i>
      <span class="fw-bold" style="font-size:.9rem;">Distribución de Mano de Obra</span>
    </div>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-success" (click)="downloadPdf()" [disabled]="isLoading || !pdfBlob">
        <i class="bi bi-download me-1"></i>Descargar
      </button>
      <app-pdf-share-buttons
        [getPdfBlob]="getPdfBlobFn"
        fileName="ManoObra_reporte.pdf"
        subject="Distribución Mano de Obra">
      </app-pdf-share-buttons>
      <button class="btn btn-sm btn-outline-secondary" (click)="onClose()">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  </div>
  <div style="height:520px; border:1px solid #dee2e6; border-radius:6px; background:white; overflow:hidden;">
    <iframe *ngIf="pdfUrl" [src]="pdfUrl" style="width:100%; height:100%; border:none;"></iframe>
    <div *ngIf="!pdfUrl && !isLoading"
         class="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
      <i class="bi bi-file-earmark-pdf" style="font-size:3rem;"></i>
      <p class="mt-2 mb-0">Sin datos</p>
    </div>
    <div *ngIf="isLoading"
         class="d-flex flex-column justify-content-center align-items-center h-100 px-4">
      <i class="bi bi-file-earmark-pdf text-primary mb-3" style="font-size:2.5rem;"></i>
      <div class="w-100">
        <div class="d-flex justify-content-between mb-1">
          <small class="text-muted">{{ loadingMsg }}</small>
          <small class="text-primary fw-bold">{{ loadingProgress }}%</small>
        </div>
        <div class="progress" style="height:8px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
               role="progressbar"
               [style.width.%]="loadingProgress">
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div *ngIf="mode === 'newTab' && isLoading" style="padding:12px; min-width:280px;">
  <div class="d-flex align-items-center gap-2 mb-1">
    <i class="bi bi-file-earmark-pdf text-primary"></i>
    <small class="text-muted fw-semibold">{{ loadingMsg }}</small>
    <small class="text-primary fw-bold ms-auto">{{ loadingProgress }}%</small>
  </div>
  <div class="progress" style="height:6px;">
    <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
         role="progressbar"
         [style.width.%]="loadingProgress">
    </div>
  </div>
</div>
  `,
})
export class PdfManoObraComponent implements OnInit {
  @Input() idCompany: number;
  @Input() mode: 'embed' | 'newTab' = 'embed';
  /** 'quantity' = cantidades distribuidas | 'money' = cantidad × unitPrice */
  @Input() reportType: 'quantity' | 'money' = 'quantity';
  @Output() closed = new EventEmitter<void>();

  private rootService         = inject(RootService);
  private base64Service       = inject(Base64EncodeService);
  private distributionService = inject(DistributionService);
  private manoObraService     = inject(ManoObraService);
  private signalsService      = inject(SignalsService);
  private sanitizer           = inject(DomSanitizer);
  private cdr                 = inject(ChangeDetectorRef);

  pdfUrl:    SafeResourceUrl | null = null;
  pdfBlob:   Blob | null = null;
  isLoading       = false;

  getPdfBlobFn = (): Promise<Blob> =>
    this.pdfBlob ? Promise.resolve(this.pdfBlob) : Promise.reject('PDF no generado aún');
  loadingMsg      = 'Generando PDF...';
  loadingProgress = 0;

  ngOnInit(): void { this.generatePdf(); }

  onClose(): void { this.closed.emit(); }

  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const url = URL.createObjectURL(this.pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `distribucion-mano-obra-${new Date().toISOString().substring(0,10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async tryB64(url: string): Promise<string | null> {
    try { return await this.base64Service.convertImageToBase64(url); } catch { return null; }
  }

  private async generatePdf(): Promise<void> {
    this.isLoading = true;
    this.loadingProgress = 0;
    try {
      const idRoot = this.idCompany || this.signalsService.getRootSelectedBySidebar()();
      if (!idRoot) { this.isLoading = false; return; }

      this.loadingMsg = 'Cargando datos...';
      const safe = async (obs: any) => { try { return await lastValueFrom(obs); } catch { return null; } };

      const [rootResp, manoObrasResp] = await Promise.all([
        safe(this.rootService.getRootbyId(idRoot)),
        safe(this.manoObraService.getByCompany(idRoot)),
      ]);
      this.loadingProgress = 20;

      const root      = rootResp as any;
      const manoObras = (Array.isArray(manoObrasResp) ? manoObrasResp : []) as any[];
      if (!manoObras.length) { this.isLoading = false; return; }

      this.loadingMsg = 'Cargando distribuciones...';
      const distMap = new Map<number, any[]>();
      let doneCount = 0;
      await Promise.all(manoObras.map(async (mo) => {
        const dists = await safe(this.distributionService.getByReference('MANO_OBRA', mo.id, idRoot));
        distMap.set(mo.id, Array.isArray(dists) ? dists : []);
        doneCount++;
        this.loadingProgress = 20 + Math.round((doneCount / manoObras.length) * 45);
      }));

      const monthSet = new Set<string>();
      distMap.forEach(dists => dists.forEach(d => {
        if (d.year && d.month) monthSet.add(`${d.year}-${String(d.month).padStart(2,'0')}`);
      }));
      const sortedMonths = Array.from(monthSet).sort();

      this.loadingMsg = 'Cargando logos...';
      const logoB64  = root?.picture  ? await this.tryB64(root.picture)  : null;
      const logo2B64 = root?.picture2 ? await this.tryB64(root.picture2) : logoB64;
      const wmB64    = root?.picture3 ? await this.tryB64(root.picture3) : null;
      this.loadingProgress = 85;

      const imgs: Record<string, string> = {};
      if (logoB64)  imgs['logo']  = logoB64;
      if (logo2B64) imgs['logo2'] = logo2B64;
      if (wmB64)    imgs['wm']    = wmB64;

      const companyName = root?.name || 'EMPRESA';
      const isMoney = this.reportType === 'money';

      const headerRow: any = {
        columns: [
          logoB64  ? { image: 'logo',  width: 80 } : { text: '', width: 80 },
          {
            stack: [
              { text: companyName.toUpperCase(), fontSize: 11, bold: true, color: NAVY, alignment: 'center' },
              { text: isMoney ? 'PROGRAMA DE EROGACIONES CALENDARIZADO' : 'PROGRAMA DE DISTRIBUCIÓN CALENDARIZADO', fontSize: 9, bold: true, color: BLUE, alignment: 'center', margin: [0,2,0,0] },
              { text: 'CUANTIFICADO DE UTILIZACIÓN MENSUAL DE MANO DE OBRA', fontSize: 7, color: GRAY, alignment: 'center', margin: [0,1,0,0] },
            ],
            margin: [10,0,10,0],
          },
          logo2B64 ? { image: 'logo2', width: 80, alignment: 'right' } : { text: '', width: 80 },
        ],
        margin: [0,0,0,8],
      };

      const colWidths: any[] = ['*', 45, 55, 55, 55, ...sortedMonths.map(() => 38)];

      const tableHeader: any[] = [
        hCell('Categoría / Rol', 'left'),
        hCell('Unidad'),
        hCell('P.Unitario'),
        hCell('Cantidad'),
        hCell('Total'),
        ...sortedMonths.map(ym => {
          const [y, m] = ym.split('-');
          return hCell(`${MONTHS_NAMES[Number(m)-1]}\n${y}`);
        }),
      ];

      const tableBody: any[][] = [tableHeader];
      const monthTotals = new Array(sortedMonths.length).fill(0);
      let grandTotal = 0;

      manoObras.forEach((mo, idx) => {
        const alt      = idx % 2 === 1;
        const unitPrice = Number(mo.unitPrice ?? 0);
        const qty       = Number(mo.quantity ?? 0);
        const total     = unitPrice * qty;
        grandTotal     += total;

        const dists = distMap.get(mo.id) ?? [];
        const distByMonth = new Map<string, number>();
        dists.forEach(d => {
          if (d.year && d.month) {
            const key = `${d.year}-${String(d.month).padStart(2,'0')}`;
            distByMonth.set(key, (distByMonth.get(key) ?? 0) + Number(d.quantity ?? 0));
          }
        });

        const monthCells = sortedMonths.map((ym, mi) => {
          const distQty = distByMonth.get(ym) ?? 0;
          const value   = isMoney ? distQty * unitPrice : distQty;
          monthTotals[mi] += value;
          return isMoney
            ? { text: value ? `$${value.toFixed(2)}` : '', fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' }
            : nCell(distQty || null, alt);
        });

        tableBody.push([
          dCell(mo.description || '', alt, 'left'),
          dCell(mo.unit || '', alt, 'center'),
          { text: `$${unitPrice.toFixed(2)}`, fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          { text: qty.toFixed(4),             fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          { text: `$${total.toFixed(2)}`,     fontSize: 7, bold: true, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          ...monthCells,
        ]);
      });

      tableBody.push([
        totalCell('TOTAL PARCIAL:', 'right'),
        totalCell(''), totalCell(''), totalCell(''),
        totalCell(`$${grandTotal.toFixed(2)}`),
        ...monthTotals.map(t => totalCell(t > 0 ? (isMoney ? `$${t.toFixed(2)}` : t.toFixed(4)) : '')),
      ]);

      let acum = 0;
      tableBody.push([
        totalCell('TOTAL ACUMULADO:', 'right'),
        totalCell(''), totalCell(''), totalCell(''),
        totalCell(`$${grandTotal.toFixed(2)}`),
        ...monthTotals.map(t => {
          acum += t;
          return totalCell(acum > 0 ? (isMoney ? `$${acum.toFixed(2)}` : acum.toFixed(4)) : '');
        }),
      ]);

      const mainTable: any = {
        table: { headerRows: 1, widths: colWidths, body: tableBody },
        layout: TBL_LAYOUT,
      };

      const docDef: any = {
        pageSize:        'LEGAL',
        pageOrientation: 'landscape',
        pageMargins:     [20, 20, 20, 20],
        images:          imgs,
        content: [
          ...(wmB64 ? [{ image: 'wm', width: 500, opacity: 0.05, absolutePosition: { x: 170, y: 180 } }] : []),
          headerRow,
          mainTable,
        ],
        footer: (page: number, pages: number) => ({
          columns: [
            { text: `Generado: ${new Date().toLocaleDateString('es-MX')}`, fontSize: 6, color: GRAY, margin: [20,0,0,0] },
            { text: `Página ${page} de ${pages}`, fontSize: 6, color: GRAY, alignment: 'right', margin: [0,0,20,0] },
          ],
        }),
        defaultStyle: { font: 'Roboto' },
      };

      this.loadingMsg = 'Generando PDF...';
      this.loadingProgress = 95;
      const doc = pdfMake.createPdf(docDef);

      if (this.mode === 'newTab') {
        doc.open();
        this.loadingProgress = 100;
        this.isLoading = false;
        this.cdr.detectChanges();
        this.closed.emit();
      } else {
        doc.getBlob((blob: Blob) => {
          this.pdfBlob = blob;
          const url   = URL.createObjectURL(blob);
          this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.loadingProgress = 100;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }

    } catch (err) {
      console.error('Error generando PDF de mano de obra:', err);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
