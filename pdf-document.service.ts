import { inject, Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { lastValueFrom } from 'rxjs';

import { RootService } from './src/app/services/root.service';
import { Base64EncodeService } from './src/app/services/base64encode.service';
import { AdministrationService } from './src/app/services/administration.service';
import { alerts } from 'app/helpers/alerts';

// Initialize vfs once for the entire application
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Injectable({
  providedIn: 'root'
})
export class PdfDocumentService {

  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private administrationService = inject(AdministrationService);

  /**
   * Fetches common document parts like company info, logo, and signatures.
   */
  private async _getCommonDocParts(idRoot: number) {
    const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));
    const logoBase64 = await this.base64EncodeService.convertImageToBase64(rootResponse.picture);
    const watermarkBase64 = rootResponse.picture3
      ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture3)
      : null;

    const setupManagementInfo: any = await lastValueFrom(this.administrationService.getSetupManagementInfo(idRoot));
    const firmas = (Array.isArray(setupManagementInfo) && setupManagementInfo.length > 0)
      ? setupManagementInfo[0]
      : null;

    return { rootResponse, logoBase64, watermarkBase64, firmas };
  }

  /**
   * Provides a common set of styles for PDF documents.
   */
  private _getCommonStyles(color: string = '#cc0000') {
    return {
      companyName: { fontSize: 14, bold: true, color: '#333333' },
      companyInfo: { fontSize: 9, color: '#666666' },
      documentTitle: { fontSize: 16, bold: true, color: color },
      documentNumber: { fontSize: 12, bold: true, color: '#333333' },
      documentDate: { fontSize: 10, color: '#666666' },
      sectionTitle: { fontSize: 11, bold: true, color: color },
      masterLabel: { fontSize: 9, bold: true, color: '#333333' },
      masterValue: { fontSize: 9, color: '#000000' },
      tableHeader: { fontSize: 8, bold: true, fillColor: '#e6e6e6', color: '#000000' },
      tableCell: { fontSize: 8, color: '#000000' },
      totalLabel: { fontSize: 9, bold: true, color: '#000000' },
      totalValue: { fontSize: 9, bold: true, color: color },
      signatureTitle: { fontSize: 8, bold: true, color: '#333333' },
      signatureName: { fontSize: 8, color: '#000000' },
      signatureLabel: { fontSize: 8, italics: true, color: '#666666' }
    };
  }

  /**
   * Generates the PDF for an expenditure receipt.
   */
  public async generateExpenditureReceipt(expenditureData: any, concepts: any[], idRoot: number): Promise<Blob> {
    try {
      const { rootResponse, logoBase64, watermarkBase64, firmas } = await this._getCommonDocParts(idRoot);
      const total = concepts.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);

      const docDefinition: TDocumentDefinitions = {
        pageSize: 'LETTER',
        pageMargins: [40, 60, 40, 60],
        background: watermarkBase64 ? [{
          image: 'watermark',
          width: 400,
          opacity: 0.15,
          absolutePosition: { x: 106, y: 250 }
        }] : [],
        content: [
          // Header
          this._buildHeader(rootResponse, 'RECIBO DE EGRESO', expenditureData.numberDocument, expenditureData.date),
          // Separator Line
          this._buildSeparatorLine(),
          // Master Details
          {
            text: 'DETALLES DEL EGRESO',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          {
            table: {
              widths: ['25%', '75%'],
              body: [
                [{ text: 'FECHA PAGO:', style: 'masterLabel' }, { text: this._formatDate(expenditureData?.date), style: 'masterValue' }],
                [{ text: 'OBJETO DE GASTO:', style: 'masterLabel' }, { text: `${expenditureData.objetoGastoTexto}        $ ${this._formatCurrency(expenditureData?.total || 0)}`, style: 'masterValue' }]
              ]
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc', paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 8, paddingRight: () => 8 },
            margin: [0, 0, 0, 15]
          },
          // Concepts Table
          {
            table: {
              headerRows: 1,
              widths: [70, 100, '*', 80],
              body: [
                [{ text: 'Fecha', style: 'tableHeader' }, { text: 'NUMERO DE RECIBO O FOLIO FISCAL (FACTURA)', style: 'tableHeader' }, { text: 'Descripción', style: 'tableHeader' }, { text: 'Total', style: 'tableHeader', alignment: 'right' }],
                ...concepts.map(concept => [
                  { text: this._formatDate(concept.dateExpend), style: 'tableCell', fontSize: 7 },
                  { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 7 },
                  { text: concept.description || '', style: 'tableCell' },
                  { text: this._formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
                ]),
                [{ text: '', border: [false, false, false, false] }, { text: '', border: [false, false, false, false] }, { text: 'TOTAL:', style: 'totalLabel', alignment: 'right', border: [false, true, false, false] }, { text: this._formatCurrency(total), style: 'totalValue', alignment: 'right', border: [false, true, false, false] }]
              ]
            },
            layout: { hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5, vLineWidth: () => 0.5, hLineColor: () => '#333333', vLineColor: () => '#cccccc', paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4 },
            margin: [0, 0, 0, 20]
          },
          // Footer with Signatures
          this._buildSignaturesFooter(firmas)
        ],
        images: watermarkBase64 ? { logo: logoBase64, watermark: watermarkBase64 } : { logo: logoBase64 },
        styles: this._getCommonStyles('#cc0000')
      };

      return new Promise<Blob>((resolve) => {
        pdfMake.createPdf(docDefinition).getBlob(blob => resolve(blob));
      });

    } catch (error) {
      console.error('Error generando el reporte PDF:', error);
      alerts.basicAlert('Error', 'No se pudo generar el reporte PDF', 'error');
      return null;
    }
  }

  // --- PRIVATE HELPER METHODS ---

  private _buildHeader(root: any, title: string, docNumber: string, date: string) {
    return {
      columns: [
        { image: 'logo', width: 80, alignment: 'left' },
        {
          stack: [
            { text: root.name || 'Empresa', style: 'companyName', alignment: 'center' },
            { text: root.email || '', style: 'companyInfo', alignment: 'center' },
            { text: root.web || '', style: 'companyInfo', alignment: 'center' }
          ],
          width: '*'
        },
        {
          stack: [
            { text: title, style: 'documentTitle', alignment: 'right' },
            { text: `No. ${docNumber || 'Sin Número'}`, style: 'documentNumber', alignment: 'right', margin: [0, 5, 0, 0] },
            { text: `Fecha de Pago: ${this._formatDate(date)}`, style: 'documentDate', alignment: 'right', margin: [0, 3, 0, 0] }
          ],
          width: 150
        }
      ],
      margin: [0, 0, 0, 20]
    };
  }

  private _buildSeparatorLine() {
    return {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#333333' }],
      margin: [0, 0, 0, 15]
    };
  }

  private _buildSignaturesFooter(firmas: any) {
    return {
      table: {
        widths: ['33%', '34%', '33%'],
        body: [
          [
            { text: firmas?.administratorTitle || 'TESORERO', style: 'signatureTitle', alignment: 'center' },
            { text: firmas?.gerencyTitle || 'SINDICO DE HACIENDA', style: 'signatureTitle', alignment: 'center' },
            { text: firmas?.directorTitle || 'PRESIDENTE MUNICIPAL', style: 'signatureTitle', alignment: 'center' }
          ],
          [{ text: ' ', margin: [0, 30, 0, 0] }, { text: ' ', margin: [0, 30, 0, 0] }, { text: ' ', margin: [0, 30, 0, 0] }],
          [
            { text: '________________________________', alignment: 'center', border: [false, true, false, false], margin: [0, 0, 0, 5] },
            { text: '________________________________', alignment: 'center', border: [false, true, false, false], margin: [0, 0, 0, 5] },
            { text: '________________________________', alignment: 'center', border: [false, true, false, false], margin: [0, 0, 0, 5] }
          ],
          [
            { text: firmas?.administratorName || '', style: 'signatureName', alignment: 'center' },
            { text: firmas?.gerencyName || '', style: 'signatureName', alignment: 'center' },
            { text: firmas?.directorName || '', style: 'signatureName', alignment: 'center' }
          ],
          [
            { text: 'Firma', style: 'signatureLabel', alignment: 'center' },
            { text: 'Firma', style: 'signatureLabel', alignment: 'center' },
            { text: 'Firma', style: 'signatureLabel', alignment: 'center' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 20, 0, 0]
    };
  }

  private _formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Sin fecha';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return [date.getDate().toString().padStart(2, '0'), (date.getMonth() + 1).toString().padStart(2, '0'), date.getFullYear()].join('/');
    } catch (error) {
      return 'Error en fecha';
    }
  }

  private _formatCurrency(amount: number): string {
    if (typeof amount !== 'number') return '$0.00';
    return amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}