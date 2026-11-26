import { PdfReportViewerComponent } from 'app/shared/pdf-report-viewer/pdf-report-viewer.component';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ICellRendererParams, ICellRendererComp } from 'ag-grid-enterprise';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TrackingService } from 'app/services/tracking.service';
import { pdfPreviewUrl } from 'app/helpers/pdf-viewer';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

// pdfMake solo descarga fuentes vía URL absoluta (su URLBrowserResolver
// ignora rutas relativas en silencio); se resuelve en runtime contra el origen.
const pdfFontsBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

@Component({
  selector: 'app-detail-cell-renderer-entry-report',
  standalone: true,
  imports: [CommonModule, PdfReportViewerComponent, TranslateModule],
  template: `
    <div class="report-detail-container">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">{{ 'modules.warehouses.ui.report.previewTitle' | translate }} - {{ 'modules.warehouses.ui.report.reference' | translate }}: {{ entryData?.folio || ('modules.warehouses.ui.report.noReference' | translate) }}</h5>
        <div class="d-flex align-items-center gap-2">

          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()"><i class="bi bi-x-lg"></i> {{ 'modules.warehouses.ui.report.close' | translate }}</button>
        </div>
      </div>
      <div class="report-content" style="width:100%; min-width:0; height:920px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <app-pdf-report-viewer *ngIf="pdfUrl" [sourceUrl]="pdfUrl" [title]="'modules.warehouses.ui.report.receiptReport' | translate" fileName="Reporte_Entrada.pdf"></app-pdf-report-viewer>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">{{ 'modules.warehouses.ui.report.generating' | translate }}</span>
            </div>
            <p class="mt-2 text-muted">{{ 'modules.warehouses.ui.report.generatingPdf' | translate }}</p>
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
  private trackingService = inject(TrackingService);
  private translate = inject(TranslateService);

  entryData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;
  pdfZoom = 125;
  readonly minPdfZoom = 75;
  readonly maxPdfZoom = 200;

  zoomIn(): void { this.setPdfZoom(this.pdfZoom + 10); }
  zoomOut(): void { this.setPdfZoom(this.pdfZoom - 10); }
  private setPdfZoom(value: number): void {
    this.pdfZoom = Math.max(this.minPdfZoom, Math.min(this.maxPdfZoom, value));
    if (!this.originalPdfUrl) return;
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      pdfPreviewUrl(this.originalPdfUrl, this.pdfZoom)
    );
  }

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

    console.log('Entry data type:', this.entryData.type);
    console.log(`Generating report for ${this.entryData.type === 'IN' ? 'ENTRADA' : 'SALIDA'}`);

    try {
      // Configure fonts for pdfMake. Auto-hospedadas con URL absoluta (ver
      // nota junto a pdfFontsBaseUrl arriba).
      pdfMake.fonts = {
        Montserrat: {
          normal: `${pdfFontsBaseUrl}/assets/fonts/Montserrat-Regular.ttf`,
          bold: `${pdfFontsBaseUrl}/assets/fonts/Montserrat-Bold.ttf`,
          italics: `${pdfFontsBaseUrl}/assets/fonts/Montserrat-Italic.ttf`,
          bolditalics: `${pdfFontsBaseUrl}/assets/fonts/Montserrat-BoldItalic.ttf`,
        }
      };

      // Create PDF definition
      const docDefinition = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
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
            text: `${this.translate.instant(this.entryData.type === 'IN' ? 'modules.warehouses.ui.movements.receiptVoucher' : 'modules.warehouses.ui.movements.issue') } - ${this.translate.instant('modules.warehouses.ui.report.reference')}: ${this.entryData.folio || this.translate.instant('modules.warehouses.ui.report.noReference')}`,
            style: 'header'
          },
          {
            text: `${this.translate.instant('modules.warehouses.ui.report.detailsOf')} ${this.translate.instant(this.entryData.type === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue')}`,
            style: 'subheader'
          },
          {
            table: {
              widths: ['25%', '75%'],
              body: [
                [this.translate.instant('modules.warehouses.ui.report.fields.folio'), this.entryData.folio || 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.date'), this.entryData.date ? new Date(this.entryData.date).toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX') : 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.deliveryDate'), this.entryData.deliveryDate ? new Date(this.entryData.deliveryDate).toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX') : 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.invoice'), this.entryData.numBill || 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.deliveredBy'), this.entryData.deliverName || 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.comment'), this.entryData.comment || 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.entryType'), this.translate.instant(this.entryData.directEntry ? 'modules.warehouses.ui.report.fields.direct' : 'modules.warehouses.ui.report.fields.normal')],
                [this.translate.instant('modules.warehouses.ui.report.fields.customerPurchaseOrder'), this.entryData.ocList || 'N/A'],
                [this.translate.instant('modules.warehouses.ui.report.fields.items'), this.entryData.countrow || 0]
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
                    text: `${this.translate.instant('modules.warehouses.ui.report.deliver')}:`,
                    style: 'signatureLabel',
                    margin: [0, 0, 0, 2]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: this.translate.instant('modules.warehouses.ui.report.name'),
                    style: 'signatureText',
                    margin: [0, 1, 0, 1]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: this.translate.instant('modules.warehouses.ui.report.signature'),
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
                    text: `${this.translate.instant('modules.warehouses.ui.report.receivedBy')}:`,
                    style: 'signatureLabel',
                    margin: [0, 0, 0, 2]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: this.translate.instant('modules.warehouses.ui.report.name'),
                    style: 'signatureText',
                    margin: [0, 1, 0, 1]
                  },
                  {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1 }],
                    margin: [0, 0, 0, 2]
                  },
                  {
                    text: this.translate.instant('modules.warehouses.ui.report.signature'),
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
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Generó PDF reporte entrada almacén TD', 'Almacén TD / Entradas', this.trackingService.getEmail());
      pdfMake.createPdf(docDefinition as any).getBlob((blob) => {
        // Clean up previous URL
        if (this.originalPdfUrl) {
          URL.revokeObjectURL(this.originalPdfUrl);
        }

        // Create new URL for blob
        const url = URL.createObjectURL(blob);
        this.originalPdfUrl = url;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfPreviewUrl(url, this.pdfZoom));
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
