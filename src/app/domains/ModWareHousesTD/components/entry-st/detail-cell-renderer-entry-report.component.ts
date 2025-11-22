import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ICellRendererParams, ICellRendererComp } from 'ag-grid-enterprise';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

@Component({
  selector: 'app-detail-cell-renderer-entry-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-detail-container">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Vista Previa del Reporte - Folio: {{ entryData?.folio || 'Sin Folio' }}</h5>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="report-content" style="height: 400px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Generando reporte...</span>
            </div>
            <p class="mt-2 text-muted">Generando reporte PDF...</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-detail-container {
      padding: 15px;
    }
    .report-header {
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 10px;
    }
  `]
})
export class DetailCellRendererEntryReportComponent implements OnInit, ICellRendererComp {

  private params!: ICellRendererParams;
  private context: any;
  private sanitizer = inject(DomSanitizer);

  entryData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  ngOnInit() {
    // Generate PDF when component initializes
    this.generateReport();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.entryData = params.data;
    this.generateReport();
  }

  private async generateReport() {
    if (!this.entryData) return;

    try {
      // Configure fonts for pdfMake
      pdfMake.fonts = {
        Montserrat: {
          normal: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Regular.ttf',
          bold: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Bold.ttf',
          italics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-Italic.ttf',
          bolditalics: 'https://fonts.cdnfonts.com/s/14883/Montserrat-BoldItalic.ttf',
        }
      };

      // Create PDF definition
      const docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [40, 60, 40, 80], // Increased bottom margin for footer
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
          signatureLabel: {
            fontSize: 6,
            bold: true,
            color: '#333',
            alignment: 'left'
          },
          signatureText: {
            fontSize: 4,
            color: '#666',
            alignment: 'left'
          }
        },
        content: [
          {
            text: `Reporte de Entrada - Folio: ${this.entryData.folio || 'Sin Folio'}`,
            style: 'header'
          },
          {
            text: 'Información General',
            style: 'subheader'
          },
          {
            table: {
              widths: ['25%', '75%'],
              body: [
                ['Folio', this.entryData.folio || 'N/A'],
                ['Fecha', this.entryData.date ? new Date(this.entryData.date).toLocaleDateString('es-MX') : 'N/A'],
                ['Fecha Entrega', this.entryData.deliveryDate ? new Date(this.entryData.deliveryDate).toLocaleDateString('es-MX') : 'N/A'],
                ['Factura', this.entryData.numBill || 'N/A'],
                ['Entregado Por', this.entryData.deliverName || 'N/A'],
                ['Comentario', this.entryData.comment || 'N/A'],
                ['Tipo Entrada', this.entryData.directEntry ? 'Directa' : 'Normal'],
                ['Cliente/OC', this.entryData.ocList || 'N/A'],
                ['Items', this.entryData.countrow || 0]
              ]
            },
            layout: {
              fillColor: function (rowIndex: number) {
                return (rowIndex % 2 === 0) ? '#f9f9f9' : null;
              }
            }
          }
        ],
        footer: function (currentPage: number, pageCount: number) {
          // Always show signature section on every page
          return {
            margin: [40, 15, 40, 20],
            columns: [
              // Left side - Delivery signature
              {
                width: '50%',
                stack: [
                  {
                    text: 'Entrega:',
                    style: 'signatureLabel',
                    margin: [0, 0, 0, 2]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: 'Nombre',
                    style: 'signatureText',
                    margin: [0, 1, 0, 1]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: 'Firma',
                    style: 'signatureText',
                    margin: [0, 1, 0, 0]
                  }
                ]
              },
              // Right side - Receipt signature
              {
                width: '50%',
                stack: [
                  {
                    text: 'Recibe:',
                    style: 'signatureLabel',
                    margin: [0, 0, 0, 2]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: 'Nombre',
                    style: 'signatureText',
                    margin: [0, 1, 0, 1]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: 'Firma',
                    style: 'signatureText',
                    margin: [0, 1, 0, 0]
                  }
                ]
              }
            ]
          };
        }
      };

      // Generate PDF and create preview URL
      pdfMake.createPdf(docDefinition as any).getBlob((blob) => {
        // Clean up previous URL
        if (this.originalPdfUrl) {
          URL.revokeObjectURL(this.originalPdfUrl);
        }

        // Create new URL for blob
        const url = URL.createObjectURL(blob);
        this.originalPdfUrl = url;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      });

    } catch (error) {
      console.error('Error generating report PDF:', error);
    }
  }

  closeReport() {
    // Emit event to parent component to handle collapse
    // The parent component will handle the collapse to avoid AG Grid rendering conflicts
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapseReportDetail(this.entryData.id);
    }
  }

  // Required methods for ICellRendererComp
  getGui(): HTMLElement {
    return (this as any).elementRef?.nativeElement || document.createElement('div');
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.context = params.context;
    this.entryData = params.data;
    this.generateReport();
    return true;
  }

  ngOnDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
  }
}