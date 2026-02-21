import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { LogbookService } from 'app/services/logbook.service';
import { alerts } from 'app/helpers/alerts';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-pdf-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pdf-detail-container" style="padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">Vista Previa del Reporte PDF</h6>
        <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="pdf-content" style="height: 550px; border: 1px solid #dee2e6; border-radius: 0.375rem; background: white;">
        <iframe *ngIf="pdfUrl" [src]="pdfUrl" style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;"></iframe>
        <div *ngIf="!pdfUrl && !isLoading" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              El formato de PDF se configurará próximamente.
              <br>
              <small class="text-muted">Por favor, proporcione el formato con los logos de la empresa.</small>
            </div>
          </div>
        </div>
        <div *ngIf="isLoading" class="d-flex justify-content-center align-items-center h-100">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`.pdf-detail-container { padding: 5px; }`]
})
export class PdfDetailComponent implements OnInit, ICellRendererAngularComp {
  @Input() data: any;
  @Input() context: any;

  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private administrationService = inject(AdministrationService);
  private signalsService = inject(SignalsService);
  private sanitizer = inject(DomSanitizer);

  pdfUrl: SafeResourceUrl | null = null;
  isLoading: boolean = false;
  reportData: any = null;

  agInit(params: ICellRendererParams): void {
    this.data = params.data;
    this.context = params.context;
  }

  refresh(params: ICellRendererParams): boolean {
    this.data = params.data;
    return true;
  }

  ngOnInit(): void {
    if (this.data) {
      this.reportData = this.data;
      this.generatePdfPreview();
    }
  }

  private async generatePdfPreview(): Promise<void> {
    this.isLoading = true;
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (!idRoot) {
        this.isLoading = false;
        return;
      }

      const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));
      const companyName = rootResponse?.name || 'REPORTE DIARIO';
      const report = this.reportData;

      const logoBase64 = rootResponse?.picture ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture) : '';
      const logo2Base64 = rootResponse?.picture2 ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture2) : logoBase64;
      const watermarkBase64 = rootResponse?.picture3 ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture3) : null;

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
        pageMargins: [40, 90, 40, 60],
        header: {
          margin: [40, 20, 40, 0],
          columns: [
            { image: 'logo', width: 60, alignment: 'left' },
            {
              stack: [
                { text: companyName, style: 'headerTitle', alignment: 'center' },
                { text: 'REPORTE DIARIO DE OBRA', style: 'reportTitle', alignment: 'center', margin: [0, 5, 0, 0] },
                { text: `Fecha: ${this.formatDate(report.date)}`, style: 'headerAddress', alignment: 'center', margin: [0, 3, 0, 0] }
              ],
              width: '*'
            },
            { image: 'logo2', width: 60, alignment: 'right' }
          ]
        },
        footer: (currentPage: number, pageCount: number) => {
          return {
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 8,
            alignment: 'center',
            margin: [0, 10, 0, 0]
          };
        },
        background: watermarkBase64 ? [
          {
            image: 'watermark',
            width: 400,
            opacity: 0.10,
            absolutePosition: { x: 200, y: 150 }
          }
        ] : [],
        content: [
          {
            columns: [
              { text: [{ text: 'INICIO: ', bold: true }, { text: report.startTime || '' }], fontSize: 10 },
              { text: [{ text: 'TÉRMINO: ', bold: true }, { text: report.endTime || '' }], fontSize: 10 }
            ],
            margin: [0, 0, 0, 10]
          },
          {
            columns: [
              { text: [{ text: 'TIPO: ', bold: true }, { text: report.type || '' }], fontSize: 10 },
              { text: [{ text: 'TOTAL: ', bold: true }, { text: this.formatCurrency(report.totalPay) }], fontSize: 10 }
            ],
            margin: [0, 0, 0, 10]
          },
          {
            text: [{ text: 'DESCRIPCIÓN: ', bold: true }, { text: report.description || 'Sin descripción' }],
            fontSize: 10,
            margin: [0, 0, 0, 20]
          },
          { text: 'FIRMAS DE AUTORIZACIÓN', style: 'sectionTitle', alignment: 'center', margin: [0, 20, 0, 15] },
          {
            table: {
              widths: ['33%', '34%', '33%'],
              body: [
                [
                  { text: 'SUPERINTENDENTE', style: 'signatureTitle', alignment: 'center' },
                  { text: 'RESIDENTE DE OBRA', style: 'signatureTitle', alignment: 'center' },
                  { text: 'DIRECTOR', style: 'signatureTitle', alignment: 'center' }
                ],
                [
                  { text: '________________________________', alignment: 'center', margin: [0, 25, 0, 0] },
                  { text: '________________________________', alignment: 'center', margin: [0, 25, 0, 0] },
                  { text: '________________________________', alignment: 'center', margin: [0, 25, 0, 0] }
                ],
                [
                  { text: '', style: 'signatureName', alignment: 'center' },
                  { text: '', style: 'signatureName', alignment: 'center' },
                  { text: '', style: 'signatureName', alignment: 'center' }
                ]
              ]
            },
            layout: 'noBorders'
          }
        ],
        images: {
          logo: logoBase64,
          logo2: logo2Base64,
          ...(watermarkBase64 ? { watermark: watermarkBase64 } : {})
        },
        styles: {
          headerTitle: { fontSize: 14, bold: true, color: '#000000' },
          headerAddress: { fontSize: 9, color: '#333333' },
          reportTitle: { fontSize: 12, bold: true, color: '#cc0000' },
          sectionTitle: { fontSize: 14, bold: true, color: '#333333' },
          signatureTitle: { fontSize: 9, bold: true },
          signatureName: { fontSize: 9 },
          signatureLabel: { fontSize: 8, color: '#666666' }
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      pdf.getBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isLoading = false;
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.isLoading = false;
    }
  }

  private formatDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    try {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = value.split('-').map(Number);
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch {
      return '';
    }
  }

  private formatCurrency(value: number | null | undefined): string {
    if (value == null) return '$0.00';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  }

  closeDetail(): void {
    if (this.context?.componentParent?.collapsePdfDetail) {
      this.context.componentParent.collapsePdfDetail(this.reportData?.id);
    }
  }
}
