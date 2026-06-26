import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
import { RootService } from './root.service';
import { SignalsService } from './signals.service';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

export interface ApuPdfData {
  companyName?: string;
  projectTitle?: string;
  contractNumber?: string;
  fecha?: string;
  auxiliar: any;
  cuadrillas: any[];
  materialItems: any[];
  herramientaItems: any[];
  equipoItems: any[];
  factors: Array<{ name: string; percentage: number; sort_order: number }>;
  totalPersonal: number;
  materialTotal: number;
  herramientaTotal: number;
  equipoTotal: number;
  costoTotal: number;
}

@Injectable({ providedIn: 'root' })
export class PdfApuService {
  private rootService    = inject(RootService);
  private signalsService = inject(SignalsService);

  // ── Entry points ──────────────────────────────────────────────────────────
  async openApuPdf(data: ApuPdfData): Promise<void> {
    const logo = await this.loadCompanyLogo();
    pdfMake.createPdf(this.buildDocDef(data, logo)).open();
  }

  async downloadApuPdf(data: ApuPdfData): Promise<void> {
    const logo = await this.loadCompanyLogo();
    const clv  = this.extractClv(data.auxiliar?.description ?? '');
    pdfMake.createPdf(this.buildDocDef(data, logo)).download(`APU_${clv || data.auxiliar?.id}.pdf`);
  }

  // ── Build doc definition ──────────────────────────────────────────────────
  private buildDocDef(data: ApuPdfData, logo: string): any {
    const {
      auxiliar, cuadrillas, materialItems, herramientaItems, equipoItems,
      factors, totalPersonal, materialTotal, herramientaTotal, equipoTotal, costoTotal,
      companyName    = 'PEMEX EXPLORACION Y PRODUCCION',
      projectTitle   = '',
      contractNumber = '',
      fecha          = this.fechaStr(),
    } = data;

    const clv      = this.extractClv(auxiliar?.description ?? '');
    const fullDesc = clv ? (auxiliar.description ?? '').substring(clv.length).trim() : (auxiliar.description ?? '');
    const factRows = this.calcFactors(costoTotal, factors);
    const pu       = factRows[factRows.length - 1].total;

    // colWidths: C(20) | Descripción(*) | Unidad(55) | Cantidad(62) | Precio U.(68) | Total(72)
    const CW = [20, '*', 55, 62, 68, 72];

    const body: any[] = [
      // — header row —
      [
        { text: 'C',           style: 'th', alignment: 'center' },
        { text: 'Descripción', style: 'th' },
        { text: 'Unidad',      style: 'th', alignment: 'center' },
        { text: 'Cantidad',    style: 'th', alignment: 'right' },
        { text: 'Precio U.',   style: 'th', alignment: 'right' },
        { text: 'Total',       style: 'th', alignment: 'right' },
      ]
    ];

    // ── ORDEN PEMEX: Material → Mano de Obra → Herramienta → Equipo ─────────

    // ── Material ──────────────────────────────────────────────────────────
    if (materialItems.length > 0) {
      body.push(this.secRow('Material'));
      for (const it of materialItems) {
        const t = (Number(it.quantity) || 0) * (Number(it.unitCost ?? it.unit_cost) || 0);
        body.push([
          { text: 'M', fontSize: 7, alignment: 'center' },
          { text: it.description ?? '', fontSize: 7 },
          { text: it.unit ?? '',        fontSize: 7, alignment: 'center' },
          { text: this.f5(it.quantity), fontSize: 7, alignment: 'right' },
          { text: this.f2(it.unitCost ?? it.unit_cost), fontSize: 7, alignment: 'right' },
          { text: this.f2(t),           fontSize: 7, alignment: 'right' },
        ]);
      }
      body.push(this.totRow('Total de Material', materialTotal));
    }

    // ── Mano de Obra ──────────────────────────────────────────────────────
    if (cuadrillas.length > 0) {
      body.push(this.secRow('Mano de Obra'));
      for (const c of cuadrillas) {
        const subTotal = this.cuadrillaSub(c);
        const cTotal   = subTotal * (Number(c.cantidad) || 1);
        // cuadrilla header: bullet | description | Jornada | empty | empty | empty
        body.push([
          { text: '•', fontSize: 8, alignment: 'center' },
          { text: c.name ?? '', fontSize: 7, bold: false },
          { text: 'Jornada', fontSize: 7, alignment: 'center' },
          { text: '', fontSize: 7 },
          { text: '', fontSize: 7 },
          { text: '', fontSize: 7 },
        ]);
        // worker rows (indented)
        for (const mi of (c.items ?? [])) {
          const t = (Number(mi.quantity) || 0) * (Number(mi.unitCost ?? mi.unit_cost) || 0);
          body.push([
            { text: '' },
            { text: '   ' + (mi.description ?? ''), fontSize: 7 },
            { text: mi.unit ?? 'Jornada', fontSize: 7, alignment: 'center' },
            { text: this.f5(mi.quantity),                    fontSize: 7, alignment: 'right' },
            { text: this.f2(mi.unitCost ?? mi.unit_cost),    fontSize: 7, alignment: 'right' },
            { text: this.f2(t),                              fontSize: 7, alignment: 'right' },
          ]);
        }
        // Suma row — "Suma" en col Precio U., subtotal en col Total
        body.push([
          { text: '', border: [true, false, false, false], colSpan: 4 }, {}, {}, {},
          { text: 'Suma', fontSize: 7, alignment: 'right', border: [false, false, false, false] },
          { text: this.f2(subTotal), fontSize: 7, alignment: 'right' },
        ]);
        // Cantidad row — "Cantidad : X" ocupa cols 1-3, "Total" en col 4, cTotal en col 5
        body.push([
          { text: '', border: [true, false, false, false] },
          { text: `Cantidad : ${this.f5(c.cantidad)}`, fontSize: 7, alignment: 'right',
            colSpan: 3, border: [false, false, false, false] }, {}, {},
          { text: 'Total', fontSize: 7, alignment: 'right', border: [false, false, false, false] },
          { text: this.f2(cTotal), fontSize: 7, alignment: 'right' },
        ]);
      }
      body.push(this.totRow('Total de Mano de Obra', totalPersonal));
    }

    // ── Herramienta ───────────────────────────────────────────────────────
    if (herramientaItems.length > 0) {
      body.push(this.secRow('Herramienta'));
      for (const it of herramientaItems) {
        const t = (Number(it.quantity) || 0) * totalPersonal;
        body.push([
          { text: '' },
          { text: it.description ?? '', fontSize: 7 },
          { text: '(%)mo',              fontSize: 7, alignment: 'center' },
          { text: this.f5(it.quantity), fontSize: 7, alignment: 'right' },
          { text: this.f2(totalPersonal), fontSize: 7, alignment: 'right' },
          { text: this.f2(t),           fontSize: 7, alignment: 'right' },
        ]);
      }
      body.push(this.totRow('Total de Herramienta', herramientaTotal));
    }

    // ── Equipo ────────────────────────────────────────────────────────────
    if (equipoItems.length > 0) {
      body.push(this.secRow('Equipo'));
      for (const it of equipoItems) {
        const t = (Number(it.quantity) || 0) * (Number(it.unitCost ?? it.unit_cost) || 0);
        body.push([
          { text: 'H', fontSize: 7, alignment: 'center' },
          { text: it.description ?? '', fontSize: 7 },
          { text: it.unit ?? 'Hora',    fontSize: 7, alignment: 'center' },
          { text: this.f5(it.quantity), fontSize: 7, alignment: 'right' },
          { text: this.f2(it.unitCost ?? it.unit_cost), fontSize: 7, alignment: 'right' },
          { text: this.f2(t),           fontSize: 7, alignment: 'right' },
        ]);
      }
      body.push(this.totRow('Total de Equipo', equipoTotal));
    }

    return {
      pageSize:        'LETTER',
      pageOrientation: 'portrait',
      pageMargins:     [36, 40, 36, 40],
      defaultStyle:    { fontSize: 8 },
      styles: {
        th: { bold: true, fontSize: 8, fillColor: '#dce6f1' },
      },
      content: [
        // ── cabecera ────────────────────────────────────────────────────────
        {
          columns: [
            logo
              ? { image: logo, width: 85, height: 42, margin: [0, 0, 8, 0] }
              : { width: 85, text: '' },
            {
              width: '*',
              stack: [
                { text: companyName, fontSize: 9, bold: true, alignment: 'center' },
                { text: 'SUBDIRECCION DE LA COORDINACION DE SERVICIOS MARINOS', fontSize: 7, alignment: 'center' },
              ],
              margin: [0, 4, 0, 0],
            },
            {
              width: 'auto',
              stack: [
                { text: 'ANEXO "H"',                       fontSize: 8, bold: true, alignment: 'right' },
                { text: 'ANALISIS DE PRECIOS UNITARIOS',   fontSize: 7, alignment: 'right' },
                contractNumber
                  ? { text: `LICITACION No. ${contractNumber}`, fontSize: 7, alignment: 'right' }
                  : { text: '' },
                { text: fecha, fontSize: 7, alignment: 'right' },
              ],
            }
          ],
          margin: [0, 0, 0, 4],
        },
        // ── título del proyecto ──────────────────────────────────────────────
        projectTitle
          ? { text: projectTitle, bold: true, fontSize: 8.5, alignment: 'center', margin: [0, 0, 0, 4] }
          : {},
        // ── caja de descripción del APU ──────────────────────────────────────
        {
          table: {
            widths: ['*'],
            body: [
              [{ text: 'Descripción', bold: true, fontSize: 8, fillColor: '#e8e8e8', margin: [3, 2, 3, 2] }],
              [{
                stack: [
                  { text: `Clave: ${auxiliar.id ?? ''}`,  fontSize: 7 },
                  { text: `Clv. Usuario: ${clv}`,          fontSize: 7, margin: [0, 1, 0, 1] },
                  {
                    columns: [
                      { text: fullDesc, fontSize: 7.5, width: '*' },
                      { text: `Unidad : ${auxiliar.unit ?? ''}`, fontSize: 7.5, width: 'auto', margin: [12, 0, 0, 0] },
                    ]
                  },
                ],
                margin: [4, 3, 4, 4],
              }]
            ]
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          margin: [0, 0, 0, 4],
        },
        // ── tabla de componentes ──────────────────────────────────────────────
        {
          table: { widths: CW, body },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          margin: [0, 0, 0, 4],
        },
        // ── cascada de factores ───────────────────────────────────────────────
        this.buildFactorsBlock(factRows),
        // ── monto en palabras ─────────────────────────────────────────────────
        {
          text: `** ${this.numToWords(pu)} **`,
          alignment: 'center', fontSize: 8, bold: true,
          margin: [0, 6, 0, 0],
        },
      ],
    };
  }

  // ── Factors block (table with 3 cols: empty | label right | value right) ──
  private buildFactorsBlock(factRows: Array<{ label: string; total: number; isFinal: boolean }>): any {
    const rows = factRows.map((r, i) => {
      // blank separator row before Precio Unitario
      if (r.isFinal) {
        return [
          [
            { text: '', border: [false,false,false,false] },
            { text: '', border: [false,false,false,false] },
            { text: '', border: [false,false,false,false] },
          ],
          [
            { text: '', border: [false,false,false,false] },
            { text: r.label, fontSize: 8, bold: true, alignment: 'right', border: [false,false,false,true] },
            { text: this.f2(r.total), fontSize: 8, bold: true, alignment: 'right', border: [false,false,false,true] },
          ]
        ];
      }
      return [[
        { text: '', border: [false,false,false,false] },
        { text: r.label, fontSize: 8, alignment: 'right', border: [false,false,false,false] },
        { text: this.f2(r.total), fontSize: 8, alignment: 'right', border: [false,false,false,false] },
      ]];
    }).flat();

    return {
      table: {
        widths: ['*', 160, 82],
        body: rows,
      },
      layout: 'noBorders',
      margin: [0, 4, 0, 4],
    };
  }

  // ── Section row (header: MO / Herramienta / Equipo / Material) ────────────
  private secRow(text: string): any[] {
    return [
      { text: '', border: [true, true, false, true] },
      { text, bold: true, fontSize: 8, colSpan: 5, border: [false, true, true, true] },
      {}, {}, {}, {}
    ];
  }

  // ── Total row ─────────────────────────────────────────────────────────────
  private totRow(label: string, value: number): any[] {
    return [
      { text: '', border: [true, false, false, true] },
      { text: label, bold: true, fontSize: 7.5, colSpan: 4, border: [false, false, false, true] },
      {}, {}, {},
      { text: this.f2(value), bold: true, fontSize: 7.5, alignment: 'right', border: [false, false, true, true] },
    ];
  }

  // ── Cuadrilla subtotal ────────────────────────────────────────────────────
  private cuadrillaSub(c: any): number {
    return (c.items ?? []).reduce((s: number, i: any) =>
      s + (Number(i.quantity) || 0) * (Number(i.unitCost ?? i.unit_cost) || 0), 0);
  }

  // ── Factors cascade (deduplicated by sort_order) ──────────────────────────
  private calcFactors(cd: number, factors: any[]): Array<{ label: string; total: number; isFinal: boolean }> {
    const rows: any[] = [{ label: 'Costo Directo', total: cd, isFinal: false }];
    let running = cd;
    // API retorna sortOrder (camelCase) — nunca sort_order (snake_case)
    const seen = new Set<number>();
    const sorted = [...factors]
      .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0))
      .filter(f => {
        const so = Number(f.sortOrder ?? f.sort_order ?? 0);
        if (seen.has(so)) return false;
        seen.add(so);
        return true;
      });
    sorted.forEach((f, i) => {
      const add = running * (Number(f.percentage) / 100);
      running  += add;
      rows.push({ label: `${f.name} ( ${Number(f.percentage).toFixed(2)}%)`, total: add, isFinal: false });
      if (i < sorted.length - 1) {
        rows.push({ label: 'Subtotal', total: running, isFinal: false });
      }
    });
    rows.push({ label: 'Precio Unitario', total: running, isFinal: true });
    return rows;
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  private f2(v: any): string {
    return (Number(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  private f5(v: any): string { return (Number(v) || 0).toFixed(5); }

  // ── Extract Clv. Usuario from description (e.g. "I.1.1 DESM...") ─────────
  private extractClv(desc: string): string {
    const m = desc.match(/^([A-Z]+(\.\d+)+)\s/);
    return m ? m[1] : '';
  }

  // ── Date string ───────────────────────────────────────────────────────────
  private fechaStr(): string {
    const d = new Date();
    const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                    'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    return `${d.getDate()} DE ${months[d.getMonth()]} DE ${d.getFullYear()}`;
  }

  // ── Number to Spanish words ───────────────────────────────────────────────
  numToWords(n: number): string {
    if (!n) return 'CERO PESOS 00/100 M.N.';
    const intPart = Math.floor(n);
    const dec     = Math.round((n - intPart) * 100);
    return `${this.int2w(intPart, true).toUpperCase()} PESOS ${String(dec).padStart(2, '0')}/100 M.N.`;
  }

  // apocopar: true = apocopar "uno" → "un" (antes de sustantivo masculino)
  private int2w(n: number, apocopar = false): string {
    if (n === 0) return 'cero';
    const U = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
               'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
    const D = ['','','veint','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
    const C = ['','cien','doscientos','trescientos','cuatrocientos','quinientos',
               'seiscientos','setecientos','ochocientos','novecientos'];

    if (n === 1)   return apocopar ? 'un' : 'uno';
    if (n < 20)    return U[n];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      if (t === 2) {
        if (o === 0) return 'veinte';
        if (o === 1) return apocopar ? 'veintiún' : 'veintiuno';
        return 'veinti' + U[o];
      }
      if (o === 0) return D[t];
      if (o === 1) return D[t] + (apocopar ? ' y un' : ' y uno');
      return D[t] + ' y ' + U[o];
    }
    if (n === 100) return 'cien';
    if (n < 1000)  return C[Math.floor(n / 100)] + (n % 100 ? ' ' + this.int2w(n % 100, apocopar) : '');
    if (n < 2000)  return 'mil' + (n % 1000 ? ' ' + this.int2w(n % 1000, apocopar) : '');
    if (n < 1000000) {
      const th = Math.floor(n / 1000);
      return this.int2w(th) + ' mil' + (n % 1000 ? ' ' + this.int2w(n % 1000, apocopar) : '');
    }
    const m = Math.floor(n / 1000000);
    const mw = m === 1 ? 'un millón' : this.int2w(m) + ' millones';
    return mw + (n % 1000000 ? ' ' + this.int2w(n % 1000000, apocopar) : '');
  }

  // ── Logo de la empresa desde root ────────────────────────────────────────
  private async loadCompanyLogo(): Promise<string> {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return '';
    try {
      const company: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      if (company?.picture) return await this.convertImageToBase64(company.picture);
    } catch {}
    return '';
  }

  private convertImageToBase64(imageUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = imageUrl;
    });
  }
}
