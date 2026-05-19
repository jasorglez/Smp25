import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { TrackingService } from 'app/services/tracking.service';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = pdfFonts.vfs;

export interface PhoneRow {
  phone: string;
  visitCount: number;
  totalAmount: number;
  lastVisit: string;
  products: { description: string; totalQty: number; totalAmount: number; purchaseCount: number }[];
}

export interface SaleReport {
  id: number;
  numberNote: string;
  date: string;
  amount: number;
  paymentType: string;
  idCashRegister: number | null;
  idCustomer: number;
  concepts: ConceptReport[];
}

export interface ConceptReport {
  id: number;
  idProduct: number | null;
  description: string | null;
  quantity: number;
  pu: number;
  total: number;
}

@Component({
  selector: 'app-sales-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-reports.component.html',
  styleUrl: './sales-reports.component.scss',
})
export class SalesReportsComponent implements OnInit {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  dateFrom = this.todayStr();
  dateTo   = this.todayStr();

  // Filtros de tipo
  filterTypes = {
    EFECTIVO: true,
    TARJETA:  true,
    CHEQUE:   true,
    VALES:    true,
  };
  detallado = false;

  sales: SaleReport[] = [];
  loading   = false;
  consulted = false;
  errorMsg  = '';

  // --- Pestaña: Reporte por Celular ---
  activeTab: 'ventas' | 'celular' = 'ventas';
  phoneMode: 'single' | 'all' = 'single';

  // Modo: un celular específico
  phoneSearch    = '';
  phoneLoading   = false;
  phoneConsulted = false;
  phoneErrorMsg  = '';
  phoneSummary: any = null;
  phoneLoyalty: any = null;
  phoneLoyaltyTxns: any[] = [];

  // Modo: todos los celulares
  allPhoneFrom    = this.monthStartStr();
  allPhoneTo      = this.todayStr();
  allPhoneLoading = false;
  allPhoneConsulted = false;
  allPhoneErrorMsg  = '';
  allPhoneRows: PhoneRow[] = [];
  expandedPhones = new Set<string>();

  get phoneSearchValid(): boolean {
    return this.phoneSearch.trim().length === 10;
  }

  get allPhoneTotal(): number {
    return this.allPhoneRows.reduce((s, r) => s + r.totalAmount, 0);
  }

  togglePhone(phone: string) {
    if (this.expandedPhones.has(phone)) this.expandedPhones.delete(phone);
    else this.expandedPhones.add(phone);
  }

  // Totales
  get totalVentas()   { return this.sales.reduce((s, v) => s + v.amount, 0); }
  get totalEfectivo() { return this.sales.filter(v => v.paymentType === 'EFECTIVO').reduce((s, v) => s + v.amount, 0); }
  get totalTarjeta()  { return this.sales.filter(v => v.paymentType === 'TARJETA').reduce((s, v) => s + v.amount, 0); }
  get totalCheque()   { return this.sales.filter(v => v.paymentType === 'CHEQUE').reduce((s, v) => s + v.amount, 0); }
  get totalVales()    { return this.sales.filter(v => v.paymentType === 'VALES').reduce((s, v) => s + v.amount, 0); }

  get salesFiltered(): SaleReport[] {
    return this.sales.filter(s =>
      (this.filterTypes as any)[s.paymentType] !== false
    );
  }

  async ngOnInit() {}

  async consultar() {
    this.loading  = true;
    this.consulted = false;
    this.errorMsg = '';
    try {
      const url = `${environment.urlAdministration}/Salesxcustomer/report?dateFrom=${this.dateFrom}&dateTo=${this.dateTo}&paymentType=TODAS`;
      this.sales = await firstValueFrom(
        this.http.get<SaleReport[]>(url, { headers: this.trackingService.getHeaders() })
      );
      this.consulted = true;
    } catch {
      this.errorMsg = 'Error al cargar el reporte. Verifica tu conexión.';
    } finally {
      this.loading = false;
    }
  }

  async imprimirPDF() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    let logoBase64: string | null = null;
    try {
      const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      if (rootResponse?.picture) {
        logoBase64 = await this.base64EncodeService.convertImageToBase64(rootResponse.picture);
      }
    } catch { /* logo is optional */ }

    const rows = this.salesFiltered;
    const fmt  = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');
    const payLabel = (t: string) => ({ EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', CHEQUE: 'Cheque', VALES: 'Vales' })[t] ?? t;

    // Construir filas del body
    const bodyRows: any[][] = [];

    if (this.detallado) {
      for (const sale of rows) {
        // Fila de cabecera de la venta
        bodyRows.push([
          { text: fmtDate(sale.date), style: 'saleRow' },
          { text: sale.numberNote,    style: 'saleRow' },
          { text: '',                 style: 'saleRow' },
          { text: payLabel(sale.paymentType), style: 'saleRow' },
          { text: '',  style: 'saleRow' },
          { text: '',  style: 'saleRow' },
          { text: fmt(sale.amount), style: 'saleRowAmt', alignment: 'right' },
        ]);
        // Filas de concepto
        for (const c of sale.concepts) {
          bodyRows.push([
            '',
            '',
            { text: c.description || (c.idProduct ? `#${c.idProduct}` : `${fmt(c.pu)} ×${c.quantity}`), style: 'conceptRow' },
            '',
            { text: String(c.quantity),  style: 'conceptRow', alignment: 'right' },
            { text: fmt(c.pu),           style: 'conceptRow', alignment: 'right' },
            { text: fmt(c.total),        style: 'conceptRow', alignment: 'right' },
          ]);
        }
      }
    } else {
      for (const sale of rows) {
        const conceptLabel = (c: ConceptReport) =>
          c.description || (c.idProduct ? `#${c.idProduct}` : `${fmt(c.pu)} ×${c.quantity}`);
        const desc = sale.concepts.map(conceptLabel).join(', ');
        bodyRows.push([
          fmtDate(sale.date),
          sale.numberNote,
          { text: desc, style: 'cell' },
          payLabel(sale.paymentType),
          { text: sale.concepts.reduce((s, c) => s + c.quantity, 0).toString(), alignment: 'right' },
          { text: sale.concepts.length > 1 ? '—' : fmt(sale.concepts[0]?.pu ?? 0), alignment: 'right' },
          { text: fmt(sale.amount), alignment: 'right', bold: true },
        ]);
      }
    }

    // Fila de totales
    bodyRows.push([
      { text: 'TOTAL', colSpan: 6, bold: true, alignment: 'right', fillColor: '#f1f5f9' },
      {}, {}, {}, {}, {},
      { text: fmt(this.totalVentas), bold: true, alignment: 'right', fillColor: '#f1f5f9' },
    ]);

    const docDef: any = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 40],
      content: [
        ...(logoBase64 ? [{
          columns: [
            { image: logoBase64, width: 80 },
            { text: 'Reporte de Ventas por Fechas', style: 'header', alignment: 'right', margin: [0, 10, 0, 0] },
          ],
          margin: [0, 0, 0, 4],
        }] : [
          { text: 'Reporte de Ventas por Fechas', style: 'header' },
        ]),
        {
          columns: [
            { text: `Período: ${this.dateFrom}  al  ${this.dateTo}`, style: 'subheader' },
            { text: `Generado: ${new Date().toLocaleString('es-MX')}`, style: 'subheader', alignment: 'right' },
          ],
          margin: [0, 0, 0, 6],
        },
        // Resumen de totales por forma de pago
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'Efectivo', style: 'sumLabel' },
                { text: 'Tarjeta',  style: 'sumLabel' },
                { text: 'Cheque',   style: 'sumLabel' },
                { text: 'Vales',    style: 'sumLabel' },
              ],
              [
                { text: fmt(this.totalEfectivo), style: 'sumVal' },
                { text: fmt(this.totalTarjeta),  style: 'sumVal' },
                { text: fmt(this.totalCheque),   style: 'sumVal' },
                { text: fmt(this.totalVales),    style: 'sumVal' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 10],
        },
        // Tabla principal
        {
          table: {
            headerRows: 1,
            widths: [55, 80, '*', 60, 35, 60, 70],
            body: [
              [
                { text: 'Fecha',        style: 'tableHeader' },
                { text: 'No. Ticket',   style: 'tableHeader' },
                { text: 'Artículo',     style: 'tableHeader' },
                { text: 'Forma Pago',   style: 'tableHeader' },
                { text: 'Cant.',        style: 'tableHeader', alignment: 'right' },
                { text: 'Precio',       style: 'tableHeader', alignment: 'right' },
                { text: 'Total',        style: 'tableHeader', alignment: 'right' },
              ],
              ...bodyRows,
            ],
          },
          layout: 'lightHorizontalLines',
        },
        {
          text: `Total de tickets: ${rows.length}   |   Total: ${fmt(this.totalVentas)}`,
          style: 'footer', margin: [0, 10, 0, 0],
        },
      ],
      styles: {
        header:      { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        subheader:   { fontSize: 9, color: '#64748b' },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#1e3a5f', color: '#ffffff', margin: [2, 4, 2, 4] },
        sumLabel:    { bold: true, fontSize: 9, alignment: 'center', fillColor: '#e2e8f0' },
        sumVal:      { fontSize: 10, alignment: 'center', bold: true, color: '#16a34a' },
        saleRow:     { fontSize: 9, bold: true },
        saleRowAmt:  { fontSize: 9, bold: true },
        conceptRow:  { fontSize: 8, color: '#475569', margin: [8, 1, 0, 1] },
        cell:        { fontSize: 9 },
        footer:      { fontSize: 9, bold: true, alignment: 'right', color: '#1e3a5f' },
      },
      defaultStyle: { fontSize: 9 },
    };

    pdfMake.createPdf(docDef).open();
  }

  // ---- PDF: Un celular ----
  async imprimirPDFCelular() {
    if (!this.phoneSummary) return;
    const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
    const logoBase64 = await this.loadLogo();
    const s = this.phoneSummary;
    const loy = this.phoneLoyalty;

    const productRows: any[][] = (s.products ?? []).map((p: any) => [
      { text: p.description || `#${p.idProduct}`, style: 'cell' },
      { text: p.totalQty,                style: 'cellR', alignment: 'right' },
      { text: fmt(p.totalAmount),         style: 'cellR', alignment: 'right' },
      { text: p.purchaseCount,            style: 'cellR', alignment: 'right' },
    ]);

    const txnRows: any[][] = (this.phoneLoyaltyTxns ?? []).map(t => [
      { text: new Date(t.date).toLocaleDateString('es-MX'), style: 'cell' },
      { text: `#${t.idSale}`,                               style: 'cell' },
      { text: fmt(t.amount),             style: 'cell', alignment: 'right' },
      { text: `${Math.round(t.factorUsed * 100)}%`,         style: 'cell', alignment: 'right' },
      { text: `+${t.pointsEarned}`,      style: 'cell', alignment: 'right', color: '#b45309' },
    ]);

    const docDef: any = {
      pageSize: 'LETTER', pageMargins: [40, 55, 40, 40],
      content: [
        ...(logoBase64 ? [{ columns: [{ image: logoBase64, width: 70 }, { text: 'Reporte de Cliente por Celular', style: 'header', alignment: 'right', margin: [0, 10, 0, 0] }], margin: [0, 0, 0, 6] }]
          : [{ text: 'Reporte de Cliente por Celular', style: 'header', margin: [0, 0, 0, 6] }]),
        { text: `Generado: ${new Date().toLocaleString('es-MX')}`, style: 'sub', margin: [0, 0, 0, 10] },
        // Resumen
        { text: 'Resumen del cliente', style: 'section' },
        { table: { widths: ['*', '*', '*', '*'], body: [
          [{ text: 'Celular', style: 'sumLabel' }, { text: 'Visitas', style: 'sumLabel' }, { text: 'Total comprado', style: 'sumLabel' }, { text: 'Última visita', style: 'sumLabel' }],
          [{ text: s.phone, style: 'sumVal' }, { text: s.visitCount, style: 'sumVal' }, { text: fmt(s.totalAmount), style: 'sumVal', color: '#16a34a' },
           { text: new Date(s.lastVisit).toLocaleDateString('es-MX'), style: 'sumVal' }],
        ]}, layout: 'lightHorizontalLines', margin: [0, 0, 0, 10] },
        // Puntos
        ...(loy ? [
          { text: 'Puntos de fidelidad', style: 'section' },
          { table: { widths: ['*', '*'], body: [
            [{ text: 'Puntos acumulados', style: 'sumLabel' }, { text: 'Última actualización', style: 'sumLabel' }],
            [{ text: `★ ${loy.totalPoints}`, style: 'sumVal', color: '#b45309', fontSize: 14, bold: true },
             { text: new Date(loy.updatedAt).toLocaleDateString('es-MX'), style: 'sumVal' }],
          ]}, layout: 'lightHorizontalLines', margin: [0, 0, 0, 10] },
        ] : []),
        // Productos
        ...(productRows.length ? [
          { text: 'Productos comprados', style: 'section' },
          { table: { headerRows: 1, widths: ['*', 60, 80, 60], body: [
            [{ text: 'Descripción', style: 'th' }, { text: 'Cantidad', style: 'th', alignment: 'right' },
             { text: 'Importe', style: 'th', alignment: 'right' }, { text: 'Veces', style: 'th', alignment: 'right' }],
            ...productRows,
          ]}, layout: 'lightHorizontalLines', margin: [0, 0, 0, 10] },
        ] : []),
        // Historial puntos
        ...(txnRows.length ? [
          { text: 'Historial de puntos ganados', style: 'section' },
          { table: { headerRows: 1, widths: [70, 50, 70, 50, 60], body: [
            [{ text: 'Fecha', style: 'th' }, { text: 'Venta #', style: 'th' },
             { text: 'Monto', style: 'th', alignment: 'right' }, { text: 'Factor', style: 'th', alignment: 'right' },
             { text: 'Puntos', style: 'th', alignment: 'right' }],
            ...txnRows,
          ]}, layout: 'lightHorizontalLines' },
        ] : []),
      ],
      styles: {
        header:  { fontSize: 15, bold: true },
        sub:     { fontSize: 8, color: '#64748b' },
        section: { fontSize: 10, bold: true, margin: [0, 4, 0, 4], color: '#1e3a5f' },
        sumLabel:{ bold: true, fontSize: 8, alignment: 'center', fillColor: '#e2e8f0' },
        sumVal:  { fontSize: 9, alignment: 'center', bold: true },
        th:      { bold: true, fontSize: 8, fillColor: '#1e3a5f', color: '#ffffff', margin: [2, 3, 2, 3] },
        cell:    { fontSize: 8 },
        cellR:   { fontSize: 8 },
      },
      defaultStyle: { fontSize: 8 },
    };
    pdfMake.createPdf(docDef).open();
  }

  // ---- PDF: Todos los celulares ----
  async imprimirPDFTodos() {
    if (!this.allPhoneRows.length) return;
    const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
    const logoBase64 = await this.loadLogo();

    const bodyRows: any[][] = [];
    for (const row of this.allPhoneRows) {
      // Fila del teléfono
      bodyRows.push([
        { text: row.phone,              bold: true, fontSize: 9, fillColor: '#e8f0fe' },
        { text: row.visitCount,         bold: true, fontSize: 9, fillColor: '#e8f0fe', alignment: 'right' },
        { text: fmt(row.totalAmount),   bold: true, fontSize: 9, fillColor: '#e8f0fe', alignment: 'right', color: '#16a34a' },
        { text: new Date(row.lastVisit).toLocaleDateString('es-MX'), fontSize: 8, fillColor: '#e8f0fe' },
      ]);
      // Filas de productos
      for (const p of row.products) {
        bodyRows.push([
          { text: `   ${p.description}`, fontSize: 7, color: '#475569' },
          { text: p.totalQty,   fontSize: 7, color: '#475569', alignment: 'right' },
          { text: fmt(p.totalAmount), fontSize: 7, color: '#475569', alignment: 'right' },
          { text: `${p.purchaseCount} vez`, fontSize: 7, color: '#94a3b8' },
        ]);
      }
    }
    // Fila total
    bodyRows.push([
      { text: 'TOTAL', colSpan: 2, bold: true, alignment: 'right', fillColor: '#1e3a5f', color: '#fff', fontSize: 9 },
      {},
      { text: fmt(this.allPhoneTotal), bold: true, alignment: 'right', fillColor: '#1e3a5f', color: '#fff', fontSize: 9 },
      { text: '', fillColor: '#1e3a5f' },
    ]);

    const docDef: any = {
      pageSize: 'LETTER', pageMargins: [40, 55, 40, 40],
      content: [
        ...(logoBase64 ? [{ columns: [{ image: logoBase64, width: 70 }, { text: 'Reporte de Clientes por Celular', style: 'header', alignment: 'right', margin: [0, 10, 0, 0] }], margin: [0, 0, 0, 4] }]
          : [{ text: 'Reporte de Clientes por Celular', style: 'header', margin: [0, 0, 0, 4] }]),
        { columns: [
          { text: `Período: ${this.allPhoneFrom}  al  ${this.allPhoneTo}`, style: 'sub' },
          { text: `Generado: ${new Date().toLocaleString('es-MX')}`, style: 'sub', alignment: 'right' },
        ], margin: [0, 0, 0, 10] },
        { table: {
            headerRows: 1,
            widths: ['*', 45, 90, 70],
            body: [
              [{ text: 'Celular / Producto', style: 'th' }, { text: 'Visitas/Cant.', style: 'th', alignment: 'right' },
               { text: 'Total', style: 'th', alignment: 'right' }, { text: 'Última visita', style: 'th' }],
              ...bodyRows,
            ],
          },
          layout: { hLineWidth: (i: number) => 0.5, vLineWidth: () => 0, hLineColor: () => '#e2e8f0' },
        },
      ],
      styles: {
        header: { fontSize: 15, bold: true },
        sub:    { fontSize: 8, color: '#64748b' },
        th:     { bold: true, fontSize: 8, fillColor: '#1e3a5f', color: '#ffffff', margin: [2, 3, 2, 3] },
      },
      defaultStyle: { fontSize: 8 },
    };
    pdfMake.createPdf(docDef).open();
  }

  private async loadLogo(): Promise<string | null> {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      if (rootResponse?.picture) return this.base64EncodeService.convertImageToBase64(rootResponse.picture);
    } catch {}
    return null;
  }

  formatCurrency(v: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
  }

  payLabel(t: string): string {
    return ({ EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', CHEQUE: 'Cheque', VALES: 'Vales' })[t] ?? t;
  }

  payIcon(t: string): string {
    return ({ EFECTIVO: 'bi-cash-coin', TARJETA: 'bi-credit-card', CHEQUE: 'bi-file-earmark-text', VALES: 'bi-ticket-perforated' })[t] ?? 'bi-question';
  }

  payBadgeClass(t: string): string {
    return ({ EFECTIVO: 'bg-success', TARJETA: 'bg-primary', CHEQUE: 'bg-warning text-dark', VALES: 'bg-info text-dark' })[t] ?? 'bg-secondary';
  }

  conceptsDesc(sale: SaleReport): string {
    if (!sale.concepts?.length) return '—';
    return sale.concepts.map(c => {
      if (c.description) return c.description;
      if (c.idProduct) return `#${c.idProduct}`;
      return `${this.formatCurrency(c.pu)} ×${c.quantity}`;
    }).join(' | ');
  }

  conceptsQty(sale: SaleReport): number {
    return sale.concepts.reduce((s, c) => s + c.quantity, 0);
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
    this.phoneSearch = input.value;
  }

  async buscarPorCelular() {
    if (!this.phoneSearchValid) return;
    this.phoneLoading   = true;
    this.phoneConsulted = false;
    this.phoneErrorMsg  = '';
    this.phoneSummary   = null;
    this.phoneLoyalty   = null;
    this.phoneLoyaltyTxns = [];

    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    const phone = this.phoneSearch.trim();

    try {
      const [summary, loyalty, txns] = await Promise.all([
        firstValueFrom(this.http.get<any>(
          `${environment.urlAdministration}/Salesxcustomer/byPhone/${phone}`,
          { headers: this.trackingService.getHeaders() }
        )),
        firstValueFrom(this.http.get<any>(
          `${environment.urlAdministration}/Loyalty/account/${phone}/${idCompany}`,
          { headers: this.trackingService.getHeaders() }
        )).catch(() => null),
        firstValueFrom(this.http.get<any[]>(
          `${environment.urlAdministration}/Loyalty/transactions/${phone}/${idCompany}`,
          { headers: this.trackingService.getHeaders() }
        )).catch(() => []),
      ]);
      this.phoneSummary     = summary;
      this.phoneLoyalty     = loyalty;
      this.phoneLoyaltyTxns = txns ?? [];
      this.phoneConsulted   = true;
    } catch {
      this.phoneErrorMsg = 'Error al consultar. Verifica tu conexión.';
    } finally {
      this.phoneLoading = false;
    }
  }

  async consultarTodos() {
    this.allPhoneLoading   = true;
    this.allPhoneConsulted = false;
    this.allPhoneErrorMsg  = '';
    this.allPhoneRows = [];
    this.expandedPhones.clear();
    try {
      const url = `${environment.urlAdministration}/Salesxcustomer/report?dateFrom=${this.allPhoneFrom}&dateTo=${this.allPhoneTo}&paymentType=TODAS`;
      const sales = await firstValueFrom(this.http.get<any[]>(url, { headers: this.trackingService.getHeaders() }));

      // Agrupar por phoneNumber (solo ventas con celular)
      const map = new Map<string, PhoneRow>();
      for (const sale of sales) {
        const phone = (sale.phoneNumber ?? '').trim();
        if (!phone) continue;
        if (!map.has(phone)) map.set(phone, { phone, visitCount: 0, totalAmount: 0, lastVisit: sale.date, products: [] });
        const row = map.get(phone)!;
        row.visitCount++;
        row.totalAmount += sale.amount ?? 0;
        if (sale.date > row.lastVisit) row.lastVisit = sale.date;
        // Agrupar productos
        for (const c of (sale.concepts ?? [])) {
          const desc = c.description || `#${c.idProduct}`;
          const existing = row.products.find(p => p.description === desc);
          if (existing) {
            existing.totalQty    += c.quantity ?? 0;
            existing.totalAmount += c.total ?? 0;
            existing.purchaseCount++;
          } else {
            row.products.push({ description: desc, totalQty: c.quantity ?? 0, totalAmount: c.total ?? 0, purchaseCount: 1 });
          }
        }
      }

      this.allPhoneRows = Array.from(map.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);
      this.allPhoneConsulted = true;
    } catch {
      this.allPhoneErrorMsg = 'Error al cargar. Verifica tu conexión.';
    } finally {
      this.allPhoneLoading = false;
    }
  }

  private todayStr() {
    return new Date().toISOString().substring(0, 10);
  }

  private monthStartStr() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  }
}
