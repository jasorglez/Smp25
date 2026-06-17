import { Component, Input, inject, OnInit, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { LogbookService }      from 'app/services/logbook.service';
import { RootService }         from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { SignalsService }      from 'app/services/signals.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
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

const dCell = (txt: string, alt: boolean, align: 'left'|'center'|'right' = 'left', indent = 0): any => ({
  text: String(txt ?? ''), fontSize: 8, fillColor: alt ? ALT : WHITE, alignment: align,
  margin: [indent, 0, 0, 0],
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

  private logbookService      = inject(LogbookService);
  private readonly cdr = inject(ChangeDetectorRef);
  private rootService         = inject(RootService);
  private base64Service       = inject(Base64EncodeService);
  private signalsService      = inject(SignalsService);
  private workprogramsService = inject(WorkprogramsService);
  private sanitizer           = inject(DomSanitizer);

  pdfUrl: SafeResourceUrl | null = null;
  pdfBlob: Blob | null = null;
  isLoading  = false;
  loadingMsg = 'Generando PDF...';
  reportData: any = null;

  // ── AG Grid lifecycle ──────────────────────────────────────────────────────
  agInit(params: ICellRendererParams): void {
    this.data    = params.data;
    this.context = params.context;
  
    this.cdr.detectChanges();}

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

      const report       = this.reportData;
      const projectId    = report?.idProject   ?? null;
      const idConvention = report?.idConvention ?? null;

      const [rootResp, notasR, personalR, materialR, equiposR, fotosR, conceptsR, conceptosBitacoraR, wpFlatR] = await Promise.all([
        safe(this.rootService.getRootbyId(idRoot)),
        reportId   ? safe(this.logbookService.getInfoByReporte(reportId, 'NOTE'))      : null,
        reportId   ? safe(this.logbookService.getInfoByReporte(reportId, 'PERSONAL'))  : null,
        reportId   ? safe(this.logbookService.getInfoByReporte(reportId, 'MATERIAL'))  : null,
        reportId   ? safe(this.logbookService.getInfoByReporte(reportId, 'EQUIPMENT')) : null,
        reportId   ? safe(this.logbookService.getInfoByReporte(reportId, 'Photo'))     : null,
        projectId  ? safe(this.workprogramsService.getConceptsHierarchy(projectId, idConvention)) : null,
        reportId   ? safe(this.logbookService.getInfoByReporte(reportId, 'CONCEPTO'))  : null,
        projectId  ? safe(this.workprogramsService.getWorkPrograms(projectId, 'Project')) : null,
      ]);

      const root     = rootResp    as any;
      const notas    = ((notasR    as any)?.data ?? []) as any[];
      const personal = ((personalR as any)?.data ?? []) as any[];
      const material = ((materialR as any)?.data ?? []) as any[];
      const equipos  = ((equiposR  as any)?.data ?? []) as any[];
      const fotos    = ((fotosR    as any)?.data ?? []) as any[];
      const conceptsHierarchy = (conceptsR ?? []) as any[];
      const conceptosBitacora = ((conceptosBitacoraR as any)?.data ?? []) as any[];
      const wpFlat        = (wpFlatR ?? []) as any[];
      // Fila CONTRATO: activity='0', measure='CONTRATO'
      const contratoRow   = wpFlat.find((r: any) =>
        String(r.measure ?? r.Measure ?? '').toUpperCase() === 'CONTRATO' &&
        String(r.activity ?? r.Activity ?? '') === '0'
      );
      const numberContract = String(this.signalsService.nameContract() ?? '');
      // El campo C# es 'Text' (propiedad) mapeado a columna 'description', en JSON → 'text'
      const contratoDesc   = String(contratoRow?.text ?? contratoRow?.Text ?? contratoRow?.description ?? '');

      // ── Lookup maps SUBPARTIDA id/activity → jerarquía ───────────────────
      const subpartidaById  = new Map<number, { sysAct: string; sysTxt: string; subAct: string; subTxt: string }>();
      const subpartidaByAct = new Map<string, { sysAct: string; sysTxt: string; subAct: string; subTxt: string }>();
      for (const sys of conceptsHierarchy) {
        const sysAct = String(sys.activity ?? '').trim();
        const sysTxt = String(sys.text     ?? '').trim();
        for (const sub of sys.subpartidas ?? []) {
          const subAct = String(sub.activity ?? '').trim();
          const subTxt = String(sub.text     ?? '').trim();
          const info   = { sysAct, sysTxt, subAct, subTxt };
          if (sub.id)  subpartidaById.set(Number(sub.id), info);
          if (subAct)  subpartidaByAct.set(subAct, info);
        }
      }

      // ── Resolver cada entrada de bitácora → { subAct, cAct } ─────────────
      // Estrategia 1: id_padre → workprogram.id del SUBPARTIDA
      // Estrategia 2 (fallback): parsear description "1.1 A INGENIERIA..."
      const resolvedConceptos: Array<{ subAct: string; cAct: string; entry: any }> = [];
      for (const c of conceptosBitacora) {
        const idPadre = Number(c.idPadre ?? c.id_padre ?? 0);
        let info = idPadre > 0 ? subpartidaById.get(idPadre) : undefined;
        if (!info) {
          const tok0 = String(c.description ?? c.metadata ?? '').trim().split(/\s+/)[0];
          if (tok0) info = subpartidaByAct.get(tok0);
        }
        if (!info) continue;
        const descC = String(c.descriptionconcept ?? '').trim();
        const cAct  = descC.split(/\s+/)[0] ?? '';
        resolvedConceptos.push({ subAct: info.subAct, cAct, entry: c });
      }

      const companyName = root?.name    || 'EMPRESA';
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

      // • Bitácora de Conceptos — SISTEMA > SUBPARTIDA > CONCEPTO > entradas
      const fmtT = (v: any): string => {
        if (!v) return '';
        const s = String(v);
        // "1970-01-01T08:00:00.000Z" → "08:00"  |  "08:00:00" → "08:00"
        return s.includes('T') ? s.substring(11, 16) : s.substring(0, 5);
      };
      const SEQ = 'abcdefghijklmnopqrstuvwxyz';

      const cRows: any[][] = [[
        hCell('EDT'),
        hCell('INICIO',  'center'),
        hCell('TÉRMINO', 'center'),
        hCell('DESCRIPCIÓN DE LAS ACTIVIDADES'),
        hCell('CANT.', 'right'),
      ]];

      for (const sys of conceptsHierarchy) {
        const sysAct = String(sys.activity ?? '').trim();
        const sysTxt = String(sys.text     ?? '').trim();
        let sysAdded = false;

        for (const sub of sys.subpartidas ?? []) {
          const subAct = String(sub.activity ?? '').trim();
          const subTxt = String(sub.text     ?? '').trim();
          let subAdded = false;

          for (const c of sub.conceptos ?? []) {
            const cAct = String(c.activity ?? '').trim();
            const cTxt = String(c.text     ?? '').trim();
            const entries = resolvedConceptos
              .filter(r => r.subAct === subAct && r.cAct === cAct)
              .map(r => r.entry);
            if (!entries.length) continue;

            // ─ SISTEMA (una sola vez por sistema) ──────────────────────────
            if (!sysAdded) {
              cRows.push([
                { text: sysAct, fontSize: 8, bold: true, color: WHITE, fillColor: NAVY },
                { text: '',     fillColor: NAVY },
                { text: '',     fillColor: NAVY },
                { text: sysTxt.toUpperCase(), fontSize: 8, bold: true, color: WHITE, fillColor: NAVY },
                { text: '',     fillColor: NAVY },
              ]);
              sysAdded = true;
            }

            // ─ SUBPARTIDA (una sola vez por subpartida) ────────────────────
            if (!subAdded) {
              cRows.push([
                { text: subAct, fontSize: 8, bold: true, color: NAVY, fillColor: LBLUE },
                { text: '',     fillColor: LBLUE },
                { text: '',     fillColor: LBLUE },
                { text: subTxt.toUpperCase(), fontSize: 8, bold: true, color: NAVY, fillColor: LBLUE },
                { text: '',     fillColor: LBLUE },
              ]);
              subAdded = true;
            }

            // ─ CONCEPTO catálogo ───────────────────────────────────────────
            const edtC = `${subAct}.${cAct}`;
            cRows.push([
              { text: edtC, fontSize: 8, bold: true, color: BLUE, fillColor: '#eaf0fb' },
              { text: '',   fillColor: '#eaf0fb' },
              { text: '',   fillColor: '#eaf0fb' },
              { text: cTxt.toUpperCase(), fontSize: 8, bold: true, color: BLUE, fillColor: '#eaf0fb' },
              { text: '',   fillColor: '#eaf0fb' },
            ]);

            // ─ Entradas de bitácora ────────────────────────────────────────
            for (let ei = 0; ei < entries.length; ei++) {
              const e   = entries[ei];
              const alt = ei % 2 === 0;
              cRows.push([
                dCell(`${edtC}.${SEQ[ei] ?? String(ei + 1)}`, alt),
                dCell(fmtT(e.start), alt, 'center'),
                dCell(fmtT(e.end),   alt, 'center'),
                dCell(String(e.description ?? e.metadata ?? ''), alt),
                dCell(e.quantity != null ? String(e.quantity) : '', alt, 'right'),
              ]);
            }
          }
        }
      }

      const pgConceptos: any[] = [
        mkSectionTitle('Bitácora de Conceptos'),
        cRows.length > 1
          ? {
              table: { widths: [55, 35, 42, '*', 35], headerRows: 1, body: cRows },
              layout: TBL_LAYOUT,
              margin: [0, 0, 0, 10],
            }
          : { text: 'Sin conceptos registrados.', fontSize: 8, color: GRAY, italics: true, margin: [0, 4, 0, 10] },
      ];

      // ── Determinar SISTEMA primario para Descripción de la OT ─────────────
      const primarySistema   = conceptsHierarchy[0] ?? null;
      const sistemaAct       = String(primarySistema?.activity ?? '').trim();
      const sistemaTxt       = String(primarySistema?.text ?? (primarySistema as any)?.Text ?? '').trim();
      const otNumber         = numberContract && sistemaAct
                               ? `${numberContract}-${sistemaAct}`
                               : numberContract || sistemaAct || '—';

      // Fecha formateada para el header (capturada aquí para el closure)
      const reportDateLong     = this.fmtDateLong(report.date);
      const platicasSeguridad  = String(report?.platicasSeguridad ?? (report as any)?.PlaticasSeguridad ?? '');

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

      // • Fotografías — 4 por hoja (2 columnas × 2 filas)
      const pgFotos: any[] = [];
      if (fotoImgs.length > 0) {
        pgFotos.push(mkSectionTitle('Registro Fotográfico', true));

        pgFotos.push({
          text: `Total de fotografías: ${fotoImgs.length}`,
          fontSize: 8, color: GRAY, italics: true,
          margin: [0, 0, 0, 8],
        });

        // Página LETTER portrait: área útil ~462pt alto.
        // 2 filas × (img 165 + desc 14 + márgenes 16) ≈ 390pt → cabe con holgura.
        const mkFotoCell = (f: { key: string; desc: string }): any => ({
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{ image: f.key, fit: [225, 165], alignment: 'center', margin: [0, 4, 0, 4] }]],
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

        // Agrupar en bloques de 4 (2 filas × 2 columnas por hoja)
        const FOTOS_POR_HOJA = 4;
        for (let start = 0; start < fotoImgs.length; start += FOTOS_POR_HOJA) {
          const chunk = fotoImgs.slice(start, start + FOTOS_POR_HOJA);

          const chunkRows: any[] = [];
          for (let i = 0; i < chunk.length; i += 2) {
            chunkRows.push([
              mkFotoCell(chunk[i]),
              (i + 1 < chunk.length) ? mkFotoCell(chunk[i + 1]) : { text: '' },
            ]);
          }

          // pageBreak directo en el objeto — evita el elemento vacío que genera hoja en blanco
          const chunkTable: any = {
            table: { widths: ['50%', '50%'], body: chunkRows },
            layout: 'noBorders',
          };
          if (start > 0) chunkTable.pageBreak = 'before';
          pgFotos.push(chunkTable);
        }
      }

      // ── Definición del documento ──────────────────────────────────────────
      this.loadingMsg = 'Compilando PDF...';
      const docDef: any = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
        pageMargins: [40, 142, 40, 130],
        info: {
          title: `Reporte Diario — ${companyName}`,
          author: companyName,
          subject: 'Reporte Diario de Obra',
        },

        // Header dinámico — aparece en TODAS las páginas
        header: (_currentPage: number, _pageCount: number) => {
          // Helpers compactos (7pt) — márgenes mínimos para no desperdiciar alto
          const il  = (txt: string): any => ({ text: txt, fontSize: 7, bold: true, color: NAVY,              margin: [2, 1, 2, 1] });
          const ilD = (txt: string): any => ({ text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: NAVY, margin: [2, 1, 2, 1] });
          const ic  = (txt: string, extra: any = {}): any => ({ text: txt || '—', fontSize: 7, margin: [2, 1, 2, 1], ...extra });
          // Layout compacto: padding mínimo para que quepan las 6 filas
          const hdrLayout = {
            hLineWidth: () => 0.3, vLineWidth: () => 0.3,
            hLineColor: () => '#cccccc', vLineColor: () => '#cccccc',
            paddingLeft: () => 2, paddingRight: () => 2,
            paddingTop: () => 1, paddingBottom: () => 1,
          };

          return {
            margin: [40, 6, 40, 0],
            stack: [
              // Fila logos + título
              {
                columns: [
                  logoB64  ? { image: 'logo',  width: 42 } : { text: '', width: 42 },
                  {
                    width: '*',
                    stack: [
                      { text: 'REPORTE DE ACTIVIDADES DIARIAS', fontSize: 10, bold: true, color: NAVY, alignment: 'center' },
                      { text: `Contrato No. ${numberContract}`, fontSize: 8, color: NAVY, alignment: 'center', margin: [0, 1, 0, 0] },
                    ],
                  },
                  logo2B64 ? { image: 'logo2', width: 42 } : { text: '', width: 42 },
                ],
                margin: [0, 0, 0, 3],
              },
              // Línea separadora
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 492, y2: 0, lineWidth: 0.8, lineColor: NAVY }] },
              // Tabla de información (6 filas × 4 cols, 7pt, compacta)
              {
                table: {
                  widths: [150, 120, 95, 167],
                  body: [
                    [ il('Inicio de actividades:'),
                      ic(fmtT(report.startTime) ? fmtT(report.startTime) + ' hrs' : '—'),
                      il('No. De Reporte:'),
                      ic(report.numReporte || '—', { bold: true, fillColor: '#FFD700' }) ],
                    [ il('Fin de actividades:'),
                      ic(fmtT(report.endTime) ? fmtT(report.endTime) + ' hrs' : '—'),
                      il('Ubicación:'),
                      ic(report.ubication || '—') ],
                    [ il('Condiciones Meteorológicas:'),
                      ic(report.condition || '—'),
                      il('Fecha:'),
                      ic(reportDateLong) ],
                    [ ilD('Objeto del Contrato'),
                      { text: contratoDesc || '—', fontSize: 7, margin: [2, 1, 2, 1], colSpan: 3, maxLines: 2 }, {}, {} ],
                    [ il('Descripción de la Orden Trabajo'),
                      { text: sistemaTxt || '—', fontSize: 7, margin: [2, 1, 2, 1], colSpan: 2, maxLines: 2 }, {},
                      { text: [
                          { text: 'OT No.: ', fontSize: 7, bold: true, color: NAVY },
                          { text: otNumber || '—', fontSize: 7 },
                        ], margin: [2, 1, 2, 1] } ],
                    [ ilD('Tema de Plática de Seguridad'),
                      { text: platicasSeguridad || '—', fontSize: 7, margin: [2, 1, 2, 1], colSpan: 3 }, {}, {} ],
                  ],
                },
                layout: hdrLayout,
                margin: [0, 3, 0, 0],
              },
            ],
          };
        },

        // Footer: página 1 con firmas, resto solo línea + página
        footer: (currentPage: number, pageCount: number) => {
          const sepLine = { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 492, y2: 0, lineWidth: 0.4, lineColor: '#cccccc' }] };
          const pageNum = {
            columns: [
              { text: companyName, fontSize: 7, color: GRAY, margin: [0, 3, 0, 0] },
              { text: `Pág. ${currentPage} de ${pageCount}`, fontSize: 7, color: GRAY, alignment: 'right', margin: [0, 3, 0, 0] },
            ],
          };

          return {
            margin: [40, 5, 40, 0],
            stack: [
              { text: 'FIRMAS DE AUTORIZACIÓN', fontSize: 8, bold: true, color: NAVY, alignment: 'center', margin: [0, 0, 0, 5] },
              {
                table: {
                  widths: ['33%', '34%', '33%'],
                  body: [
                    [
                      { text: 'SUPERINTENDENTE',   bold: true, fontSize: 7, alignment: 'center', color: NAVY, fillColor: LBLUE },
                      { text: 'RESIDENTE DE OBRA', bold: true, fontSize: 7, alignment: 'center', color: NAVY, fillColor: LBLUE },
                      { text: 'DIRECTOR',          bold: true, fontSize: 7, alignment: 'center', color: NAVY, fillColor: LBLUE },
                    ],
                    [
                      { text: '________________________', alignment: 'center', margin: [0, 10, 0, 2], fontSize: 8, color: GRAY },
                      { text: '________________________', alignment: 'center', margin: [0, 10, 0, 2], fontSize: 8, color: GRAY },
                      { text: '________________________', alignment: 'center', margin: [0, 10, 0, 2], fontSize: 8, color: GRAY },
                    ],
                  ],
                },
                layout: TBL_LAYOUT,
                margin: [0, 0, 0, 8],
              },
              sepLine,
              pageNum,
            ],
          };
        },

        background: wmB64 ? [{
          image: 'wm', width: 380, opacity: 0.05,
          absolutePosition: { x: 116, y: 210 },
        }] : [],

        content: [
          ...pgConceptos,
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

  private fmtDateLong(val: any): string {
    if (!val) return '';
    const s = String(val).substring(0, 10);
    const [y, m, d] = s.split('-');
    if (!d || !m || !y) return s;
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                    'septiembre','octubre','noviembre','diciembre'];
    return `${parseInt(d)} de ${months[parseInt(m) - 1]} del ${y}`;
  }
}
