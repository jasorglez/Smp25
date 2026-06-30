import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
import { RootService } from './root.service';
import { TrackingService } from './tracking.service';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PdfReportsService {
  private rootService      = inject(RootService);
  private trackingService  = inject(TrackingService);

  constructor() {
    pdfMake.fonts = {
      Montserrat: {
        normal: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Regular.ttf',
        bold: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Bold.ttf',
        italics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Italic.ttf',
        bolditalics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-BoldItalic.ttf',
      }
    };
  }

  private async convertImageToBase64(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      };
      img.onerror = () => {
        console.warn('Failed to load image:', imageUrl);
        resolve('');
      };
      img.src = imageUrl;
    });
  }

  async generateEntryReport(entryData: any, itemsData: any[], idRoot: number, projectName?: string): Promise<string> {
    try {
      const rootResponse = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      const companyData: any = rootResponse;

      let companyLogo = '';
      if (companyData.picture) {
        try {
          companyLogo = await this.convertImageToBase64(companyData.picture);
        } catch (error) {
          console.warn('Failed to convert company logo to base64:', error);
        }
      }

      const docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [40, 100, 40, 60],
        defaultStyle: {
          fontSize: 8,
          font: 'Montserrat'
        },
        styles: {
          header: {
            fontSize: 16,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          subheader: {
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 5]
          },
          tableHeader: {
            fontSize: 8,
            bold: true,
            fillColor: '#f0f0f0'
          },
          companyName: {
            fontSize: 14,
            bold: true,
            alignment: 'center'
          },
          companyInfo: {
            fontSize: 10,
            alignment: 'center'
          },
          projectLabel: {
            fontSize: 10,
            bold: true
          },
          signatureLabel: {
            fontSize: 8,
            bold: true,
            color: '#333',
            alignment: 'left'
          },
          signatureText: {
            fontSize: 8,
            color: '#666',
            alignment: 'left'
          }
        },
        header: (currentPage: number, pageCount: number) => {
          return {
            margin: [40, 20, 40, 10],
            columns: [
              {
                width: '20%',
                stack: [
                  companyLogo ? {
                    image: companyLogo,
                    width: 80,
                    height: 60,
                    alignment: 'left',
                    margin: [0, 10, 0, 0]
                  } : {}
                ]
              },
              {
                width: '50%',
                stack: [
                  {
                    text: companyData.name || '',
                    style: 'companyName',
                    alignment: 'center',
                    margin: [0, 5, 0, 2]
                  },
                  {
                    text: `${companyData.address || ''}, ${companyData.city || ''}, ${companyData.state || ''}, ${companyData.country || ''}`,
                    style: 'companyInfo',
                    alignment: 'center',
                    margin: [0, 2, 0, 2]
                  },
                  {
                    text: `RFC: ${companyData.rfc || 'N/A'} | Email: ${companyData.email || 'N/A'} | Tel: ${companyData.phone || 'N/A'}`,
                    style: 'companyInfo',
                    alignment: 'center',
                    margin: [0, 2, 0, 2]
                  }
                ]
              },
              {
                width: '30%',
                stack: [
                  {
                    text: entryData.type === 'IN' ? 'VALE DE ENTRADA' : 'VALE DE SALIDA',
                    style: 'header',
                    alignment: 'right',
                    margin: [0, 0, 0, 10]
                  },
                  {
                    text: `Folio: ${entryData.folio || 'N/A'}`,
                    style: 'companyInfo',
                    alignment: 'right',
                    margin: [0, 2, 0, 2]
                  },
                  {
                    text: `Fecha: ${entryData.date ? new Date(entryData.date).toLocaleDateString('es-MX') : 'N/A'}`,
                    style: 'companyInfo',
                    alignment: 'right',
                    margin: [0, 2, 0, 2]
                  }
                ]
              }
            ]
          };
        },
        content: [
          {
            text: entryData.type === 'IN' ? 'DETALLES DE LA ENTRADA' : 'DETALLES DE LA SALIDA',
            style: 'subheader',
            alignment: 'right',
            margin: [0, 20, 0, 10]
          },
          {
            columns: [
              { width: '50%', text: '' },
              {
                width: '50%',
                table: {
                  widths: ['40%', '60%'],
                  body: [
                    ['Fecha Entrega', entryData.deliveryDate ? new Date(entryData.deliveryDate).toLocaleDateString('es-MX') : 'N/A'],
                    ['Tipo Entrada', entryData.directEntry ? 'Directa' : 'Normal'],
                    ['Factura', entryData.numBill || 'N/A'],
                    ['OT', entryData.otName || 'N/A']
                  ]
                },
                layout: {
                  fillColor: function (rowIndex: number) {
                    return (rowIndex % 2 === 0) ? '#f9f9f9' : null;
                  }
                }
              }
            ],
            margin: [0, 0, 0, 20]
          },
          {
            text: 'ARTÍCULOS',
            style: 'subheader',
            margin: [0, 20, 0, 10]
          },
          {
            table: {
              widths: ['5%', '15%', '35%', '15%', '15%', '15%'],
              headerRows: 1,
              body: [
                [
                  { text: '#', style: 'tableHeader' },
                  { text: 'Código', style: 'tableHeader' },
                  { text: 'Descripción', style: 'tableHeader' },
                  { text: 'Cantidad', style: 'tableHeader' },
                  { text: 'Unidad', style: 'tableHeader' },
                  { text: 'Comentario', style: 'tableHeader' }
                ],
                ...(itemsData && itemsData.length > 0 ? itemsData.map((item: any, index: number) => [
                  index + 1,
                  item.code || item.idMaterial || 'N/A',
                  item.description || item.materialName || 'N/A',
                  item.quantity || 0,
                  item.measure || item.unit || item.unidad || 'N/A',
                  item.comment || item.observaciones || ''
                ]) : [[
                  { text: 'No hay artículos disponibles', colSpan: 6, alignment: 'center' },
                  {},
                  {},
                  {},
                  {},
                  {}
                ]])
              ]
            },
            layout: {
              fillColor: function (rowIndex: number) {
                return (rowIndex === 0) ? '#e8f5e9' : (rowIndex % 2 === 0) ? '#f9f9f9' : null;
              }
            },
            margin: [0, 0, 0, 20]
          },
          {
            margin: [0, 60, 0, 0],
            columns: [
              {
                width: '50%',
                stack: [
                  {
                    text: 'Entrega:',
                    style: 'signatureLabel',
                    margin: [0, 0, 0, 5]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: 'Nombre y Firma',
                    style: 'signatureText',
                    margin: [0, 0, 0, 0]
                  }
                ]
              },
              {
                width: '50%',
                stack: [
                  {
                    text: 'Recibe:',
                    style: 'signatureLabel',
                    margin: [0, 0, 0, 5]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: 'Nombre y Firma',
                    style: 'signatureText',
                    margin: [0, 0, 0, 0]
                  }
                ]
              }
            ]
          }
        ]
      };

      return new Promise((resolve, reject) => {
        pdfMake.createPdf(docDefinition as any).getBlob((blob) => {
          const url = URL.createObjectURL(blob);
          resolve(url);
        });
      });

      this.trackingService.addLog(this.trackingService.getnameComp(), 'Generó reporte de entrada PDF', 'Almacenes / Proyectos', this.trackingService.getEmail());
    } catch (error) {
      console.error('Error generating entry report PDF:', error);
      throw error;
    }
  }

  async generateFinancialReport(opts: {
    rows: any[];
    reportType: 'detalle' | 'cliente' | 'proveedor' | 'mes';
    title: string;
    startDate: string;
    endDate: string;
    idRoot: number;
  }): Promise<void> {
    const { rows, reportType, title, startDate, endDate, idRoot } = opts;

    const rootResponse = await lastValueFrom(this.rootService.getRootbyId(idRoot));
    const co: any = rootResponse;

    let logo = '';
    if (co.picture) {
      try { logo = await this.convertImageToBase64(co.picture); } catch {}
    }

    const fmt = (v: any) => v != null
      ? Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      : '$0.00';

    const fmtDate = (s: string) => {
      if (!s) return '';
      const [y, m, d] = String(s).substring(0, 10).split('-');
      return d && m && y ? `${d}/${m}/${y}` : s;
    };

    const fmtMes = (s: string) => {
      if (!s) return '';
      const [y, m] = String(s).split('-');
      const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${meses[parseInt(m)] || ''} ${y}`;
    };

    const isEgreso = title.toLowerCase().includes('egreso');
    const thColor  = isEgreso ? '#1a5276' : '#1a5c2e';
    const grpColor = isEgreso ? '#d6eaf8' : '#d5f5e3';
    const totColor = isEgreso ? '#1a5276' : '#1a5c2e';

    const groupKey = (row: any): string => {
      if (reportType === 'detalle')   return String(row.dateExpend || '').substring(0, 10);
      if (reportType === 'mes')       return String(row.dateExpend || '').substring(0, 7);
      return row.entityName || '(Sin nombre)';
    };

    const groupLabel = (key: string): string => {
      if (reportType === 'detalle') return fmtDate(key);
      if (reportType === 'mes')     return fmtMes(key);
      return key;
    };

    const sorted = [...rows].sort((a, b) => {
      const ka = groupKey(a), kb = groupKey(b);
      return reportType === 'detalle' || reportType === 'mes'
        ? kb.localeCompare(ka)
        : ka.localeCompare(kb);
    });

    const groups = new Map<string, any[]>();
    for (const r of sorted) {
      const k = groupKey(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    const headerCols = reportType === 'detalle'
      ? ['#', 'Documento', isEgreso ? 'Proveedor/Empl.' : 'Cliente', 'Descripción', 'Subtotal', 'IVA', 'Total']
      : reportType === 'mes'
        ? ['#', 'Fecha', isEgreso ? 'Proveedor/Empl.' : 'Cliente', 'Descripción', 'Subtotal', 'IVA', 'Total']
        : ['#', 'Fecha', 'Documento', 'Descripción', 'Subtotal', 'IVA', 'Total'];

    const colWidths = ['auto', 70, 100, '*', 65, 55, 65];

    const th = (t: string) => ({ text: t, bold: true, fontSize: 7, color: '#fff', fillColor: thColor, margin: [2, 3, 2, 3] });

    const tableBody: any[] = [headerCols.map(th)];

    let grandTotal = 0, grandIva = 0, grandFinal = 0;
    let rowNum = 1;

    for (const [key, rws] of groups) {
      const grpTotal   = rws.reduce((s, r) => s + (r.total || 0), 0);
      const grpIva     = rws.reduce((s, r) => s + (r.iva2 || 0), 0);
      const grpFinal   = rws.reduce((s, r) => s + (r.totalFinal || 0), 0);
      grandTotal += grpTotal; grandIva += grpIva; grandFinal += grpFinal;

      tableBody.push([{
        text: groupLabel(key),
        colSpan: 7, bold: true, fontSize: 7,
        fillColor: grpColor, margin: [4, 3, 4, 3]
      }, ...Array(6).fill({})]);

      for (const r of rws) {
        const cols = reportType === 'detalle'
          ? [rowNum, r.numberDocument || '', r.entityName || '', r.description || '', fmt(r.total), fmt(r.iva2), fmt(r.totalFinal)]
          : reportType === 'mes'
            ? [rowNum, fmtDate(String(r.dateExpend || '').substring(0, 10)), r.entityName || '', r.description || '', fmt(r.total), fmt(r.iva2), fmt(r.totalFinal)]
            : [rowNum, fmtDate(String(r.dateExpend || '').substring(0, 10)), r.numberDocument || '', r.description || '', fmt(r.total), fmt(r.iva2), fmt(r.totalFinal)];

        tableBody.push(cols.map((c, i) => ({
          text: String(c),
          fontSize: 6.5,
          alignment: i >= 4 ? 'right' : 'left',
          margin: [2, 2, 2, 2],
          fillColor: rowNum % 2 === 0 ? '#f8f9fa' : null,
        })));
        rowNum++;
      }

      tableBody.push([
        { text: 'Subtotal', colSpan: 4, bold: true, fontSize: 7, alignment: 'right', fillColor: '#e8e8e8', margin: [2, 2, 2, 2] },
        {}, {}, {},
        { text: fmt(grpTotal),  bold: true, fontSize: 7, alignment: 'right', fillColor: '#e8e8e8', margin: [2, 2, 2, 2] },
        { text: fmt(grpIva),    bold: true, fontSize: 7, alignment: 'right', fillColor: '#e8e8e8', margin: [2, 2, 2, 2] },
        { text: fmt(grpFinal),  bold: true, fontSize: 7, alignment: 'right', fillColor: '#e8e8e8', margin: [2, 2, 2, 2] },
      ]);
    }

    tableBody.push([
      { text: 'TOTAL GENERAL', colSpan: 4, bold: true, fontSize: 8, alignment: 'right', fillColor: totColor, color: '#fff', margin: [2, 3, 2, 3] },
      {}, {}, {},
      { text: fmt(grandTotal), bold: true, fontSize: 8, alignment: 'right', fillColor: totColor, color: '#fff', margin: [2, 3, 2, 3] },
      { text: fmt(grandIva),   bold: true, fontSize: 8, alignment: 'right', fillColor: totColor, color: '#fff', margin: [2, 3, 2, 3] },
      { text: fmt(grandFinal), bold: true, fontSize: 8, alignment: 'right', fillColor: totColor, color: '#fff', margin: [2, 3, 2, 3] },
    ]);

    const reportTypeLbl: Record<string, string> = {
      detalle: 'Por Fecha', cliente: 'Por Cliente', proveedor: 'Por Proveedor', mes: 'Por Mes'
    };

    const docDef: any = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 90, 30, 40],
      defaultStyle: { font: 'Montserrat', fontSize: 8 },
      styles: {
        companyName: { fontSize: 13, bold: true },
        companyInfo: { fontSize: 8 },
        reportTitle:  { fontSize: 14, bold: true },
      },
      header: () => ({
        margin: [30, 15, 30, 5],
        columns: [
          {
            width: 80,
            stack: logo ? [{ image: logo, width: 70, height: 50 }] : [{ text: '' }]
          },
          {
            width: '*',
            stack: [
              { text: co.name || '', style: 'companyName', alignment: 'center' },
              { text: [co.address, co.city, co.state, co.country].filter(Boolean).join(', '), style: 'companyInfo', alignment: 'center' },
              { text: `RFC: ${co.rfc || 'N/A'} | Email: ${co.email || 'N/A'} | Tel: ${co.phone || 'N/A'}`, style: 'companyInfo', alignment: 'center' },
            ],
            margin: [10, 5, 10, 0]
          },
          {
            width: 140,
            stack: [
              { text: title, style: 'reportTitle', alignment: 'right', color: thColor },
              { text: reportTypeLbl[reportType] || '', fontSize: 9, bold: true, alignment: 'right', color: '#555' },
              { text: `Del ${fmtDate(startDate)} al ${fmtDate(endDate)}`, fontSize: 8, alignment: 'right', margin: [0, 2, 0, 0] },
              { text: `${rows.length} registros`, fontSize: 7, alignment: 'right', color: '#777', margin: [0, 1, 0, 0] },
            ]
          }
        ]
      }),
      footer: (currentPage: number, pageCount: number) => ({
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center', fontSize: 7, color: '#888', margin: [0, 10, 0, 0]
      }),
      content: [{
        table: { headerRows: 1, widths: colWidths, body: tableBody },
        layout: {
          hLineWidth: () => 0.3,
          vLineWidth: () => 0.3,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
        }
      }]
    };

    const safeTitle = title.replace(/\s+/g, '_');
    const fileName = `${safeTitle}_${reportType}_${startDate}_${endDate}.pdf`;
    this.trackingService.addLog(this.trackingService.getnameComp(), `Descargó reporte financiero PDF: ${title}`, 'Administración', this.trackingService.getEmail());
    pdfMake.createPdf(docDef).download(fileName);
  }

  async generateReportWithHeader(
    title: string,
    content: any[],
    idRoot: number,
    projectName?: string
  ): Promise<string> {
    try {
      const rootResponse = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      const companyData: any = rootResponse;

      let companyLogo = '';
      if (companyData.picture) {
        try {
          companyLogo = await this.convertImageToBase64(companyData.picture);
        } catch (error) {
          console.warn('Failed to convert company logo to base64:', error);
        }
      }

      const docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [40, 100, 40, 60],
        defaultStyle: {
          fontSize: 8,
          font: 'Montserrat'
        },
        styles: {
          header: {
            fontSize: 16,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          subheader: {
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 5]
          },
          tableHeader: {
            fontSize: 10,
            bold: true,
            fillColor: '#f0f0f0'
          },
          companyName: {
            fontSize: 14,
            bold: true,
            alignment: 'center'
          },
          companyInfo: {
            fontSize: 10,
            alignment: 'center'
          },
          projectLabel: {
            fontSize: 10,
            bold: true
          }
        },
        header: (currentPage: number, pageCount: number) => {
          return {
            margin: [40, 20, 40, 10],
            columns: [
              {
                width: '30%',
                stack: [
                  companyLogo ? {
                    image: companyLogo,
                    width: 80,
                    height: 60,
                    alignment: 'left'
                  } : {},
                  {
                    text: companyData.name || '',
                    style: 'companyName',
                    margin: [0, 5, 0, 2]
                  },
                  {
                    text: `${companyData.city || ''}, ${companyData.country || ''}`,
                    style: 'companyInfo',
                    margin: [0, 0, 0, 5]
                  },
                  {
                    text: 'Proyecto:',
                    style: 'projectLabel',
                    alignment: 'left'
                  }
                ]
              },
              {
                width: '40%',
                text: title,
                style: 'header',
                alignment: 'center',
                margin: [0, 20, 0, 0]
              },
              {
                width: '30%',
                stack: [
                  {
                    text: 'Vale de entrada:',
                    style: 'projectLabel',
                    alignment: 'right',
                    margin: [0, 20, 0, 5]
                  }
                ]
              }
            ]
          };
        },
        content: content
      };

      return new Promise((resolve, reject) => {
        pdfMake.createPdf(docDefinition as any).getBlob((blob) => {
          const url = URL.createObjectURL(blob);
          resolve(url);
        });
      });

      this.trackingService.addLog(this.trackingService.getnameComp(), `Generó reporte PDF: ${title}`, 'Proyectos', this.trackingService.getEmail());
    } catch (error) {
      console.error('Error generating report PDF:', error);
      throw error;
    }
  }
}
