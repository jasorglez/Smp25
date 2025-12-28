import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
import { RootService } from './root.service';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PdfReportsService {
  private rootService = inject(RootService);

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

    } catch (error) {
      console.error('Error generating entry report PDF:', error);
      throw error;
    }
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

    } catch (error) {
      console.error('Error generating report PDF:', error);
      throw error;
    }
  }
}
