import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
import { RootService } from './root.service';
import { SignalsService } from './signals.service';
import { TrackingService } from './tracking.service';
import { apuFactorSteps, apuMoney } from 'app/domains/ModProjects/components/auxiliares/apu-pricing';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

export interface ApuPdfData {
  // Textos del encabezado (configurables por contrato)
  companyName?:   string;
  subdirection?:  string;
  anexoLabel?:    string;
  analysisTitle?: string;
  licitacionNo?:  string;
  projectTitle?:  string;   // Título del proyecto/obra
  fecha?:         string;   // Auto-generada si no se provee
  auxiliar: any;
  cuadrillas: any[];
  materialItems: any[];
  herramientaItems: any[];
  equipoItems: any[];
  auxiliarItems: any[];
  factors: Array<{ name: string; percentage: number; sort_order: number }>;
  totalPersonal: number;
  materialTotal: number;
  herramientaTotal: number;
  equipoTotal: number;
  auxiliarTotal: number;
  costoTotal: number;
}

export interface ApuCatalogPdfData {
  companyName?: string;
  projectTitle?: string;
  licitacionNo?: string;
  auxiliars: any[];
  factors: Array<{ name: string; percentage: number }>;
}

@Injectable({ providedIn: 'root' })
export class PdfApuService {
  private rootService     = inject(RootService);
  private signalsService  = inject(SignalsService);
  private trackingService = inject(TrackingService);

  // ── Entry points ──────────────────────────────────────────────────────────
  async openApuPdf(data: ApuPdfData): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), `Abrió APU PDF: ${data.auxiliar?.clave ?? data.auxiliar?.id}`, 'Proyectos / APU', this.trackingService.getEmail());
    const brand = await this.loadCompanyBrand();
    pdfMake.createPdf(this.buildDocDef(data, brand)).open();
  }

  async downloadApuPdf(data: ApuPdfData): Promise<void> {
    const clv  = data.auxiliar?.clave ?? data.auxiliar?.claveUsuario ?? data.auxiliar?.id;
    this.trackingService.addLog(this.trackingService.getnameComp(), `Descargó APU PDF: ${clv}`, 'Proyectos / APU', this.trackingService.getEmail());
    const brand = await this.loadCompanyBrand();
    pdfMake.createPdf(this.buildDocDef(data, brand)).download(`APU_${clv}.pdf`);
  }

  async openApusPdf(data: ApuPdfData[]): Promise<void> {
    if (!data.length) return;
    const brand = await this.loadCompanyBrand();
    const docs = data.map(item => this.buildDocDef(item, brand));
    const content: any[] = [];
    docs.forEach((doc, index) => {
      const section = [...doc.content];
      if (index && section.length) section[0] = { ...section[0], pageBreak: 'before' };
      content.push(...section);
    });
    pdfMake.createPdf({ ...docs[0], content }).open();
    this.trackingService.addLog(this.trackingService.getnameComp(), `Abrió explosión PDF de ${data.length} APUs`, 'Proyectos / APU', this.trackingService.getEmail());
  }

  async openCatalogPdf(data: ApuCatalogPdfData): Promise<void> {
    const brand = await this.loadCompanyBrand();
    const body: any[] = [[
      { text: 'Clave', style: 'th' },
      { text: 'Descripción', style: 'th' },
      { text: 'Unidad', style: 'th' },
      { text: 'Costo directo', style: 'th', alignment: 'right' },
      { text: 'P.U. calculado', style: 'th', alignment: 'right' },
      { text: 'P.U. guardado', style: 'th', alignment: 'right' },
      { text: 'Diferencia', style: 'th', alignment: 'right' },
    ]];
    for (const item of data.auxiliars) {
      const directCost = apuMoney(Number(item.costMN ?? item.cost_mn) || 0);
      const steps = apuFactorSteps(directCost, data.factors);
      const price = steps.length ? steps[steps.length - 1].subtotal : directCost;
      const savedPrice = apuMoney(Number(item.precioUnitario ?? item.precio_unitario) || 0);
      const difference = apuMoney(savedPrice - price);
      body.push([
        String(item.claveUsuario || item.clave || ''),
        String(item.description || ''),
        String(item.unit || ''),
        { text: this.f2(directCost), alignment: 'right' },
        { text: this.f2(price), alignment: 'right', bold: true },
        { text: this.f2(savedPrice), alignment: 'right' },
        { text: this.f2(difference), alignment: 'right', color: difference ? '#b91c1c' : '#15803d' },
      ]);
    }
    const factorText = (data.factors ?? []).map(f => `${f.name}: ${Number(f.percentage || 0).toFixed(2)}%`).join('  ·  ');
    pdfMake.createPdf({
      pageSize: 'LETTER', pageOrientation: 'landscape', pageMargins: [35, 75, 35, 40],
      header: { columns: [
        brand.logo ? { image: brand.logo, fit: [85, 42], width: 90 } : { text: '', width: 90 },
        { text: [
          { text: `${data.companyName || brand.companyName || 'EMPRESA'}\n`, bold: true, fontSize: 11 },
          { text: data.projectTitle || '', fontSize: 9 },
        ], alignment: 'center', width: '*' },
        brand.secondaryLogo ? { image: brand.secondaryLogo, fit: [85, 42], width: 90, alignment: 'right' } : { text: '', width: 90 },
      ], margin: [35, 20, 35, 0] },
      content: [
        { text: 'CATÁLOGO DE PRECIOS UNITARIOS', bold: true, fontSize: 13, margin: [0, 0, 0, 3] },
        { text: [data.licitacionNo ? `Licitación: ${data.licitacionNo}  ·  ` : '', `Fecha: ${this.fechaStr()}`], fontSize: 8, margin: [0, 0, 0, 4] },
        { text: factorText || 'Sin factores configurados', fontSize: 8, color: '#475569', margin: [0, 0, 0, 8] },
        { text: 'Diferencia = P.U. guardado − P.U. calculado', fontSize: 7, color: '#475569', margin: [0, 0, 0, 5] },
        { table: { headerRows: 1, widths: [65, '*', 48, 75, 75, 75, 65], body }, layout: 'lightHorizontalLines', fontSize: 8 },
      ],
      styles: { th: { bold: true, fillColor: '#dbeafe', fontSize: 8 } },
      footer: (page: number, pages: number) => ({ text: `Página ${page} de ${pages}`, alignment: 'center', fontSize: 7, color: '#64748b' }),
    } as any).open();
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Abrió catálogo de precios unitarios PDF', 'Proyectos / APU', this.trackingService.getEmail());
  }

  // ── Build doc definition ──────────────────────────────────────────────────
  private buildDocDef(data: ApuPdfData, brand: { logo: string; secondaryLogo: string; companyName: string }): any {
    const {
      auxiliar, cuadrillas, materialItems, herramientaItems, equipoItems, auxiliarItems,
      factors, totalPersonal, materialTotal, herramientaTotal, equipoTotal, auxiliarTotal, costoTotal,
      companyName   = brand.companyName || 'EMPRESA',
      subdirection  = '',
      anexoLabel    = '',
      analysisTitle = 'ANALISIS DE PRECIOS UNITARIOS',
      licitacionNo  = '',
      projectTitle  = '',
      fecha         = this.fechaStr(),
    } = data;

    const clv      = auxiliar?.claveUsuario ?? auxiliar?.clave_usuario ?? '';
    const fullDesc = auxiliar?.description ?? '';
    const factRows = this.calcFactors(costoTotal, factors);
    const savedUnitPrice = Number(auxiliar?.precioUnitario ?? auxiliar?.precio_unitario);
    if (Number.isFinite(savedUnitPrice) && savedUnitPrice > 0) factRows[factRows.length - 1].total = apuMoney(savedUnitPrice);
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
        const t = apuMoney((Number(it.quantity) || 0) * (Number(it.unitCost ?? it.unit_cost) || 0));
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
        const cTotal   = apuMoney(subTotal * (Number(c.cantidad) || 1));
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
          const t = apuMoney((Number(mi.quantity) || 0) * (Number(mi.unitCost ?? mi.unit_cost) || 0));
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
        const t = apuMoney((Number(it.quantity) || 0) * totalPersonal);
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
        const t = apuMoney((Number(it.quantity) || 0) * (Number(it.unitCost ?? it.unit_cost) || 0));
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

    if (auxiliarItems?.length > 0) {
      body.push(this.secRow('Auxiliares'));
      for (const it of auxiliarItems) {
        const total = apuMoney((Number(it.quantity) || 0) * (Number(it.unitCost) || 0));
        body.push([
          { text: 'A', fontSize: 7, alignment: 'center' },
          { text: it.description ?? '', fontSize: 7 },
          { text: it.unit ?? '', fontSize: 7, alignment: 'center' },
          { text: this.f5(it.quantity), fontSize: 7, alignment: 'right' },
          { text: this.f2(it.unitCost), fontSize: 7, alignment: 'right' },
          { text: this.f2(total), fontSize: 7, alignment: 'right' },
        ]);
      }
      body.push(this.totRow('Total de Auxiliares', auxiliarTotal));
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
            brand.logo
              ? { image: brand.logo, fit: [85, 42], width: 85, margin: [0, 0, 8, 0] }
              : { width: 85, text: '' },
            {
              width: '*',
              stack: [
                { text: companyName || brand.companyName || 'EMPRESA', fontSize: 9, bold: true, alignment: 'center' },
                { text: subdirection, fontSize: 7,             alignment: 'center' },
              ],
              margin: [0, 4, 0, 0],
            },
            {
              width: 145,
              stack: [
                ...(brand.secondaryLogo ? [{ image: brand.secondaryLogo, fit: [90, 34], alignment: 'right', margin: [0, 0, 0, 3] }] : []),
                { text: anexoLabel,    fontSize: 8, bold: true, alignment: 'right' },
                { text: analysisTitle, fontSize: 7,             alignment: 'right' },
                licitacionNo
                  ? { text: `LICITACION No. ${licitacionNo}`, fontSize: 7, alignment: 'right' }
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
                  { text: `Clave: ${auxiliar.clave ?? auxiliar.id ?? ''}`,  fontSize: 7 },
                  { text: `Clv. Usuario: ${clv}`,                          fontSize: 7, margin: [0, 1, 0, 1] },
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
      footer: (page: number, pages: number) => ({
        text: `Página ${page} de ${pages}`,
        alignment: 'center', fontSize: 7, color: '#64748b', margin: [0, 8, 0, 0],
      }),
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
    return apuMoney((c.items ?? []).reduce((s: number, i: any) =>
      s + apuMoney((Number(i.quantity) || 0) * (Number(i.unitCost ?? i.unit_cost) || 0)), 0));
  }

  // ── Misma cascada de factores que la pantalla y el recálculo ──────────────
  private calcFactors(cd: number, factors: any[]): Array<{ label: string; total: number; isFinal: boolean }> {
    const rows: any[] = [{ label: 'Costo Directo', total: apuMoney(cd), isFinal: false }];
    const steps = apuFactorSteps(cd, factors);
    steps.forEach((step, i) => {
      rows.push({ label: `${step.name} ( ${step.percentage.toFixed(2)}%)`, total: step.amount, isFinal: false });
      if (i < steps.length - 1) {
        rows.push({ label: 'Subtotal', total: step.subtotal, isFinal: false });
      }
    });
    rows.push({ label: 'Precio Unitario', total: steps.at(-1)?.subtotal ?? apuMoney(cd), isFinal: true });
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
  private async loadCompanyBrand(): Promise<{ logo: string; secondaryLogo: string; companyName: string }> {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return { logo: '', secondaryLogo: '', companyName: '' };
    try {
      const company: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      const [logo, secondaryLogo] = await Promise.all([
        company?.picture ? this.convertImageToBase64(company.picture) : '',
        company?.picture2 ? this.convertImageToBase64(company.picture2) : '',
      ]);
      return { logo, secondaryLogo, companyName: company?.name ?? '' };
    } catch {}
    return { logo: '', secondaryLogo: '', companyName: '' };
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
