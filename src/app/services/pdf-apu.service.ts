import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

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

  // ── Entry points ──────────────────────────────────────────────────────────
  async openApuPdf(data: ApuPdfData): Promise<void> {
    const logo = await this.loadLogo();
    pdfMake.createPdf(this.buildDocDef(data, logo)).open();
  }

  async downloadApuPdf(data: ApuPdfData): Promise<void> {
    const logo = await this.loadLogo();
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

    // colWidths: C | Descripción | Unidad | Cantidad | Precio U. | Total
    const CW = [18, '*', 52, 58, 65, 70];

    const body: any[] = [
      // — header row —
      [
        { text: 'C',           style: 'th', alignment: 'center' },
        { text: 'Descripción', style: 'th' },
        { text: 'Unidad',      style: 'th', alignment: 'center' },
        { text: 'Cantidad',    style: 'th', alignment: 'center' },
        { text: 'Precio U.',   style: 'th', alignment: 'right' },
        { text: 'Total',       style: 'th', alignment: 'right' },
      ]
    ];

    // ── Mano de Obra ─────────────────────────────────────────────────────
    if (cuadrillas.length > 0) {
      body.push(this.secRow('Mano de Obra'));
      for (const c of cuadrillas) {
        const subTotal = this.cuadrillaSub(c);
        const cTotal   = subTotal * (Number(c.cantidad) || 1);
        // cuadrilla name
        body.push([
          { text: '•', fontSize: 7, alignment: 'center' },
          { text: c.name ?? '', fontSize: 7, colSpan: 5 }, {}, {}, {}, {}
        ]);
        // members
        for (const mi of (c.items ?? [])) {
          const t = (Number(mi.quantity) || 0) * (Number(mi.unitCost ?? mi.unit_cost) || 0);
          body.push([
            { text: '' },
            { text: '    ' + (mi.description ?? ''), fontSize: 7 },
            { text: mi.unit ?? 'Jornada', fontSize: 7, alignment: 'center' },
            { text: this.f5(mi.quantity),             fontSize: 7, alignment: 'right' },
            { text: this.f2(mi.unitCost ?? mi.unit_cost), fontSize: 7, alignment: 'right' },
            { text: this.f2(t),                       fontSize: 7, alignment: 'right' },
          ]);
        }
        // suma / cantidad / total
        body.push([
          { text: '', border: [true, false, false, false], colSpan: 4 }, {}, {}, {},
          { text: 'Suma',        fontSize: 7, alignment: 'right', border: [false, false, false, false] },
          { text: this.f2(subTotal), fontSize: 7, alignment: 'right' },
        ]);
        body.push([
          { text: '', border: [true, false, false, false], colSpan: 3 }, {}, {},
          { text: `Cantidad : ${this.f5(c.cantidad)}`, fontSize: 7, alignment: 'right',
            colSpan: 2, border: [false, false, false, false] }, {},
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
          { text: it.unit ?? '(%)mo', fontSize: 7, alignment: 'center' },
          { text: this.f5(it.quantity),   fontSize: 7, alignment: 'right' },
          { text: this.f2(totalPersonal), fontSize: 7, alignment: 'right' },
          { text: this.f2(t),             fontSize: 7, alignment: 'right' },
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
              ? { image: logo, width: 80, height: 42, margin: [0, 0, 8, 0] }
              : { width: 80, text: '' },
            {
              width: '*',
              stack: [
                { text: companyName, fontSize: 10, bold: true, alignment: 'center' },
                { text: 'SUBDIRECCION DE LA COORDINACION DE SERVICIOS MARINOS', fontSize: 7, alignment: 'center' },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'ANEXO "H"',                       fontSize: 8, bold: true, alignment: 'right' },
                { text: 'ANALISIS DE PRECIOS UNITARIOS',   fontSize: 7, alignment: 'right' },
                contractNumber ? { text: `LICITACION No. ${contractNumber}`, fontSize: 7, alignment: 'right' } : {},
                { text: fecha,                             fontSize: 7, alignment: 'right' },
              ],
            }
          ],
          margin: [0, 0, 0, 6],
        },
        // ── título del proyecto ──────────────────────────────────────────────
        projectTitle
          ? { text: projectTitle, bold: true, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 6] }
          : {},
        // ── caja de descripción del APU ──────────────────────────────────────
        {
          table: {
            widths: ['*'],
            body: [
              [{ text: 'Descripción', bold: true, fontSize: 8, fillColor: '#e8e8e8', margin: [3,2,3,2] }],
              [{
                stack: [
                  {
                    columns: [
                      { text: `Clave: ${auxiliar.id ?? ''}`, fontSize: 7, width: '*' },
                      { text: `Clv. Usuario: ${clv}`,        fontSize: 7, width: 'auto' },
                    ]
                  },
                  {
                    columns: [
                      { text: fullDesc, fontSize: 7.5, width: '*', margin: [0,2,0,0] },
                      { text: `Unidad : ${auxiliar.unit ?? ''}`, fontSize: 7.5, width: 'auto', margin: [10,2,0,0] },
                    ]
                  },
                ],
                margin: [4, 2, 4, 4],
              }]
            ]
          },
          layout: { defaultBorder: true, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          margin: [0, 0, 0, 4],
        },
        // ── tabla de componentes ──────────────────────────────────────────────
        {
          table: { widths: CW, body },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          margin: [0, 0, 0, 6],
        },
        // ── cascada de factores ───────────────────────────────────────────────
        {
          table: {
            widths: ['*', 145, 80],
            body: factRows.map(r => [
              { text: '',      border: [false,false,false,false] },
              { text: r.label, border: [false,false,false,false], alignment: 'right',
                fontSize: 8, bold: r.isFinal },
              { text: this.f2(r.total), border: [false, false, false, r.isFinal],
                alignment: 'right', fontSize: 8, bold: r.isFinal },
            ]),
          },
          layout: 'noBorders',
          margin: [0, 2, 0, 6],
        },
        // ── monto en palabras ─────────────────────────────────────────────────
        {
          text: `** ${this.numToWords(pu)} **`,
          alignment: 'center', fontSize: 8, bold: true,
          margin: [0, 4, 0, 0],
        },
      ],
    };
  }

  // ── Section row (Mano de Obra / Herramienta / Equipo / Material) ──────────
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

  // ── Factors cascade ───────────────────────────────────────────────────────
  private calcFactors(cd: number, factors: any[]): Array<{ label: string; total: number; isFinal: boolean }> {
    const rows: any[] = [{ label: 'Costo Directo', total: cd, isFinal: false }];
    let running = cd;
    // deduplicate by sort_order — DB sometimes has repeated rows from multiple inserts
    const seen = new Set<number>();
    const sorted = [...factors]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .filter(f => { const so = Number(f.sort_order) || 0; if (seen.has(so)) return false; seen.add(so); return true; });
    sorted.forEach((f, i) => {
      const add = running * (Number(f.percentage) / 100);
      running  += add;
      rows.push({ label: `${f.name} ( ${Number(f.percentage).toFixed(2)}%)`, total: add, isFinal: false });
      if (i < sorted.length - 1) rows.push({ label: 'Subtotal', total: running, isFinal: false });
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
    return `${this.int2w(intPart).toUpperCase()} PESOS ${String(dec).padStart(2, '0')}/100 M.N.`;
  }

  private int2w(n: number): string {
    if (n === 0) return 'cero';
    const U = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
               'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
    const D = ['','','veint','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
    const C = ['','cien','doscientos','trescientos','cuatrocientos','quinientos',
               'seiscientos','setecientos','ochocientos','novecientos'];
    if (n < 20)   return U[n];
    if (n < 100) {
      const t = Math.floor(n/10), o = n%10;
      if (t === 2) return o ? 'veinti' + U[o] : 'veinte';
      return D[t] + (o ? ' y ' + U[o] : '');
    }
    if (n === 100) return 'cien';
    if (n < 1000)  return C[Math.floor(n/100)] + (n%100 ? ' ' + this.int2w(n%100) : '');
    if (n < 2000)  return 'mil' + (n%1000 ? ' ' + this.int2w(n%1000) : '');
    if (n < 1000000) {
      const th = Math.floor(n/1000);
      return this.int2w(th) + ' mil' + (n%1000 ? ' ' + this.int2w(n%1000) : '');
    }
    const m = Math.floor(n/1000000);
    const mw = m === 1 ? 'un millón' : this.int2w(m) + ' millones';
    return mw + (n%1000000 ? ' ' + this.int2w(n%1000000) : '');
  }

  // ── Logo loader ───────────────────────────────────────────────────────────
  private loadLogo(): Promise<string> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.readAsDataURL(xhr.response);
      };
      xhr.onerror = () => resolve('');
      xhr.open('GET', 'assets/img/template/bi.png');
      xhr.responseType = 'blob';
      xhr.send();
    });
  }
}
