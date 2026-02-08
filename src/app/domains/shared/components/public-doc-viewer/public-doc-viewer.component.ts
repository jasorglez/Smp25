import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NotificationsTelegramService } from '../../../../services/notifications-telegram.service';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-public-doc-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-doc-viewer.component.html',
  styles: [`
    .public-doc-container {
      min-height: 100vh;
      background-color: #f5f5f5;
    }
    .header-bar {
      background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
      padding: 12px 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .pdf-container {
      height: calc(100vh - 120px);
      border: 1px solid #dee2e6;
      border-radius: 0.375rem;
    }
  `]
})
export class PublicDocViewerComponent implements OnInit {
  loading = true;
  errorMessage = '';
  pdfUrl: SafeResourceUrl | null = null;
  pdfBlobUrl: string | null = null;
  docTitle = '';
  isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  constructor(
    private route: ActivatedRoute,
    private notificationsService: NotificationsTelegramService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) {
        this.loading = false;
        this.errorMessage = 'No se proporcionó un token de acceso.';
        return;
      }
      this.loadDocument(token);
    });
  }

  private loadDocument(token: string) {
    this.loading = true;
    this.errorMessage = '';

    this.notificationsService.getPublicDocument(token).subscribe({
      next: (data) => {
        this.docTitle = `${data.documentType?.description || 'Documento'} - ${data.notification?.folio || ''}`;
        this.generatePdf(data);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 404) {
          this.errorMessage = 'Enlace inválido o no encontrado.';
        } else if (err.status === 400) {
          this.errorMessage = err.error?.error || 'Este enlace ha expirado.';
        } else {
          this.errorMessage = 'Error al cargar el documento. Intente nuevamente.';
        }
      }
    });
  }

  private generatePdf(data: any) {
    try {
      const docCode = data.documentType?.code?.toUpperCase();

      let docDefinition: any;
      if (docCode === 'OC' || docCode === 'REQUIS') {
        docDefinition = this.buildOCDocDefinition(data);
      } else {
        docDefinition = this.buildGenericDocDefinition(data);
      }

      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        this.pdfBlobUrl = url;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.loading = false;

        // On mobile, auto-open the PDF
        if (this.isMobile) {
          this.downloadPdf();
        }
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      this.loading = false;
      this.errorMessage = 'Error al generar el reporte PDF.';
    }
  }

  private buildOCDocDefinition(data: any): any {
    const doc = data.documentData?.document || {};
    const companyData = data.documentData?.companyData || {};
    const providerData = data.documentData?.providerData || {};
    const materials = data.documentData?.materials || [];
    const items = data.documentData?.details || [];
    const notification = data.notification || {};

    const logoBase64 = data.documentData?.logoBase64 || null;
    const logo2Base64 = data.documentData?.logo2Base64 || logoBase64;
    const watermarkBase64 = data.documentData?.watermarkBase64 || null;

    const fechaOC = this.formatDate(doc.dateCreate);
    const fechaEntrega = this.formatDate(doc.dateSupply);
    const ocNumero = doc.folio || notification.folio || 'N/A';
    const solicitante = doc.solicit || notification.solicitName || 'N/A';
    const comentarios = doc.comments || '';
    const docTypeLabel = data.documentType?.code === 'OC' ? 'ORDEN DE COMPRA' : 'REQUISICIÓN';

    // Map items with material descriptions
    const articulos = Array.isArray(items) ? items.map((item: any) => {
      const producto = Array.isArray(materials)
        ? materials.find((p: any) => p.id === item.idSupplie)
        : null;
      return {
        ...item,
        article: producto?.description || item.description || 'Sin descripción',
        numArticle: producto?.code || item.code || item.idSupplie || ''
      };
    }) : [];

    // Calculate totals
    const subtotal = articulos.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const descuento = doc.discount || 0;
    const subtotalConDescuento = subtotal - descuento;
    const iva = subtotalConDescuento * 0.16;
    const ivaRetencion = doc.ivaRetention || 0;
    const total = subtotalConDescuento + iva - ivaRetencion;

    // Status badge
    const statusText = this.getStatusLabel(notification.status);
    const statusColor = notification.status === 'APPROVED' ? '#28a745'
      : notification.status === 'REJECTED' ? '#dc3545'
      : '#ffc107';

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 80, 40, 40],
      defaultStyle: { fontSize: 9 },
      // Watermark
      background: watermarkBase64 ? [
        {
          image: 'watermark',
          width: 400,
          opacity: 0.15,
          absolutePosition: { x: 106, y: 250 }
        }
      ] : [],
      content: [
        // Header with logos
        {
          columns: [
            ...(logoBase64 ? [{ image: 'logo', width: 80, alignment: 'left' as const }] : []),
            {
              stack: [
                { text: companyData.name || 'Empresa', style: 'companyName', alignment: 'center' },
                { text: companyData.email || '', style: 'companyInfo', alignment: 'center' },
                { text: companyData.web || '', style: 'companyInfo', alignment: 'center' }
              ],
              width: '*'
            },
            {
              stack: [
                { text: docTypeLabel, style: 'documentTitle', alignment: 'right' },
                { text: `No. ${ocNumero}`, style: 'documentNumber', alignment: 'right', margin: [0, 5, 0, 0] },
                { text: `Fecha: ${fechaOC}`, style: 'documentDate', alignment: 'right', margin: [0, 3, 0, 0] }
              ],
              width: 150
            }
          ],
          margin: [0, 0, 0, 20]
        },
        // Status
        {
          text: `Estado: ${statusText}`,
          fontSize: 10,
          bold: true,
          color: statusColor,
          alignment: 'right',
          margin: [0, 0, 0, 5]
        },
        // Line separator
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#333333' }],
          margin: [0, 0, 0, 15]
        },
        // Billing and Provider
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'FACTURAR A:', bold: true, fontSize: 10, margin: [0, 0, 0, 5] },
                { text: companyData.name || '', fontSize: 9 },
                { text: companyData.address || '', fontSize: 9 },
                { text: companyData.rfc || '', fontSize: 9 },
                { text: `${companyData.city || ''}, ${companyData.state || ''}, ${companyData.country || ''}`, fontSize: 9 },
                { text: companyData.phone || '', fontSize: 9 }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'PROVEEDOR:', bold: true, fontSize: 10, margin: [0, 0, 0, 5] },
                { text: providerData.name || 'Sin proveedor', fontSize: 9 },
                { text: providerData.address || '', fontSize: 9 },
                { text: providerData.rfc || '', fontSize: 9 },
                { text: `${providerData.city || ''}, ${providerData.state || ''}, ${providerData.country || ''}`, fontSize: 9 },
                { text: providerData.phone || '', fontSize: 9 }
              ]
            }
          ],
          margin: [0, 0, 0, 15]
        },
        // Additional info
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'SOLICITANTE:', style: 'masterLabel' },
                { text: solicitante, style: 'masterValue' },
                { text: 'FECHA ENTREGA:', style: 'masterLabel' },
                { text: fechaEntrega, style: 'masterValue' }
              ],
              [
                { text: 'AUTORIZA:', style: 'masterLabel' },
                { text: notification.authorizeName || '', style: 'masterValue' },
                { text: 'RESPONDIDO:', style: 'masterLabel' },
                { text: notification.respondedAt ? this.formatDate(notification.respondedAt) : 'Pendiente', style: 'masterValue' }
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
        // Rejection reason
        ...(notification.status === 'REJECTED' && notification.rejectionReason ? [
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: `MOTIVO DE RECHAZO: ${notification.rejectionReason}`, fontSize: 9, color: '#dc3545', bold: true }]
              ]
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#dc3545',
              vLineColor: () => '#dc3545',
              fillColor: () => '#fff5f5',
              paddingTop: () => 5,
              paddingBottom: () => 5,
              paddingLeft: () => 8,
              paddingRight: () => 8
            },
            margin: [0, 0, 0, 15]
          }
        ] : []),
        // Articles title
        { text: 'ARTÍCULOS', fontSize: 11, bold: true, color: '#0d6efd', margin: [0, 0, 0, 10] },
        // Articles table
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
                    { text: item.numArticle || '', alignment: 'center', fontSize: 7 },
                    { text: item.article || '', fontSize: 7 },
                    { text: (item.quantity || 0).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.measure || '', alignment: 'center', fontSize: 7 },
                    { text: this.formatCurrency(item.price || 0), alignment: 'right', fontSize: 7 },
                    { text: this.formatCurrency(item.total || 0), alignment: 'right', fontSize: 7 }
                  ])
                : [[{ text: 'No hay artículos', colSpan: 7, alignment: 'center', color: '#666', italics: true, fontSize: 7 }, {}, {}, {}, {}, {}, {}]]
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
        // Totals
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
        // Comments
        comentarios ? {
          stack: [
            { text: 'OBSERVACIONES:', bold: true, fontSize: 9, margin: [0, 0, 0, 5] },
            { text: comentarios, fontSize: 9, margin: [0, 0, 0, 20] }
          ]
        } : { text: '', margin: [0, 0, 0, 20] },
        // Signatures
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'Solicita:', bold: true, fontSize: 9, margin: [0, 0, 0, 25] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
                { text: solicitante, fontSize: 8, color: '#666', margin: [0, 3, 0, 0] }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'Autoriza:', bold: true, fontSize: 9, margin: [0, 0, 0, 25] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
                { text: notification.authorizeName || 'Nombre y Firma', fontSize: 8, color: '#666', margin: [0, 3, 0, 0] }
              ]
            }
          ]
        }
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#333333' },
        companyInfo: { fontSize: 9, color: '#666666' },
        documentTitle: { fontSize: 11, bold: true, color: '#0d6efd' },
        documentNumber: { fontSize: 12, bold: true, color: '#333333' },
        documentDate: { fontSize: 9, color: '#666666' },
        masterLabel: { bold: true, fontSize: 9, fillColor: '#f8f9fa' },
        masterValue: { fontSize: 9 },
        tableHeader: { bold: true, fontSize: 8, color: 'white', fillColor: '#0d6efd' }
      },
      images: {
        ...(logoBase64 ? { logo: logoBase64 } : {}),
        ...(logo2Base64 ? { logo2: logo2Base64 } : {}),
        ...(watermarkBase64 ? { watermark: watermarkBase64 } : {})
      },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-MX')}`, fontSize: 8, color: '#666', margin: [40, 0, 0, 0] },
          { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, color: '#666', alignment: 'right', margin: [0, 0, 40, 0] }
        ],
        margin: [0, 20, 0, 0]
      })
    };
  }

  private buildGenericDocDefinition(data: any): any {
    const doc = data.documentData?.document || {};
    const notification = data.notification || {};
    const docTypeLabel = data.documentType?.description || 'Documento';

    const fields = Object.keys(doc)
      .filter(key => typeof doc[key] !== 'object' && doc[key] !== null)
      .map(key => [
        { text: this.formatFieldName(key), bold: true, fontSize: 9 },
        { text: String(doc[key]), fontSize: 9 }
      ]);

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 40],
      defaultStyle: { fontSize: 9 },
      content: [
        { text: docTypeLabel, fontSize: 16, bold: true, color: '#0d6efd', margin: [0, 0, 0, 10] },
        { text: `Folio: ${notification.folio || ''}`, fontSize: 12, margin: [0, 0, 0, 15] },
        {
          table: {
            widths: ['30%', '70%'],
            body: fields.length > 0 ? fields : [[{ text: 'Sin datos', colSpan: 2 }, {}]]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#dee2e6',
            vLineColor: () => '#dee2e6',
            paddingTop: () => 4,
            paddingBottom: () => 4,
            paddingLeft: () => 8,
            paddingRight: () => 8
          }
        }
      ]
    };
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Pendiente de Autorización',
      'APPROVED': 'Aprobado',
      'REJECTED': 'Rechazado',
      'AWAITING_REASON': 'Esperando Motivo'
    };
    return labels[status] || status;
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) return '';
    try {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [datePart] = value.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch { return ''; }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
  }

  private formatFieldName(name: string): string {
    return name.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^\s/, '').replace(/\b\w/g, c => c.toUpperCase());
  }

  downloadPdf() {
    if (!this.pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.pdfBlobUrl;
    a.download = `${this.docTitle || 'documento'}.pdf`;
    a.click();
  }
}
