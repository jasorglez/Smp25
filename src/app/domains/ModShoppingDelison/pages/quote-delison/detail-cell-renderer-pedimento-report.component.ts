import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { CustomersService } from 'app/services/customers.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detail-cell-renderer-pedimento-report',
  standalone: true,
  imports: [CommonModule, PdfShareButtonsComponent],
  template: `
    <div class="report-detail-container">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">
          <i class="bi bi-file-earmark-pdf text-danger me-2"></i>
          Reporte: {{ pedimentoData?.pedimento || 'Sin Número' }}
        </h5>
        <div class="d-flex align-items-center gap-2">
          <app-pdf-share-buttons
            [getPdfBlob]="getPdfBlobFn"
            [fileName]="'Pedimento_' + (pedimentoData?.pedimento || pedimentoData?.id) + '.pdf'"
            [subject]="'Pedimento ' + (pedimentoData?.pedimento || pedimentoData?.id)">
          </app-pdf-share-buttons>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
            <i class="bi bi-x-lg"></i> Cerrar
          </button>
        </div>
      </div>
      <div class="report-content" style="height: 450px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <div *ngIf="isLoading" class="d-flex justify-content-center align-items-center h-100">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <span class="ms-2">Generando reporte...</span>
        </div>
        <iframe
          *ngIf="pdfUrl && !isLoading"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl && !isLoading" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              No se pudo generar el reporte PDF.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-detail-container {
      padding: 15px;
      background-color: #fff3cd;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class DetailCellRendererPedimentoReportComponent {
  private sanitizer = inject(DomSanitizer);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private customersService = inject(CustomersService);
  private base64EncodeService = inject(Base64EncodeService);

  private params!: ICellRendererParams;
  pedimentoData: any;
  providerLabel: string = '';
  providerField: string = '';
  pdfUrl: SafeResourceUrl | null = null;
  isLoading: boolean = true;
  private _pdfBlob: Blob | null = null;

  getPdfBlobFn = (): Promise<Blob> =>
    this._pdfBlob ? Promise.resolve(this._pdfBlob) : Promise.reject('PDF no generado aún');

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.pedimentoData = params.data;
    this.providerLabel = params.data?.reportProviderLabel || 'Proveedor A';
    this.providerField = params.data?.reportProviderField || 'idProvider';
    this.generateReport();
  }

  async generateReport() {
    this.isLoading = true;
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      // Obtener datos de la empresa
      const companyData: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));

      // Obtener nombre del proveedor
      let providerName = 'Sin seleccionar';
      const providerId = this.pedimentoData[this.providerField];
      if (providerId && providerId > 0) {
        try {
          const providerData: any = await lastValueFrom(this.customersService.getCustomerById(providerId));
          providerName = providerData?.company || providerData?.description || providerData?.name || 'Sin nombre';
        } catch (error) {
          console.warn('No se pudo cargar el proveedor:', error);
        }
      }

      // Convertir logo principal (picture) a base64
      const logoBase64 = companyData?.picture
        ? await this.base64EncodeService.convertImageToBase64(companyData.picture)
        : '';

      // Convertir segundo logo (picture2) a base64
      const logo2Base64 = companyData?.picture2
        ? await this.base64EncodeService.convertImageToBase64(companyData.picture2)
        : logoBase64; // Si no hay picture2, usar picture

      // Convertir marca de agua (picture3) a base64
      const watermarkBase64 = companyData?.picture3
        ? await this.base64EncodeService.convertImageToBase64(companyData.picture3)
        : null;

      // Obtener artículos del pedimento (excluir tipo Interno)
      const articulos = (this.pedimentoData.articulos || []).filter(
        (item: any) => (item.tipo || item.intorext || '').toLowerCase() !== 'interno'
      );

      // Generar el PDF
      const docDefinition = this.buildDocDefinition(companyData, logoBase64, logo2Base64, watermarkBase64, providerName, articulos);

      const pdfDocGenerator = pdfMake.createPdf(docDefinition as any);
      pdfDocGenerator.getBlob((blob: Blob) => {
        this._pdfBlob = blob;
        const url = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoading = false;
      });

    } catch (error) {
      console.error('Error generando reporte:', error);
      this.isLoading = false;
      this.pdfUrl = null;
    }
  }

  private buildDocDefinition(companyData: any, logoBase64: string, logo2Base64: string, watermarkBase64: string | null, providerName: string, articulos: any[]): any {
    const fechaPedimento = this.pedimentoData.fechaPedimento || '';
    const pedimentoNumero = this.pedimentoData.pedimento || 'N/A';
    const quienCreo = this.pedimentoData.creo || 'N/A';

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 100, 40, 60],
      defaultStyle: {
        fontSize: 9
      },
      // Marca de agua con logo (picture3)
      background: watermarkBase64 ? [
        {
          image: 'watermark',
          width: 400,
          opacity: 0.15,
          absolutePosition: { x: 106, y: 250 }
        }
      ] : [],
      content: [
        // Header con logos
        {
          columns: [
            {
              image: 'logo',
              width: 80,
              alignment: 'left'
            },
            {
              stack: [
                {
                  text: companyData?.name || 'EMPRESA',
                  fontSize: 14,
                  bold: true,
                  alignment: 'center',
                  margin: [0, 10, 0, 5]
                },
                {
                  text: 'PEDIMENTO DE COMPRA',
                  fontSize: 12,
                  bold: true,
                  alignment: 'center',
                  color: '#dc3545'
                }
              ],
              width: '*'
            },
            {
              image: 'logo2',
              width: 80,
              alignment: 'right'
            }
          ],
          margin: [0, 0, 0, 20]
        },

        // Número de pedimento destacado
        {
          text: pedimentoNumero,
          fontSize: 16,
          bold: true,
          alignment: 'center',
          color: '#0d6efd',
          margin: [0, 0, 0, 15]
        },

        // MAESTRO: Datos principales
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'PEDIMENTO #:', bold: true, fillColor: '#e3f2fd' },
                { text: pedimentoNumero, bold: true, color: '#0d6efd' },
                { text: 'FECHA:', bold: true, fillColor: '#e3f2fd' },
                { text: fechaPedimento }
              ],
              [
                { text: 'QUIEN LO CREÓ:', bold: true, fillColor: '#e3f2fd' },
                { text: quienCreo },
                { text: 'PROVEEDOR:', bold: true, fillColor: '#e3f2fd' },
                { text: providerName }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dee2e6',
            vLineColor: () => '#dee2e6'
          },
          margin: [0, 10, 0, 25]
        },

        // DETALLE: Artículos
        {
          text: 'ARTÍCULOS',
          fontSize: 11,
          bold: true,
          color: '#198754',
          margin: [0, 0, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['5%', '15%', '34%', '8%', '8%', '15%', '15%'],
            body: [
              [
                { text: '#', style: 'tableHeader', alignment: 'center' },
                { text: 'CÓDIGO', style: 'tableHeader', alignment: 'center' },
                { text: 'DESCRIPCIÓN', style: 'tableHeader' },
                { text: 'CANT.', style: 'tableHeader', alignment: 'center' },
                { text: 'UNIDAD', style: 'tableHeader', alignment: 'center' },
                { text: 'PRECIO VENTA', style: 'tableHeader', alignment: 'center' },
                { text: 'PRIORIDAD', style: 'tableHeader', alignment: 'center' }
              ],
              ...(articulos.length > 0
                ? articulos.map((item: any, index: number) => [
                    { text: (index + 1).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.numArticle || item.code || '', alignment: 'center', fontSize: 7 },
                    { text: item.article || item.description || '', fontSize: 7 },
                    { text: (item.quantity || 0).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.measure || item.unit || 'PZA', alignment: 'center', fontSize: 7 },
                    { text: item.precioVenta ? `$${item.precioVenta.toFixed(2)}` : '$0.00', alignment: 'right', fontSize: 7 },
                    { text: item.priority || 'Normal', alignment: 'center', fontSize: 7 }
                  ])
                : [[{ text: 'No hay artículos en este pedimento', colSpan: 7, alignment: 'center', color: '#666', italics: true, fontSize: 7 }, {}, {}, {}, {}, {}, {}]]
              )
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return '#198754';
              return rowIndex % 2 === 0 ? '#f8f9fa' : null;
            },
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dee2e6',
            vLineColor: () => '#dee2e6'
          },
          margin: [0, 0, 0, 20]
        },

        // Resumen
        {
          columns: [
            { width: '70%', text: '' },
            {
              width: '30%',
              table: {
                widths: ['60%', '40%'],
                body: [
                  [
                    { text: 'Total Artículos:', bold: true, fillColor: '#e8f5e9' },
                    { text: articulos.length.toString(), alignment: 'right', bold: true, fillColor: '#e8f5e9' }
                  ]
                ]
              }
            }
          ],
          margin: [0, 0, 0, 40]
        },

        // Firmas
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'Solicitó:', bold: true, fontSize: 9, margin: [0, 0, 0, 25] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
                { text: 'Nombre y Firma', fontSize: 8, color: '#666', margin: [0, 3, 0, 0] }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'Autorizó:', bold: true, fontSize: 9, margin: [0, 0, 0, 25] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
                { text: 'Nombre y Firma', fontSize: 8, color: '#666', margin: [0, 3, 0, 0] }
              ]
            }
          ]
        }
      ],
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: 'white',
          fillColor: '#198754'
        }
      },
      // Definición de imágenes
      images: watermarkBase64 ? {
        logo: logoBase64,
        logo2: logo2Base64,
        watermark: watermarkBase64
      } : {
        logo: logoBase64,
        logo2: logo2Base64
      },
      footer: (currentPage: number, pageCount: number) => {
        return {
          columns: [
            { text: `Generado: ${new Date().toLocaleString('es-MX')}`, fontSize: 8, color: '#666', margin: [40, 0, 0, 0] },
            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, color: '#666', alignment: 'right', margin: [0, 0, 40, 0] }
          ],
          margin: [0, 20, 0, 0]
        };
      }
    };
  }

  closeReport() {
    if (this.params.context?.componentParent?.collapseReportDetail) {
      this.params.context.componentParent.collapseReportDetail();
    }
  }
}
