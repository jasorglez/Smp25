import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { LogbookService }      from 'app/services/logbook.service';
import { RootService }         from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { SignalsService }      from 'app/services/signals.service';
import { lastValueFrom }       from 'rxjs';
import pdfMake   from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

// ─── Paleta ────────────────────────────────────────────────────────────────
const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const LBLUE = '#e8f0f8';
const RED   = '#c0392b';
const WHITE = '#ffffff';
const ALT   = '#f4f7fb';
const GRAY  = '#888888';

// ─── Layout de tabla ───────────────────────────────────────────────────────
const TBL_LAYOUT = {
  hLineWidth: (i: number, node: any) =>
    (i === 0 || i === node.table.body.length) ? 0.8 : (i === 1 ? 0.8 : 0.3),
  vLineWidth: () => 0.3,
  hLineColor: (i: number, node: any) =>
    (i === 0 || i === node.table.body.length || i === 1) ? NAVY : '#cccccc',
  vLineColor: () => '#cccccc',
  paddingLeft:   () => 7,
  paddingRight:  () => 7,
  paddingTop:    () => 4,
  paddingBottom: () => 4,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const hCell = (txt: string, align: 'left'|'center'|'right' = 'left'): any => ({
  text: txt, fontSize: 8, bold: true, color: WHITE, fillColor: BLUE, alignment: align,
});

const dCell = (txt: string, alt: boolean, align: 'left'|'center'|'right' = 'left'): any => ({
  text: String(txt ?? ''), fontSize: 8, fillColor: alt ? ALT : WHITE, alignment: align,
});

const emptyRow = (cols: number): any[] => [
  {
    text: 'Sin registros', fontSize: 8, color: GRAY, colSpan: cols,
    alignment: 'center', italics: true, margin: [0, 5, 0, 5],
  },
  ...Array(cols - 1).fill(''),
];

const mkSectionTitle = (txt: string, breakBefore = false): any => ({
  table: {
    widths: ['*'],
    body: [[{
      text: txt.toUpperCase(),
      color: WHITE, fillColor: NAVY,
      bold: true, fontSize: 10,
      margin: [10, 6, 10, 6],
    }]],
  },
  layout: 'noBorders',
  ...(breakBefore ? { pageBreak: 'before' } : {}),
  margin: [0, breakBefore ? 0 : 14, 0, 6],
});

const mkSubTitle = (txt: string): any => ({
  table: {
    widths: ['*'],
    body: [[{
      text: txt.toUpperCase(),
      color: NAVY, fillColor: LBLUE,
      bold: true, fontSize: 9,
      margin: [8, 4, 8, 4],
    }]],
  },
  layout: 'noBorders',
  margin: [0, 12, 0, 5],
});

// ────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-pdf-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
<div style="padding:10px; background:#f8f9fa; border-radius:6px;">

  <!-- Barra superior -->
  <div class="d-flex justify-content-between align-items-center mb-2">
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-file-earmark-pdf-fill text-danger" style="font-size:1.3rem;"></i>
      <div>
        <span class="fw-bold" style="font-size:.9rem;">Reporte Diario</span>
        <span class="text-muted ms-2" style="font-size:.8rem;">{{ fmtDate(reportData?.date) }}</span>
      </div>
    </div>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-success" (click)="downloadPdf()" [disabled]="isLoading || !pdfBlob">
        <i class="bi bi-download me-1"></i>Descargar
      </button>
      <button class="btn btn-sm btn-outline-secondary" (click)="closeDetail()">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  </div>

  <!-- Visor -->
  <div style="height:560px; border:1px solid #dee2e6; border-radius:6px; background:white; overflow:hidden;">

    <iframe *ngIf="pdfUrl" [src]="pdfUrl"
            style="width:100%; height:100%; border:none;">
    </iframe>

    <div *ngIf="!pdfUrl && !isLoading"
         class="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
      <i class="bi bi-file-earmark-pdf" style="font-size:3rem;"></i>
      <p class="mt-2 mb-0">Sin datos para previsualizar</p>
    </div>

    <div *ngIf="isLoading"
         class="d-flex flex-column justify-content-center align-items-center h-100">
      <div class="spinner-border text-primary mb-3" style="width:2.5rem;height:2.5rem;"></div>
      <small class="text-muted">{{ loadingMsg }}</small>
    </div>

  </div>
</div>
  `,
})
export class PdfDetailComponent implements OnInit, ICellRendererAngularComp {
  @Input() data: any;
  @Input() context: any;

  private logbookService = inject(LogbookService);
  private rootService    = inject(RootService);
  private base64Service  = inject(Base64EncodeService);
  private signalsService = inject(SignalsService);
  private sanitizer      = inject(DomSanitizer);

  pdfUrl: SafeResourceUrl | null = null;
  pdfBlob: Blob | null = null;
  isLoading  = false;
  loadingMsg = 'Generando PDF...';
  reportData: any = null;

  // ── AG Grid lifecycle ──────────────────────────────────────────────────────
  agInit(params: ICellRendererParams): void {
    this.data    = params.data;
    this.context = params.context;
  }

  refresh(params: ICellRendererParams): boolean {
    this.data = params.data;
    return true;
  }

  ngOnInit(): void {
    if (this.data) {
      this.reportData = this.data;
      this.generatePdf();
    }
  }

  // ── Acciones ───────────────────────────────────────────────────────────────
  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const url = URL.createObjectURL(this.pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `reporte-${this.fmtDate(this.reportData?.date)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  closeDetail(): void {
    this.context?.componentParent?.collapsePdfDetail?.(this.reportData?.id);
  }

  // ── Fecha util (pública para template) ─────────────────────────────────────
  fmtDate(val: any): string {
    if (!val) return '';
    const s = String(val).substring(0, 10);
    const [y, m, d] = s.split('-');
    return (d && m && y) ? `${d}/${m}/${y}` : s;
  }

  // ── Generación del PDF ─────────────────────────────────────────────────────
  private async generatePdf(): Promise<void> {
    this.isLoading = true;

    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (!idRoot) { this.isLoading = false; return; }

      const reportId = this.reportData?.id;

      // Carga paralela: empresa + bitácoras
      this.loadingMsg = 'Cargando datos del reporte...';
      const safe = async (obs: any) => { try { return await lastValueFrom(obs); } catch { return null; } };

      const [rootResp, notasR, personalR, materialR, equiposR, fotosR] = await Promise.all([
        safe(this.rootService.getRootbyId(idRoot)),
        reportId ? safe(this.logbookService.getInfoByReporte(reportId, 'NOTE'))      : null,
        reportId ? safe(this.logbookService.getInfoByReporte(reportId, 'PERSONAL'))  : null,
        reportId ? safe(this.logbookService.getInfoByReporte(reportId, 'MATERIAL'))  : null,
        reportId ? safe(this.logbookService.getInfoByReporte(reportId, 'EQUIPMENT')) : null,
        reportId ? safe(this.logbookService.getInfoByReporte(reportId, 'Photo'))     : null,
      ]);

      const root     = rootResp    as any;
      const notas    = ((notasR    as any)?.data ?? []) as any[];
      const personal = ((personalR as any)?.data ?? []) as any[];
      const material = ((materialR as any)?.data ?? []) as any[];
      const equipos  = ((equiposR  as any)?.data ?? []) as any[];
      const fotos    = ((fotosR    as any)?.data ?? []) as any[];

      const companyName = root?.name    || 'EMPRESA';
      const report      = this.reportData;

      // Logos
      this.loadingMsg = 'Cargando logos...';
      const logoB64  = root?.picture  ? await this.tryB64(root.picture)  : null;
      const logo2B64 = root?.picture2 ? await this.tryB64(root.picture2) : logoB64;
      const wmB64    = root?.picture3 ? await this.tryB64(root.picture3)  : null;

      // Imágenes del diccionario
      const imgs: Record<string, string> = {};
      if (logoB64)  imgs['logo']  = logoB64;
      if (logo2B64) imgs['logo2'] = logo2B64;
      if (wmB64)    imgs['wm']    = wmB64;

      // Fotos → base64
      this.loadingMsg = 'Procesando fotografías...';
      const fotoImgs: { key: string; desc: string }[] = [];
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i];
        if (!f?.imageUrl) continue;
        const b64 = await this.tryB64(f.imageUrl);
        if (b64) {
          const key = `foto_${i}`;
          imgs[key] = b64;
          fotoImgs.push({ key, desc: f.description || '' });
        }
      }

      // ── Contenido ─────────────────────────────────────────────────────────

      // • Info general (página 1)
      const pgInfoGeneral: any[] = [
        // Datos del reporte
        {
          table: {
            widths: ['*', '*', 160],
            body: [[
              { text: [{ text: 'INICIO: ', bold: true, color: NAVY }, report.startTime || '—'], fontSize: 9 },
              { text: [{ text: 'TÉRMINO: ', bold: true, color: NAVY }, report.endTime || '—'], fontSize: 9 },
              { text: [{ text: 'TOTAL: ', bold: true, color: RED }, { text: this.fmtCurrency(report.totalPay), color: RED }], fontSize: 9 },
            ]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 8],
        },
        {
          text: [{ text: 'DESCRIPCIÓN: ', bold: true, fontSize: 9, color: NAVY }, { text: report.description || 'Sin descripción', fontSize: 9 }],
          margin: [0, 0, 0, 24],
        },
        // Firmas
        { text: 'FIRMAS DE AUTORIZACIÓN', fontSize: 10, bold: true, color: NAVY, alignment: 'center', margin: [0, 0, 0, 8] },
        {
          table: {
            widths: ['33%', '34%', '33%'],
            body: [
              [
                { text: 'SUPERINTENDENTE',   bold: true, fontSize: 8, alignment: 'center', color: NAVY, fillColor: LBLUE },
                { text: 'RESIDENTE DE OBRA', bold: true, fontSize: 8, alignment: 'center', color: NAVY, fillColor: LBLUE },
                { text: 'DIRECTOR',          bold: true, fontSize: 8, alignment: 'center', color: NAVY, fillColor: LBLUE },
              ],
              [
                { text: '________________________________', alignment: 'center', margin: [0, 28, 0, 4], fontSize: 9, color: GRAY },
                { text: '________________________________', alignment: 'center', margin: [0, 28, 0, 4], fontSize: 9, color: GRAY },
                { text: '________________________________', alignment: 'center', margin: [0, 28, 0, 4], fontSize: 9, color: GRAY },
              ],
            ],
          },
          layout: TBL_LAYOUT,
        },
      ];

      // • Notas (página 4) — tipo como encabezado, contenido a todo el ancho
      const pgNotas: any[] = [
        mkSectionTitle('Bitácora de Notas', true),
        ...(notas.length > 0
          ? notas.map((n: any) => ({
              table: {
                widths: ['*'],
                body: [
                  // Renglón: tipo de nota (encabezado)
                  [{
                    text: (n.supervisor || 'GENERAL').toUpperCase(),
                    fontSize: 8, bold: true,
                    color: NAVY, fillColor: LBLUE,
                    margin: [6, 4, 6, 4],
                  }],
                  // Renglón: contenido a todo el ancho
                  [{
                    text: n.description || '',
                    fontSize: 8,
                    margin: [6, 5, 6, 6],
                    lineHeight: 1.3,
                  }],
                ],
              },
              layout: TBL_LAYOUT,
              margin: [0, 0, 0, 6],
            }))
          : [{
              text: 'Sin registros de notas.',
              fontSize: 8, color: GRAY, italics: true, margin: [0, 4, 0, 4],
            }]),
      ];

      // • Personal + Material + Equipos — 3 columnas al mismo nivel (página 5)
      const totalPersonas = personal.reduce((s, p) => s + (Number(p.quantity) || 0), 0);

      // Celda de encabezado mini (letra 7)
      const mh = (txt: string, align: 'left'|'center' = 'left'): any => ({
        text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: BLUE, alignment: align,
      });
      // Celda de dato mini (letra 7)
      const md = (txt: string, alt: boolean, align: 'left'|'center' = 'left'): any => ({
        text: String(txt ?? ''), fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: align,
      });
      // Fila vacía mini
      const emptyMini = (cols: number): any[] => [
        { text: 'Sin registros', fontSize: 7, color: GRAY, colSpan: cols, alignment: 'center', italics: true, margin: [0, 3, 0, 3] },
        ...Array(cols - 1).fill(''),
      ];

      const pgPersonalMaterialEquipos: any[] = [
        mkSectionTitle('Personal · Material · Equipos', true),
        {
          columnGap: 8,
          columns: [
            // ── PERSONAL ──────────────────────────────────────────────
            {
              width: '34%',
              stack: [
                mkSubTitle('Personal'),
                {
                  table: {
                    widths: ['*', 28],
                    headerRows: 1,
                    body: [
                      [mh('PUESTO'), mh('CANT.', 'center')],
                      ...(personal.length > 0
                        ? [
                            ...personal.map((p, i) => [
                              md(p.position || '', i % 2 !== 0),
                              md(String(p.quantity ?? ''), i % 2 !== 0, 'center'),
                            ]),
                            [
                              { text: 'TOTAL', fontSize: 7, bold: true, color: NAVY, fillColor: LBLUE },
                              { text: String(totalPersonas), fontSize: 7, bold: true, color: NAVY, fillColor: LBLUE, alignment: 'center' },
                            ],
                          ]
                        : [emptyMini(2)]),
                    ],
                  },
                  layout: TBL_LAYOUT,
                },
              ],
            },
            // ── MATERIAL ──────────────────────────────────────────────
            {
              width: '33%',
              stack: [
                mkSubTitle('Material'),
                {
                  table: {
                    widths: ['*', 28],
                    headerRows: 1,
                    body: [
                      [mh('MATERIAL'), mh('CANT.', 'center')],
                      ...(material.length > 0
                        ? material.map((m, i) => [
                            md(m.description || '', i % 2 !== 0),
                            md(String(m.quantity ?? ''), i % 2 !== 0, 'center'),
                          ])
                        : [emptyMini(2)]),
                    ],
                  },
                  layout: TBL_LAYOUT,
                },
              ],
            },
            // ── EQUIPOS ───────────────────────────────────────────────
            {
              width: '33%',
              stack: [
                mkSubTitle('Equipos'),
                {
                  table: {
                    widths: ['*', 28],
                    headerRows: 1,
                    body: [
                      [mh('EQUIPO'), mh('CANT.', 'center')],
                      ...(equipos.length > 0
                        ? equipos.map((e, i) => [
                            md(e.description || '', i % 2 !== 0),
                            md(String(e.quantity ?? ''), i % 2 !== 0, 'center'),
                          ])
                        : [emptyMini(2)]),
                    ],
                  },
                  layout: TBL_LAYOUT,
                },
              ],
            },
          ],
        },
      ];

      // • Fotografías (páginas 6-7)
      const pgFotos: any[] = [];
      if (fotoImgs.length > 0) {
        pgFotos.push(mkSectionTitle('Registro Fotográfico', true));

        // Contador de fotos
        pgFotos.push({
          text: `Total de fotografías: ${fotoImgs.length}`,
          fontSize: 8, color: GRAY, italics: true,
          margin: [0, 0, 0, 8],
        });

        // Grid 2 columnas
        const fotoRows: any[] = [];
        for (let i = 0; i < fotoImgs.length; i += 2) {
          const mkFotoCell = (f: typeof fotoImgs[0]): any => ({
            stack: [
              {
                table: {
                  widths: ['*'],
                  body: [[{ image: f.key, width: 210, alignment: 'center', margin: [0, 4, 0, 4] }]],
                },
                layout: {
                  hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => '#cccccc', vLineColor: () => '#cccccc',
                },
              },
              {
                text: f.desc || ' ',
                fontSize: 7, alignment: 'center', color: GRAY, italics: true,
                margin: [0, 4, 0, 8],
              },
            ],
            margin: [4, 4, 4, 4],
          });

          fotoRows.push([
            mkFotoCell(fotoImgs[i]),
            (i + 1 < fotoImgs.length) ? mkFotoCell(fotoImgs[i + 1]) : { text: '' },
          ]);
        }

        pgFotos.push({
          table: { widths: ['50%', '50%'], body: fotoRows },
          layout: 'noBorders',
        });
      }

      // ── Definición del documento ──────────────────────────────────────────
      this.loadingMsg = 'Compilando PDF...';
      const docDef: any = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
        pageMargins: [40, 88, 40, 48],
        info: {
          title: `Reporte Diario — ${companyName}`,
          author: companyName,
          subject: 'Reporte Diario de Obra',
        },

        // Header dinámico
        header: (currentPage: number, pageCount: number) => ({
          margin: [40, 12, 40, 0],
          stack: [
            {
              columns: [
                logoB64
                  ? { image: 'logo',  width: 52, alignment: 'left'  }
                  : { text: '', width: 52 },
                {
                  width: '*',
                  stack: [
                    { text: companyName,            style: 'hdrTitle'                    },
                    { text: 'REPORTE DIARIO DE OBRA', style: 'hdrSub', margin: [0,2,0,0] },
                    {
                      text: `Fecha: ${this.fmtDate(report.date)}   ·   Pág. ${currentPage} / ${pageCount}`,
                      style: 'hdrMeta', margin: [0,2,0,0],
                    },
                  ],
                  alignment: 'center',
                },
                logo2B64
                  ? { image: 'logo2', width: 52, alignment: 'right' }
                  : { text: '', width: 52 },
              ],
            },
            // Línea divisoria bajo el header
            { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 492, y2: 4, lineWidth: 1, lineColor: NAVY }] },
          ],
        }),

        // Footer con línea + número de página
        footer: (currentPage: number, pageCount: number) => ({
          margin: [40, 0, 40, 10],
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 492, y2: 0, lineWidth: 0.4, lineColor: '#cccccc' }] },
            {
              columns: [
                { text: companyName, fontSize: 7, color: GRAY, margin: [0, 3, 0, 0] },
                { text: `Pág. ${currentPage} de ${pageCount}`, fontSize: 7, color: GRAY, alignment: 'right', margin: [0, 3, 0, 0] },
              ],
            },
          ],
        }),

        background: wmB64 ? [{
          image: 'wm', width: 380, opacity: 0.05,
          absolutePosition: { x: 116, y: 210 },
        }] : [],

        content: [
          ...pgInfoGeneral,
          ...pgNotas,
          ...pgPersonalMaterialEquipos,
          ...pgFotos,
        ],

        images: imgs,

        styles: {
          hdrTitle: { fontSize: 13, bold: true,  color: NAVY               },
          hdrSub:   { fontSize: 10, bold: true,  color: RED                },
          hdrMeta:  { fontSize: 7.5,             color: GRAY               },
        },
        defaultStyle: { font: 'Roboto', fontSize: 9 },
      };

      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        this.pdfBlob = blob;
        const url = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoading = false;
      });

    } catch (err) {
      console.error('Error generando PDF:', err);
      this.isLoading = false;
    }
  }

  // ── Helpers privados ────────────────────────────────────────────────────────
  private async tryB64(url: string): Promise<string | null> {
    if (!url) return null;
    try { return await this.base64Service.convertImageToBase64(url); }
    catch { return null; }
  }

  private fmtCurrency(val: number | null | undefined): string {
    if (val == null) return '$0.00';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  }
}
