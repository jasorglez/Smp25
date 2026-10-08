import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { CustomersService } from 'app/services/customers.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { MaterialsService } from 'app/services/materials.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts as unknown as Record<string, string>;

@Component({
  selector: 'app-detail-cell-renderer-purchaseorder-report',
  standalone: true,
  imports: [CommonModule, PdfShareButtonsComponent],
  template: `
    <div class="report-detail-container">
      <div class="report-header d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 class="mb-0">
          <i class="bi bi-file-earmark-pdf text-danger me-2"></i>
          Orden de Compra: {{ purchaseOrderData?.folio || 'Sin Número' }}
        </h5>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <a *ngIf="pdfObjectUrl && !isLoading" class="btn btn-outline-primary btn-sm"
             [href]="pdfObjectUrl" target="_blank" rel="noopener noreferrer">
            <i class="bi bi-box-arrow-up-right"></i> Abrir PDF
          </a>
          <a *ngIf="pdfObjectUrl && !isLoading" class="btn btn-outline-primary btn-sm"
             [href]="pdfObjectUrl" [attr.download]="'OC_' + (purchaseOrderData?.folio || purchaseOrderData?.id) + '.pdf'">
            <i class="bi bi-download"></i> Descargar
          </a>
          <app-pdf-share-buttons
            [getPdfBlob]="getPdfBlobFn"
            [fileName]="'OC_' + (purchaseOrderData?.folio || purchaseOrderData?.id) + '.pdf'"
            [subject]="'Orden de Compra ' + (purchaseOrderData?.folio || purchaseOrderData?.id)">
          </app-pdf-share-buttons>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
            <i class="bi bi-x-lg"></i> Cerrar
          </button>
        </div>
      </div>
      <div class="report-content" [style.height.px]="isTouchDevice ? 260 : 1200"
           style="border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <div *ngIf="isLoading" class="d-flex justify-content-center align-items-center h-100">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <span class="ms-2">Generando reporte...</span>
        </div>
        <iframe
          *ngIf="pdfUrl && !isLoading && !isTouchDevice"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="pdfObjectUrl && !isLoading && isTouchDevice" class="p-3 text-center">
          <p>El PDF está listo. Usa <strong>Abrir PDF</strong> para verlo en el visor de tu tableta.</p>
          <a class="btn btn-primary" [href]="pdfObjectUrl" target="_blank" rel="noopener noreferrer">
            <i class="bi bi-box-arrow-up-right me-1"></i> Abrir PDF
          </a>
        </div>
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
export class DetailCellRendererPurchaseOrderReportComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private customersService = inject(CustomersService);
  private requisitionsService = inject(OcAndReqsService);
  private materialsService = inject(MaterialsService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);

  private params!: ICellRendererParams;
  purchaseOrderData: any;
  pdfUrl: SafeResourceUrl | null = null;
  pdfObjectUrl: string | null = null;
  readonly isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  isLoading: boolean = true;
  private destroyed = false;
  private _pdfBlob: Blob | null = null;

  getPdfBlobFn = (): Promise<Blob> =>
    this._pdfBlob ? Promise.resolve(this._pdfBlob) : Promise.reject('PDF no generado aún');

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.purchaseOrderData = params.data;
    this.generateReport();
  }

  async generateReport() {
    this.isLoading = true;
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      // Las consultas independientes no deben esperar al catálogo ni a los logos.
      // Los artículos se consultan siempre para reflejar los últimos cambios guardados.
      const companyPromise = lastValueFrom(this.rootService.getRootbyId(idRoot));
      const companyWithImagesPromise = companyPromise.then(async (companyData: any) => {
        const images = new Map<string, Promise<string>>();
        const loadImage = (url: string): Promise<string> => {
          if (!url) return Promise.resolve('');
          if (!images.has(url)) {
            images.set(url, this.base64EncodeService.convertImageToBase64(url));
          }
          return images.get(url)!;
        };
        const [logoBase64, logo2Base64, watermarkBase64] = await Promise.all([
          loadImage(companyData?.picture),
          loadImage(companyData?.picture2 || companyData?.picture),
          loadImage(companyData?.picture3)
        ]);
        return { companyData, logoBase64, logo2Base64, watermarkBase64 };
      });

      const context = paramsContext(this.params);
      const loadedProducts = ((this.params as any)?.productos || context?.productos || []) as any[];
      const productsPromise: Promise<any[]> = loadedProducts.length > 0
        ? Promise.resolve(loadedProducts)
        : lastValueFrom(this.materialsService.getMaterials2Fields(idRoot)) as Promise<any[]>;

      const providers = ((this.params as any)?.proveedores || context?.proveedores || []) as any[];
      const providerId = this.purchaseOrderData.idProvider ?? this.purchaseOrderData.idProveedor;
      const providerFromGrid = providers.find((provider: any) =>
        String(provider.id) === String(providerId)
      );
      const providerFallback = providerFromGrid
        ? { ...providerFromGrid, company: providerFromGrid.company || providerFromGrid.name }
        : null;
      const providerPromise = providerId && Number(providerId) > 0
        ? lastValueFrom(this.customersService.getCustomerById(Number(providerId)))
            .then(provider => ({ ...providerFallback, ...provider }))
            .catch(error => {
              console.warn('No se pudo cargar el proveedor:', error);
              return providerFallback;
            })
        : Promise.resolve(providerFallback);

      const purchaseOrderId = this.purchaseOrderData.id;
      const itemsPromise: Promise<any[]> = purchaseOrderId && !String(purchaseOrderId).startsWith('temp_')
        ? lastValueFrom(this.requisitionsService.getReqItems(purchaseOrderId))
        : Promise.resolve([]);
      const [company, products, providerData, items] = await Promise.all([
        companyWithImagesPromise, productsPromise, providerPromise, itemsPromise
      ]);
      if (this.destroyed) return;

      const { companyData, logoBase64, logo2Base64, watermarkBase64 } = company;
      const productsById = new Map(products.map(product => [String(product.id), product]));
      const articulos = items.map(item => {
        const product = productsById.get(String(item.idSupplie));
        return {
          ...item,
          article: product?.description || 'Sin descripción',
          numArticle: product?.code || item.idSupplie || ''
        };
      });

      // Generar el PDF
      const docDefinition = this.buildDocDefinition(companyData, logoBase64, logo2Base64, watermarkBase64, providerData, articulos);

      this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió/abrió PDF orden de compra', 'Almacén / Órdenes de Compra', this.trackingService.getEmail());
      const pdfDocGenerator = pdfMake.createPdf(docDefinition as any);
      pdfDocGenerator.getBlob((blob: Blob) => {
        if (this.destroyed) return;
        this._pdfBlob = blob;
        if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
        const url = URL.createObjectURL(blob);
        this.pdfObjectUrl = url;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoading = false;
      });

    } catch (error) {
      console.error('Error generando reporte:', error);
      this.isLoading = false;
      this.pdfUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
  }

  private formatDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    try {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [datePart] = value.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        return [
          day.toString().padStart(2, '0'),
          month.toString().padStart(2, '0'),
          year.toString()
        ].join('/');
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return [
        date.getDate().toString().padStart(2, '0'),
        (date.getMonth() + 1).toString().padStart(2, '0'),
        date.getFullYear()
      ].join('/');
    } catch (error) {
      return '';
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  }

  private buildDocDefinition(companyData: any, logoBase64: string, logo2Base64: string, watermarkBase64: string | null, providerData: any, articulos: any[]): any {
    const fechaOC = this.purchaseOrderData.dateCreate ? this.formatDate(this.purchaseOrderData.dateCreate) : '';
    const fechaEntrega = this.purchaseOrderData.dateSupply ? this.formatDate(this.purchaseOrderData.dateSupply) : '';
    const ocNumero = this.purchaseOrderData.folio || 'N/A';
    const usuarios = ((this.params as any)?.usuarios || paramsContext(this.params)?.usuarios || []) as any[];
    const solicitanteSeleccionado = usuarios.find((usuario: any) =>
      String(usuario.id) === String(this.purchaseOrderData.idSolicit)
    );
    const solicitante = solicitanteSeleccionado?.displayName
      || solicitanteSeleccionado?.name
      || this.purchaseOrderData.solicit
      || 'N/A';
    const comentarios = this.purchaseOrderData.comments || '';

    // Calcular totales
    const subtotal = articulos.reduce((sum, item) => sum + (item.total || 0), 0);
    const descuento = this.purchaseOrderData.discount || 0;
    const subtotalConDescuento = subtotal - descuento;
    const iva = subtotalConDescuento * 0.16;
    const ivaRetencion = this.purchaseOrderData.ivaRetention || 0;
    const total = subtotalConDescuento + iva - ivaRetencion;

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 80, 40, 40],
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
                  text: companyData?.name || 'Empresa',
                  style: 'companyName',
                  alignment: 'center'
                },
                {
                  text: companyData?.email || '',
                  style: 'companyInfo',
                  alignment: 'center'
                },
                {
                  text: companyData?.web || '',
                  style: 'companyInfo',
                  alignment: 'center'
                }
              ],
              width: '*'
            },
            {
              stack: [
                {
                  text: 'ORDEN DE COMPRA',
                  style: 'documentTitle',
                  alignment: 'right'
                },
                {
                  text: `No. ${ocNumero}`,
                  style: 'documentNumber',
                  alignment: 'right',
                  margin: [0, 5, 0, 0]
                },
                {
                  text: `Fecha: ${fechaOC}`,
                  style: 'documentDate',
                  alignment: 'right',
                  margin: [0, 3, 0, 0]
                }
              ],
              width: 150
            }
          ],
          margin: [0, 0, 0, 20]
        },
        // Línea separadora
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 1,
              lineColor: '#333333'
            }
          ],
          margin: [0, 0, 0, 15]
        },
        // Datos de facturación y proveedor
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'FACTURAR A:', bold: true, fontSize: 10, margin: [0, 0, 0, 5] },
                { text: companyData?.name || '', fontSize: 9 },
                { text: companyData?.address || '', fontSize: 9 },
                { text: companyData?.rfc || '', fontSize: 9 },
                { text: `${companyData?.city || ''}, ${companyData?.state || ''}, ${companyData?.country || ''}`, fontSize: 9 },
                { text: companyData?.phone || '', fontSize: 9 }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'PROVEEDOR:', bold: true, fontSize: 10, margin: [0, 0, 0, 5] },
                { text: providerData?.company || providerData?.nameContact || providerData?.namecontact || providerData?.name || 'Sin proveedor', fontSize: 9 },
                { text: providerData?.address || '', fontSize: 9 },
                { text: providerData?.rfc || '', fontSize: 9 },
                { text: `${providerData?.city || ''}, ${providerData?.state || ''}, ${providerData?.country || ''}`, fontSize: 9 },
                { text: providerData?.phone || '', fontSize: 9 }
              ]
            }
          ],
          margin: [0, 0, 0, 15]
        },
        // Información adicional
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'SOLICITANTE:', style: 'masterLabel' },
                { text: solicitante, style: 'masterValue' },
                { text: 'FECHA ENTREGA:', style: 'masterLabel' },
                { text: fechaEntrega, style: 'masterValue' }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
            paddingTop: () => 5,
            paddingBottom: () => 5,
            paddingLeft: () => 8,
            paddingRight: () => 8
          },
          margin: [0, 0, 0, 15]
        },
        // Título de artículos
        {
          text: 'ARTÍCULOS',
          fontSize: 11,
          bold: true,
          color: '#0d6efd',
          margin: [0, 0, 0, 10]
        },
        // Tabla de artículos
        {
          table: {
            headerRows: 1,
            widths: ['5%', '12%', '33%', '10%', '10%', '15%', '15%'],
            body: [
              [
                { text: '#', style: 'tableHeader', alignment: 'center' },
                { text: 'CÓDIGO', style: 'tableHeader', alignment: 'center' },
                { text: 'DESCRIPCIÓN', style: 'tableHeader' },
                { text: 'CANT.', style: 'tableHeader', alignment: 'center' },
                { text: 'UNIDAD', style: 'tableHeader', alignment: 'center' },
                { text: 'P. UNIT.', style: 'tableHeader', alignment: 'right' },
                { text: 'IMPORTE', style: 'tableHeader', alignment: 'right' }
              ],
              ...(articulos.length > 0
                ? articulos.map((item: any, index: number) => [
                    { text: (index + 1).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.numArticle || item.code || '', alignment: 'center', fontSize: 7 },
                    { text: item.article || item.description || '', fontSize: 7 },
                    { text: (item.quantity || 0).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.measure || '', alignment: 'center', fontSize: 7 },
                    { text: this.formatCurrency(item.price || 0), alignment: 'right', fontSize: 7 },
                    { text: this.formatCurrency(item.total || 0), alignment: 'right', fontSize: 7 }
                  ])
                : [[{ text: 'No hay artículos en esta orden de compra', colSpan: 7, alignment: 'center', color: '#666', italics: true, fontSize: 7 }, {}, {}, {}, {}, {}, {}]]
              )
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return '#0d6efd';
              return rowIndex % 2 === 0 ? '#f8f9fa' : null;
            },
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dee2e6',
            vLineColor: () => '#dee2e6'
          },
          margin: [0, 0, 0, 20]
        },
        // Resumen de totales
        {
          columns: [
            { width: '60%', text: '' },
            {
              width: '40%',
              table: {
                widths: ['60%', '40%'],
                body: [
                  [
                    { text: 'Suma:', alignment: 'right', fillColor: '#f8f9fa' },
                    { text: this.formatCurrency(subtotal), alignment: 'right', fillColor: '#f8f9fa' }
                  ],
                  [
                    { text: 'Descuento:', alignment: 'right' },
                    { text: this.formatCurrency(descuento), alignment: 'right' }
                  ],
                  [
                    { text: 'Subtotal:', alignment: 'right', fillColor: '#f8f9fa' },
                    { text: this.formatCurrency(subtotalConDescuento), alignment: 'right', fillColor: '#f8f9fa' }
                  ],
                  [
                    { text: 'IVA 16%:', alignment: 'right' },
                    { text: this.formatCurrency(iva), alignment: 'right' }
                  ],
                  [
                    { text: 'Retención IVA:', alignment: 'right', fillColor: '#f8f9fa' },
                    { text: this.formatCurrency(ivaRetencion), alignment: 'right', fillColor: '#f8f9fa' }
                  ],
                  [
                    { text: 'TOTAL:', alignment: 'right', bold: true, fillColor: '#e8f5e9' },
                    { text: this.formatCurrency(total), alignment: 'right', bold: true, fillColor: '#e8f5e9' }
                  ]
                ]
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#dee2e6',
                vLineColor: () => '#dee2e6'
              }
            }
          ],
          margin: [0, 0, 0, 20]
        },
        // Observaciones
        comentarios ? {
          stack: [
            { text: 'OBSERVACIONES:', bold: true, fontSize: 9, margin: [0, 0, 0, 5] },
            { text: comentarios, fontSize: 9, margin: [0, 0, 0, 20] }
          ]
        } : { text: '', margin: [0, 0, 0, 20] },
        // Firmas
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'Solicita:', bold: true, fontSize: 9, margin: [0, 0, 0, 25] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
                { text: 'Nombre y Firma', fontSize: 8, color: '#666', margin: [0, 3, 0, 0] }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'Autoriza:', bold: true, fontSize: 9, margin: [0, 0, 0, 25] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
                { text: 'Nombre y Firma', fontSize: 8, color: '#666', margin: [0, 3, 0, 0] }
              ]
            }
          ]
        }
      ],
      styles: {
        companyName: {
          fontSize: 14,
          bold: true,
          color: '#333333'
        },
        companyInfo: {
          fontSize: 9,
          color: '#666666'
        },
        documentTitle: {
          fontSize: 11,
          bold: true,
          color: '#0d6efd'
        },
        documentNumber: {
          fontSize: 12,
          bold: true,
          color: '#333333'
        },
        documentDate: {
          fontSize: 9,
          color: '#666666'
        },
        masterLabel: {
          bold: true,
          fontSize: 9,
          fillColor: '#f8f9fa'
        },
        masterValue: {
          fontSize: 9
        },
        tableHeader: {
          bold: true,
          fontSize: 8,
          color: 'white',
          fillColor: '#0d6efd'
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

function paramsContext(params: ICellRendererParams): any {
  return (params as any)?.context || (params as any)?.api?.getGridOption?.('context') || {};
}
