import { Component, Input, Output, EventEmitter, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams }      from 'ag-grid-enterprise';
import { RootService }         from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { DistributionService } from 'app/services/distribution.service';
import { EquipmentService }    from 'app/services/equipment.service';
import { SignalsService }      from 'app/services/signals.service';
import { lastValueFrom }       from 'rxjs';
import pdfMake   from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

// ─── Paleta ────────────────────────────────────────────────────────────────
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
const nCell = (val: number | null, alt: boolean): any => ({
  text: val != null && val !== 0 ? Number(val).toFixed(3) : '',
  fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right',
});
const totalCell = (txt: string, align: 'left'|'center'|'right' = 'right'): any => ({
  text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: NAVY, alignment: align,
});

// ────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-pdf-distribution',
  standalone: true,
  imports: [CommonModule],
  template: `
<div *ngIf="mode === 'embed'" style="padding:10px; background:#f8f9fa; border-radius:6px;">

  <div class="d-flex justify-content-between align-items-center mb-2">
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-file-earmark-pdf-fill text-danger" style="font-size:1.3rem;"></i>
      <span class="fw-bold" style="font-size:.9rem;">Distribución de Equipos</span>
    </div>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-success" (click)="downloadPdf()" [disabled]="isLoading || !pdfBlob">
        <i class="bi bi-download me-1"></i>Descargar
      </button>
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
               [style.width.%]="loadingProgress"
               [attr.aria-valuenow]="loadingProgress"
               aria-valuemin="0" aria-valuemax="100">
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modo newTab: solo progress mientras genera, luego se destruye -->
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
export class PdfDistributionComponent implements OnInit, ICellRendererAngularComp {
  @Input()  idCompany: number;
  @Input()  mode: 'embed' | 'newTab' = 'embed';
  /** 'quantity' = columnas con cantidades distribuidas | 'money' = cantidad × precio MN */
  @Input()  reportType: 'quantity' | 'money' = 'quantity';
  @Output() closed = new EventEmitter<void>();

  private params: ICellRendererParams | null = null;

  private rootService         = inject(RootService);
  private base64Service       = inject(Base64EncodeService);
  private distributionService = inject(DistributionService);
  private equipmentService    = inject(EquipmentService);
  private signalsService      = inject(SignalsService);
  private sanitizer           = inject(DomSanitizer);
  private cdr                 = inject(ChangeDetectorRef);

  pdfUrl:    SafeResourceUrl | null = null;
  pdfBlob:   Blob | null = null;
  isLoading      = false;
  loadingMsg     = 'Generando PDF...';
  loadingProgress = 0;

  // ── AG Grid lifecycle ──────────────────────────────────────────────────────
  agInit(params: ICellRendererParams): void {
    this.params    = params;
    this.idCompany = (params as any).idCompany ?? (params.context?.idCompany);
  
    this.cdr.detectChanges();}

  refresh(_params: ICellRendererParams): boolean { return false; }

  ngOnInit(): void {
    this.generatePdf();
  }

  onClose(): void {
    this.closed.emit();
    // Si está dentro del grid como full-width row, notifica al padre
    if (this.params?.context?.componentParent?.collapsePdfDistribution) {
      this.params.context.componentParent.collapsePdfDistribution();
    }
  }

  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const url = URL.createObjectURL(this.pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `distribucion-equipos-${new Date().toISOString().substring(0,10)}.pdf`;
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

      const [rootResp, equipmentsResp] = await Promise.all([
        safe(this.rootService.getRootbyId(idRoot)),
        safe(this.equipmentService.getEquipment(idRoot)),
      ]);
      this.loadingProgress = 20;

      const root       = rootResp as any;
      const equipments = (Array.isArray(equipmentsResp) ? equipmentsResp : []) as any[];

      if (!equipments.length) { this.isLoading = false; return; }

      // Cargar distribuciones en paralelo
      this.loadingMsg = 'Cargando distribuciones...';
      const distMap = new Map<number, any[]>();
      let doneCount = 0;
      const totalCount = equipments.length;
      await Promise.all(equipments.map(async (eq) => {
        const dists = await safe(this.distributionService.getByReference('EQUIPMENT', eq.id, idRoot));
        distMap.set(eq.id, Array.isArray(dists) ? dists : []);
        doneCount++;
        this.loadingProgress = 20 + Math.round((doneCount / totalCount) * 45);
      }));

      // Meses únicos presentes
      const monthSet = new Set<string>();
      distMap.forEach(dists => dists.forEach(d => {
        if (d.year && d.month) monthSet.add(`${d.year}-${String(d.month).padStart(2,'0')}`);
      }));
      const sortedMonths = Array.from(monthSet).sort();

      // Logos
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

      // ── HEADER ─────────────────────────────────────────────────────────────
      const headerRow: any = {
        columns: [
          logoB64
            ? { image: 'logo', width: 80 }
            : { text: '', width: 80 },
          {
            stack: [
              { text: companyName.toUpperCase(), fontSize: 11, bold: true, color: NAVY, alignment: 'center' },
              { text: isMoney ? 'PROGRAMA DE EROGACIONES CALENDARIZADO' : 'PROGRAMA DE DISTRIBUCIÓN CALENDARIZADO', fontSize: 9, bold: true, color: BLUE, alignment: 'center', margin: [0,2,0,0] },
              { text: isMoney ? 'CUANTIFICADO DE EROGACIONES MENSUAL DE MAQUINARIA Y/O EQUIPO DE CONSTRUCCIÓN' : 'CUANTIFICADO DE UTILIZACIÓN MENSUAL DE MAQUINARIA Y/O EQUIPO DE CONSTRUCCIÓN', fontSize: 7, color: GRAY, alignment: 'center', margin: [0,1,0,0] },
            ],
            margin: [10,0,10,0],
          },
          logo2B64
            ? { image: 'logo2', width: 80, alignment: 'right' }
            : { text: '', width: 80 },
        ],
        margin: [0,0,0,8],
      };

      // ── TABLA ──────────────────────────────────────────────────────────────
      const colWidths: any[] = ['*', 35, 45, 50, 50, ...sortedMonths.map(() => 38)];

      const tableHeader: any[] = [
        hCell('Descripción', 'left'),
        hCell('Unidad'),
        hCell('Cantidad'),
        hCell('P.Unitario'),
        hCell('Total'),
        ...sortedMonths.map(ym => {
          const [y, m] = ym.split('-');
          return hCell(`${MONTHS_NAMES[Number(m)-1]}\n${y}`);
        }),
      ];

      const tableBody: any[][] = [tableHeader];
      const monthTotals = new Array(sortedMonths.length).fill(0);
      let grandTotal = 0;

      equipments.forEach((eq, idx) => {
        const alt      = idx % 2 === 1;
        const priceMN  = Number(eq.priceMN ?? 0);
        const dists    = distMap.get(eq.id) ?? [];
        const distByMonth = new Map<string, number>();
        dists.forEach(d => {
          if (d.year && d.month) {
            const key = `${d.year}-${String(d.month).padStart(2,'0')}`;
            distByMonth.set(key, (distByMonth.get(key) ?? 0) + Number(d.quantity ?? 0));
          }
        });

        const total = Number(eq.totalMN ?? (Number(eq.quantity ?? 0) * priceMN));
        grandTotal += total;

        const monthCells = sortedMonths.map((ym, mi) => {
          const qty    = distByMonth.get(ym) ?? 0;
          const value  = isMoney ? qty * priceMN : qty;
          monthTotals[mi] += value;
          return isMoney
            ? { text: value ? `$${value.toFixed(3)}` : '', fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' }
            : nCell(qty || null, alt);
        });

        tableBody.push([
          dCell(eq.description || '', alt, 'left'),
          dCell(eq.measure || '', alt, 'center'),
          { text: Number(eq.quantity ?? 0).toFixed(3), fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          { text: `$${Number(eq.priceMN ?? 0).toFixed(3)}`,  fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          { text: `$${total.toFixed(3)}`, fontSize: 7, bold: true, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          ...monthCells,
        ]);
      });

      // TOTAL PARCIAL
      tableBody.push([
        totalCell('TOTAL PARCIAL:', 'right'),
        totalCell(''), totalCell(''), totalCell(''),
        totalCell(`$${grandTotal.toFixed(3)}`),
        ...monthTotals.map(t => totalCell(
          t > 0 ? (isMoney ? `$${t.toFixed(3)}` : t.toFixed(3)) : ''
        )),
      ]);

      // TOTAL ACUMULADO
      let acum = 0;
      tableBody.push([
        totalCell('TOTAL ACUMULADO:', 'right'),
        totalCell(''), totalCell(''), totalCell(''),
        totalCell(`$${grandTotal.toFixed(3)}`),
        ...monthTotals.map(t => {
          acum += t;
          return totalCell(acum > 0 ? (isMoney ? `$${acum.toFixed(3)}` : acum.toFixed(3)) : '');
        }),
      ]);

      const mainTable: any = {
        table: { headerRows: 1, widths: colWidths, body: tableBody },
        layout: TBL_LAYOUT,
      };

      // ── DOCUMENTO ──────────────────────────────────────────────────────────
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
      console.error('Error generando PDF de distribución:', err);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
