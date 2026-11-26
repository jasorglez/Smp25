import { inject, Injectable } from '@angular/core';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { PdfPreviewService } from 'app/services/pdf-preview.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

const ticketFonts = (pdfFonts as any).pdfMake?.vfs
  ?? (pdfFonts as any).default?.pdfMake?.vfs
  ?? (pdfFonts as any).default
  ?? pdfFonts;

(pdfMake as any).vfs = ticketFonts;

const TICKET_WIDTH = 226.77; // 80 mm en puntos

@Injectable({ providedIn: 'root' })
export class PosTicketService {
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);
  private pdfPreview = inject(PdfPreviewService);

  async printCobranza(payment: { id: number; fecha: string; monto: number; saldoPendiente: number; tipoPago: string; cliente: string; prestamo: number; cuota: number; origen: string; empresaId: number }): Promise<void> {
    let logo: string | null = null;
    // El ticket se muestra inmediatamente usando la imagen ya cargada en la sesión.
    // Consultar de nuevo el negocio o descargar sus imágenes antes de crear el PDF
    // podía dejar el guardado esperando varios segundos cuando esos servicios iban lentos.
    const cachedLogo = this.trackingService.getpictureComp();
    if (/^data:image\/(png|jpeg);base64,/i.test(cachedLogo || '')) {
      logo = cachedLogo;
    } else if (cachedLogo) {
      try {
        const image = await Promise.race([
          this.base64EncodeService.convertImageToBase64(cachedLogo),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), 1200)),
        ]);
        if (/^data:image\/(png|jpeg);base64,/i.test(image)) logo = image;
      } catch (error) {
        console.warn('No se pudo cargar el logo almacenado para el ticket de Cobranza:', error);
      }
    }
    const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.monto);
    const line = { canvas: [{ type: 'line', x1: 0, y1: 0, x2: TICKET_WIDTH - 14, y2: 0, lineWidth: 0.4 }], margin: [0, 2, 0, 2] };
    const doc: any = {
      pageSize: { width: TICKET_WIDTH, height: 'auto' }, pageMargins: [7, 5, 7, 6],
      content: [
        ...(logo ? [{ image: logo, fit: [58, 28], alignment: 'center', margin: [0, 0, 0, 2] }] : []),
        { text: 'COMPROBANTE DE COBRANZA', bold: true, fontSize: 8, alignment: 'center', margin: [0, 0, 0, 1] }, line,
        { text: 'Ticket: COB-' + String(payment.id).padStart(8, '0'), fontSize: 7 },
        { text: 'Fecha: ' + new Date(payment.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }), fontSize: 7 },
        { text: 'Cliente: ' + payment.cliente, fontSize: 7, margin: [0, 1, 0, 0] },
        { text: 'Préstamo: ' + payment.prestamo + '  |  Cuota: ' + payment.cuota, fontSize: 7 },
        { text: 'Recibido en: ' + (payment.origen === 'NEGOCIO' ? 'Caja del negocio' : 'Domicilio del cliente'), fontSize: 7 }, line,
        { text: 'Forma de pago: ' + payment.tipoPago, fontSize: 7, alignment: 'right' },
        { text: 'ABONO: ' + money, bold: true, fontSize: 10, alignment: 'right', margin: [0, 2, 0, 2] },
        { text: 'SALDO PENDIENTE: ' + new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(payment.saldoPendiente), bold: true, fontSize: 9, alignment: 'right' },
        line, { text: 'Gracias por su pago', alignment: 'center', italics: true, fontSize: 7 },
      ],
    };
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Generó comprobante de abono', 'Cobranza', this.trackingService.getEmail());
    await this.pdfPreview.show(pdfMake.createPdf(doc, undefined, undefined, ticketFonts), 'Ticket de abono', `Ticket_Cobranza_${payment.id}.pdf`);
  }

  async print(
    sale: {
      numbernote: string;
      date: string;
      amount: number;
      credit: boolean;
      lector: boolean;
      payment_type?: string;
    },
    concepts: { idProduct: number; description?: string; quantity: number; pu: number }[],
    products: any[],
    clientName: string,
    storeName: string,
    cashRegisterDesc: string,
    paymentType?: string,
    paymentReference?: string,
    pagoConAmount?: number,
    idCompany?: number,
    splitPayments?: { type: string; amount: number }[],
  ): Promise<void> {
    let logoBase64: string | null = null;
    if (idCompany) {
      try {
        const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(idCompany));
        if (rootResponse?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootResponse.picture);
        }
      } catch { /* logo is optional */ }
    }
    const fmtMXN = (n: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

    const fmtDate = (d: string) =>
      new Date(d).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

    const line = () => ({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: TICKET_WIDTH - 20, y2: 0, lineWidth: 0.5 }],
      margin: [0, 3, 0, 3],
    });

    const payLabel: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      TARJETA:  'Tarjeta',
      CHEQUE:   'Cheque',
      VALES:    'Vale',
      MIXTO:    'Mixto',
    };

    const rows = concepts.map(c => {
      const prod = products.find(p => p.id === c.idProduct);
      const name = c.description || prod?.description || prod?.insumo || (c.idProduct ? `Prod. ${c.idProduct}` : 'Producto');
      return [
        { text: name, fontSize: 7 },
        { text: String(c.quantity), alignment: 'center', fontSize: 7 },
        { text: fmtMXN(c.pu), alignment: 'right', fontSize: 7 },
        { text: fmtMXN(c.quantity * c.pu), alignment: 'right', fontSize: 7 },
      ];
    });

    const pt = paymentType ?? sale.payment_type ?? 'EFECTIVO';
    const paymentLines: any[] = [];

    if (pt === 'MIXTO' && splitPayments?.length) {
      // Líneas de pago mixto
      for (const sp of splitPayments) {
        paymentLines.push({
          text: `  ${payLabel[sp.type] ?? sp.type}: ${fmtMXN(sp.amount)}`,
          fontSize: 7, alignment: 'right', margin: [0, 1, 0, 0],
        });
      }
    } else {
      if (paymentReference) {
        const refLabel: Record<string, string> = {
          TARJETA: 'Ref. tarjeta',
          CHEQUE:  'No. cheque',
          VALES:   'No. vale',
        };
        paymentLines.push({
          text: `${refLabel[pt] ?? 'Referencia'}: ${paymentReference}`,
          fontSize: 7, alignment: 'right', margin: [0, 1, 0, 0],
        });
      }
      if (pt === 'EFECTIVO' && pagoConAmount != null) {
        const cambio = Math.max(0, pagoConAmount - sale.amount);
        paymentLines.push({ text: `Pago:   ${fmtMXN(pagoConAmount)}`, fontSize: 7, alignment: 'right', margin: [0, 1, 0, 0] });
        paymentLines.push({ text: `Cambio: ${fmtMXN(cambio)}`, fontSize: 7, alignment: 'right', bold: true, margin: [0, 1, 0, 0] });
      }
    }

    const docDef: any = {
      pageSize: { width: TICKET_WIDTH, height: 'auto' },
      pageMargins: [10, 10, 10, 15],
      content: [
        ...(logoBase64 ? [{ image: logoBase64, width: 60, alignment: 'center', margin: [0, 0, 0, 3] }] : []),
        { text: storeName, bold: true, fontSize: 10, alignment: 'center' },
        { text: cashRegisterDesc, fontSize: 7, alignment: 'center', margin: [0, 1, 0, 0] },
        line(),
        { text: `Ticket: ${sale.numbernote}`, fontSize: 7 },
        { text: `Fecha:  ${fmtDate(sale.date)}`, fontSize: 7 },
        { text: `Cliente: ${clientName}`, fontSize: 7, margin: [0, 0, 0, 2] },
        line(),
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Producto', bold: true, fontSize: 7 },
                { text: 'Can.', bold: true, fontSize: 7, alignment: 'center' },
                { text: 'P.U.', bold: true, fontSize: 7, alignment: 'right' },
                { text: 'Total', bold: true, fontSize: 7, alignment: 'right' },
              ],
              ...rows,
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
        line(),
        { text: `TOTAL: ${fmtMXN(sale.amount)}`, bold: true, fontSize: 11, alignment: 'right' },
        {
          text: `Forma de pago: ${payLabel[pt] ?? pt}`,
          fontSize: 7,
          alignment: 'right',
          margin: [0, 2, 0, 0],
        },
        ...paymentLines,
        { text: '', margin: [0, 4, 0, 0] },
        { text: '¡Gracias por su compra!', alignment: 'center', italics: true, fontSize: 7 },
      ],
    };

    this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió ticket POS venta', 'Ventas / POS', this.trackingService.getEmail());
    pdfMake.createPdf(docDef).open();
  }

  /** Imprime comprobante de devolución */
  async printReturn(opts: {
    originalTicket: string;
    returnType: string;
    reason: string;
    amount: number;
    date: Date;
    storeName: string;
    items: { description: string; quantity: number; pu: number; total: number }[];
    approvedBy?: string;
    idCompany?: number;
  }): Promise<void> {
    let logoBase64: string | null = null;
    if (opts.idCompany) {
      try {
        const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(opts.idCompany));
        if (rootResponse?.picture) {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootResponse.picture);
        }
      } catch { /* logo optional */ }
    }

    const fmtMXN = (n: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

    const fmtDate = (d: Date) =>
      d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const line = () => ({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: TICKET_WIDTH - 20, y2: 0, lineWidth: 0.5 }],
      margin: [0, 3, 0, 3],
    });

    const typeLabel: Record<string, string> = {
      total: 'Devolución Total',
      parcial: 'Devolución Parcial',
      cambio: 'Cambio de Producto',
      reimpresion: 'Reimpresión',
    };

    const rows = opts.items.map(i => [
      { text: i.description, fontSize: 7 },
      { text: String(i.quantity), alignment: 'center', fontSize: 7 },
      { text: fmtMXN(i.pu), alignment: 'right', fontSize: 7 },
      { text: fmtMXN(i.total), alignment: 'right', fontSize: 7 },
    ]);

    const docDef: any = {
      pageSize: { width: TICKET_WIDTH, height: 'auto' },
      pageMargins: [10, 10, 10, 15],
      content: [
        ...(logoBase64 ? [{ image: logoBase64, width: 60, alignment: 'center', margin: [0, 0, 0, 3] }] : []),
        { text: opts.storeName, bold: true, fontSize: 10, alignment: 'center' },
        { text: '*** COMPROBANTE DE DEVOLUCIÓN ***', bold: true, fontSize: 8, alignment: 'center', color: '#cc0000', margin: [0, 2, 0, 0] },
        line(),
        { text: `Tipo: ${typeLabel[opts.returnType] ?? opts.returnType}`, fontSize: 7 },
        { text: `Ticket original: ${opts.originalTicket}`, fontSize: 7 },
        { text: `Fecha: ${fmtDate(opts.date)}`, fontSize: 7 },
        { text: `Motivo: ${opts.reason || 'No especificado'}`, fontSize: 7, margin: [0, 0, 0, 2] },
        ...(opts.approvedBy ? [{ text: `Aprobado por: ${opts.approvedBy}`, fontSize: 7, margin: [0, 0, 0, 2] }] : []),
        line(),
        ...(rows.length > 0 ? [{
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Producto', bold: true, fontSize: 7 },
                { text: 'Can.', bold: true, fontSize: 7, alignment: 'center' },
                { text: 'P.U.', bold: true, fontSize: 7, alignment: 'right' },
                { text: 'Total', bold: true, fontSize: 7, alignment: 'right' },
              ],
              ...rows,
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        }, line()] : []),
        { text: `MONTO DEVUELTO: ${fmtMXN(opts.amount)}`, bold: true, fontSize: 11, alignment: 'right' },
        { text: '', margin: [0, 4, 0, 0] },
        { text: '¡Gracias por su preferencia!', alignment: 'center', italics: true, fontSize: 7 },
      ],
    };

    this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió ticket POS devolución', 'Ventas / POS', this.trackingService.getEmail());
    pdfMake.createPdf(docDef).open();
  }
}
