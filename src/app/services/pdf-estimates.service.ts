import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TrackingService } from './tracking.service';
import { auto } from '@popperjs/core';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

export interface EstimateItem {
  clave: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  cantidadEjecutada?: number;
  importeEjecutado?: number;
}

export interface EstimateCategory {
  nombre: string;
  total: number;
  items: EstimateItem[];
}

export interface EstimateData {
  proyecto: string;
  estimacion: string;
  fechaInicio: string;
  fechaFin: string;
  totalGeneral: number;
  totalEjecutado: number;
  categorias: EstimateCategory[];
  pagina: number;
  totalPaginas: number;
}

@Injectable({
  providedIn: 'root'
})
export class PdfEstimatesService {
  private trackingService = inject(TrackingService);

  constructor() {}

  generateEstimatePdf(data: EstimateData): void {
    const docDefinition = this.createDocDefinition(data);
    pdfMake.createPdf(docDefinition).open();
  }

  downloadEstimatePdf(data: EstimateData, filename?: string): void {
    const docDefinition = this.createDocDefinition(data);
    const fileName = filename || `Estimacion_${data.estimacion}_${data.proyecto.replace(/\s+/g, '_')}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
  }

  private createDocDefinition(data: EstimateData): any {
    const tableBody = this.buildTableBody(data);
    
    // Configure fonts
    pdfMake.fonts = {
      'Arimo': {
        normal: 'https://raw.githubusercontent.com/arximboldi/sinusoides/master/resources/static/fonts/Arimo-Regular.ttf',
        bold: 'https://raw.githubusercontent.com/arximboldi/sinusoides/master/resources/static/fonts/Arimo-Bold.ttf',
        italics: 'https://raw.githubusercontent.com/arximboldi/sinusoides/master/resources/static/fonts/Arimo-Italic.ttf',
        bolditalics: 'https://raw.githubusercontent.com/arximboldi/sinusoides/master/resources/static/fonts/Arimo-BoldItalic.ttf'
      }
    };
    
    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 10,
        font: 'Arimo'
      },
      styles: {
        header: {
          fontSize: 12,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        projectInfo: {
          fontSize: 9,
          margin: [0, 0, 0, 5]
        },
        categoryHeader: {
          fontSize: 9,
          bold: true,
          fillColor: '#E8E8E8',
          margin: [1, 1, 1, 1]
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          alignment: 'center',
          fillColor: '#D0D0D0',
          margin: [1, 1, 1, 1]
        },
        tableContent: {
          fontSize: 9,
          margin: [1, 1, 1, 1]
        },
        totalRow: {
          fontSize: 10,
          bold: true,
          fillColor: '#F0F0F0',
          margin: [1, 1, 1, 1]
        },
        rightAlign: {
          alignment: 'right'
        },
        centerAlign: {
          alignment: 'center'
        }
      },
      header: {
        text: 'PLAZA CORALA',
        style: 'header',
        margin: [40, 20, 40, 0]
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: `HOJA ${currentPage} DE ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        margin: [0, 10, 0, 20]
      }),
      content: [
        // Logo en la esquina superior derecha
        {
          image: 'header',
          fit: [80, 40],
          alignment: 'right',
          margin: [0, 0, 0, 10]
        },
        
        // Información del proyecto y fechas
        {
          table: {
            widths: ['70%', '*'],
            body: [
              [
                { text: '', border: [false, false, false, false] },
                {
                  table: {
                    widths: ['30%', '*'],
                    body: [
                      [{ text: 'DEL : ' , border: [false, false, false, false]}, { text: data.fechaInicio, border: [false, false, false, false]}]
                    ]
                  },
                  border: [true, true, true, false]
                }
              ],
              [
                { text: ' FORMATO DE ESTIMACION', style: 'projectInfo', border: [true, true, true, true] },
                {
                  table: {
                    widths: ['30%', '*'],
                    body: [
                      [{ text: 'AL : ', border: [false, false, false, false]}, { text: data.fechaFin, border: [false, false, false, false]  }]
                    ]
                  },
                  border: [false, false, true, true]
                }
              ]
            ]
          },
          margin: [0, 0, 0, 10]
        },

        // Tabla principal
        {
          table: {
            headerRows: 2,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: {
            hLineWidth: (i: number, node: any) => 0.5,
            vLineWidth: (i: number, node: any) => 0.5,
            hLineColor: '#000000',
            vLineColor: '#000000',
            fillColor: (rowIndex: number, node: any, columnIndex: number) => {
              // Header row
              if (rowIndex === 0) return '#D0D0D0';
              // Category headers
              if (node.table.body[rowIndex] && node.table.body[rowIndex][0] && 
                  typeof node.table.body[rowIndex][0].text === 'string' && 
                  node.table.body[rowIndex][1].text === '' && 
                  node.table.body[rowIndex][2].text === '') {
                return '#E8E8E8';
              }
              // Total rows
              if (node.table.body[rowIndex] && node.table.body[rowIndex][0] && 
                  typeof node.table.body[rowIndex][0].text === 'string' && 
                  node.table.body[rowIndex][0].text.includes('TOTAL')) {
                return '#F0F0F0';
              }
              return null;
            }
          }
        }
      ],
      images: {
        header: this.trackingService.getPictureComp2()
      }
    };
  }

  private buildTableBody(data: EstimateData): any[][] {
    const body: any[][] = [];
    
    // First header row with merged cells
    body.push([
      { text: 'CLAVE', style: 'tableHeader', rowSpan: 2 },
      { text: 'CONCEPTO', style: 'tableHeader', rowSpan: 2 },
      { text: 'U.M.', style: 'tableHeader', rowSpan: 2 },
      { text: 'CANT.', style: 'tableHeader', rowSpan: 2 },
      { text: 'P.U', style: 'tableHeader', rowSpan: 2 },
      { text: 'IMPORTE', style: 'tableHeader', rowSpan: 2 },
      { text: `Estimación ${data.estimacion}`, style: 'tableHeader', colSpan: 3 },
      {},
      {}
    ]);

    // Second header row
    body.push([
      {},
      {},
      {},
      {},
      {},
      {},
      { text: 'P.U.', style: 'tableHeader' },
      { text: 'CANT', style: 'tableHeader' },
      { text: 'IMPORTE', style: 'tableHeader' }
    ]);

    // Project total row
    body.push([
      { text: '', style: 'categoryHeader', border: [false, false, false, false] },
      { text: data.proyecto.toUpperCase(), style: 'categoryHeader', colSpan: 4, border: [false, false, false, false] }, {}, {}, {},
      { text: this.formatCurrency(data.totalGeneral), style: ['categoryHeader', 'rightAlign'], border: [false, false, false, false] },
      { text: '', style: 'categoryHeader' },
      { text: '', style: 'categoryHeader' },
      { text: this.formatCurrency(data.totalEjecutado), style: ['categoryHeader', 'rightAlign'] }
    ]);

    // Categories and items
    data.categorias.forEach(category => {
      // Category header
      body.push([
        { text: '', style: 'categoryHeader', border: [false, false, false, false] },
        { text: category.nombre.toUpperCase(), style: 'categoryHeader', colSpan: 4, border: [false, false, false, false] }, {}, {}, {},
        { text: this.formatCurrency(category.total), style: ['categoryHeader', 'rightAlign'], border: [false, false, false, false] },
        { text: '', style: 'categoryHeader' },
        { text: '', style: 'categoryHeader' },
        { text: '', style: 'categoryHeader' }
      ]);

      // Category items
      category.items.forEach(item => {
        body.push([
          { text: item.clave, style: 'tableContent', border: [false, false, false, false] },
          { text: item.concepto, style: 'tableContent', border: [false, false, false, false] },
          { text: item.unidad, style: ['tableContent', 'centerAlign'], border: [false, false, false, false] },
          { text: this.formatNumber(item.cantidad), style: ['tableContent', 'rightAlign'], border: [false, false, false, false] },
          { text: this.formatCurrency(item.precioUnitario), style: ['tableContent', 'rightAlign'], border: [false, false, false, false] },
          { text: this.formatCurrency(item.importe), style: ['tableContent', 'rightAlign'], border: [false, false, false, false] },
          { text: item.precioUnitario ? this.formatCurrency(item.precioUnitario) : '', style: ['tableContent', 'rightAlign'] },
          { text: item.cantidadEjecutada ? this.formatNumber(item.cantidadEjecutada) : '', style: ['tableContent', 'rightAlign'] },
          { text: item.importeEjecutado ? this.formatCurrency(item.importeEjecutado) : '', style: ['tableContent', 'rightAlign'] }
        ]);
      });
    });

    // Final total row
    body.push([
      { text: 'TOTAL', style: ['totalRow', 'centerAlign'], colSpan: 5 }, {}, {}, {}, {},
      { text: this.formatCurrency(data.totalGeneral), style: ['totalRow', 'rightAlign'] },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: this.formatCurrency(data.totalEjecutado), style: ['totalRow', 'rightAlign'] }
    ]);

    return body;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  // Method to create sample data for testing
  createSampleEstimate(): EstimateData {
    return {
      proyecto: 'PLAZA CORALA',
      estimacion: '13R',
      fechaInicio: '18 de noviembre de 2024',
      fechaFin: '23 de noviembre de 2024',
      totalGeneral: 11025337.41,
      totalEjecutado: 353335.51,
      pagina: 1,
      totalPaginas: 26,
      categorias: [
        {
          nombre: 'PRELIMINARES',
          total: 96058.84,
          items: [
            {
              clave: 'PRE-04',
              concepto: 'LIMPIEZA MANUAL DEL TERRENO, DE MALEZA Y BASURA.',
              unidad: 'JOR',
              cantidad: 48.00,
              precioUnitario: 450.00,
              importe: 21600.00,
              cantidadEjecutada: 12.00,
              importeEjecutado: 5400.00
            }
          ]
        },
        {
          nombre: 'CIMENTACION',
          total: 10929278.56,
          items: [
            {
              clave: 'CIM-POL-05',
              concepto: 'COLOCACIÓN DE POLIETILENO',
              unidad: 'M2',
              cantidad: 6346.95,
              precioUnitario: 16.32,
              importe: 103582.22,
              cantidadEjecutada: 308.79,
              importeEjecutado: 5039.45
            },
            {
              clave: 'CIM-05',
              concepto: 'PLANTILLA DE CONCRETO FC=100 KG/CM2 DE 5 CM DE ESPESOR HECHO EN OBRA, INCLUYE:MATERIAL, MANO DE OBRA, COMPACTACIÓN DEL FONDO Y CURADO.(P.U.O.T.)',
              unidad: 'M2',
              cantidad: 6346.95,
              precioUnitario: 32.00,
              importe: 203102.40,
              cantidadEjecutada: 308.79,
              importeEjecutado: 9881.28
            },
            {
              clave: 'CIM-08',
              concepto: 'Habilitado de acero #5',
              unidad: 'kg',
              cantidad: 144092.22,
              precioUnitario: 6.48,
              importe: 933717.60,
              cantidadEjecutada: 10832.59,
              importeEjecutado: 70195.17
            },
            {
              clave: 'CIM-09',
              concepto: 'Habilitado de acero #6',
              unidad: 'kg',
              cantidad: 161988.50,
              precioUnitario: 6.48,
              importe: 1049685.47,
              cantidadEjecutada: 20052.73,
              importeEjecutado: 129941.71
            }
          ]
        }
      ]
    };
  }
}