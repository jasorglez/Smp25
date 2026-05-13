import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs =
  (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const TICKET_WIDTH = 226.77; // 80 mm en puntos

@Injectable({ providedIn: 'root' })
export class PosTicketService {

  print(
    sale: {
      numbernote: string;
      date: string;
      amount: number;
      credit: boolean;
      lector: boolean;
    },
    concepts: { idProduct: number; quantity: number; pu: number }[],
    products: any[],
    clientName: string,
    storeName: string,
    cashRegisterDesc: string,
  ): void {
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

    const rows = concepts.map(c => {
      const prod = products.find(p => p.id === c.idProduct);
      const name = prod?.description || prod?.insumo || `Prod. ${c.idProduct}`;
      return [
        { text: name, fontSize: 7 },
        { text: String(c.quantity), alignment: 'center', fontSize: 7 },
        { text: fmtMXN(c.pu), alignment: 'right', fontSize: 7 },
        { text: fmtMXN(c.quantity * c.pu), alignment: 'right', fontSize: 7 },
      ];
    });

    const docDef: any = {
      pageSize: { width: TICKET_WIDTH, height: 'auto' },
      pageMargins: [10, 10, 10, 15],
      content: [
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
        {
          text: `TOTAL: ${fmtMXN(sale.amount)}`,
          bold: true,
          fontSize: 11,
          alignment: 'right',
        },
        {
          text: sale.credit ? 'Forma de pago: Crédito' : 'Forma de pago: Contado',
          fontSize: 7,
          alignment: 'right',
          margin: [0, 2, 0, 6],
        },
        { text: '¡Gracias por su compra!', alignment: 'center', italics: true, fontSize: 7 },
      ],
    };

    pdfMake.createPdf(docDef).open();
  }
}
