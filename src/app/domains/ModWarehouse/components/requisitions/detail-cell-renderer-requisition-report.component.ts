import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { DepartmentsService } from 'app/services/departments.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { MaterialsService } from 'app/services/materials.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detail-cell-renderer-requisition-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-detail-container">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">
          <i class="bi bi-file-earmark-pdf text-danger me-2"></i>
          Reporte: {{ requisitionData?.folio || 'Sin Número' }}
        </h5>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
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
export class DetailCellRendererRequisitionReportComponent {
  private sanitizer = inject(DomSanitizer);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private departmentsService = inject(DepartmentsService);
  private requisitionsService = inject(OcAndReqsService);
  private materialsService = inject(MaterialsService);
  private base64EncodeService = inject(Base64EncodeService);

  private params!: ICellRendererParams;
  requisitionData: any;
  pdfUrl: SafeResourceUrl | null = null;
  isLoading: boolean = true;
  private productos: any[] = [];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.requisitionData = params.data;
    this.generateReport();
  }

  async generateReport() {
    this.isLoading = true;
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      // Obtener datos de la empresa
      const companyData: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));

      // Obtener productos para mapear descripciones
      try {
        this.productos = await lastValueFrom(this.materialsService.getMaterials2Fields(idRoot)) as any[];
      } catch (error) {
        console.warn('No se pudieron cargar los productos:', error);
        this.productos = [];
      }

      // Obtener nombre del departamento
      let departmentName = 'Sin departamento';
      const departmentId = this.requisitionData.idDepartament;
      if (departmentId && departmentId > 0) {
        try {
          const departments: any = await lastValueFrom(this.departmentsService.getDepartments(idRoot));
          const dept = departments.find((d: any) => d.id === departmentId);
          departmentName = dept?.description || 'Sin nombre';
        } catch (error) {
          console.warn('No se pudo cargar el departamento:', error);
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

      // Obtener artículos de la requisición directamente del servicio
      let articulos: any[] = [];
      const requisitionId = this.requisitionData.id;
      if (requisitionId && !requisitionId.toString().startsWith('temp_')) {
        try {
          const items: any = await lastValueFrom(this.requisitionsService.getReqItems(requisitionId));
          // Mapear los items con los nombres de productos
          articulos = items.map((item: any) => {
            const producto = this.productos.find((p: any) => p.id === item.idSupplie);
            return {
              ...item,
              article: producto?.description || 'Sin descripción',
              numArticle: producto?.code || item.idSupplie || ''
            };
          });
        } catch (error) {
          console.warn('No se pudieron cargar los items:', error);
        }
      }

      // Generar el PDF
      const docDefinition = this.buildDocDefinition(companyData, logoBase64, logo2Base64, watermarkBase64, departmentName, articulos);

      const pdfDocGenerator = pdfMake.createPdf(docDefinition as any);
      pdfDocGenerator.getBlob((blob: Blob) => {
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

  private buildDocDefinition(companyData: any, logoBase64: string, logo2Base64: string, watermarkBase64: string | null, departmentName: string, articulos: any[]): any {
    const fechaRequisicion = this.requisitionData.dateCreate ? this.formatDate(this.requisitionData.dateCreate) : '';
    const requisicionNumero = this.requisitionData.folio || 'N/A';
    const solicitante = this.requisitionData.solicit || 'N/A';
    const prioridad = this.requisitionData.priority || 'Normal';
    const tiempoEntrega = this.requisitionData.deliveryTime || 'N/A';

    return {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 80],
      defaultStyle: {
        fontSize: 9
      },
      // Marca de agua con logo (picture3) - estándar igual que egresos-palacio
      background: watermarkBase64 ? [
        {
          image: 'watermark',
          width: 400,
          opacity: 0.15,
          absolutePosition: { x: 106, y: 250 }
        }
      ] : [],
      content: [
        // Header con logos - estándar egresos-palacio
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
                  image: 'logo2',
                  width: 80,
                  alignment: 'right',
                  margin: [0, 0, 0, 5]
                },
                {
                  text: 'REQUISICIÓN DE MATERIALES',
                  style: 'documentTitle',
                  alignment: 'right'
                },
                {
                  text: `No. ${requisicionNumero}`,
                  style: 'documentNumber',
                  alignment: 'right',
                  margin: [0, 5, 0, 0]
                },
                {
                  text: `Fecha: ${fechaRequisicion}`,
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
        // Título de sección
        {
          text: 'DETALLES DE LA REQUISICIÓN',
          style: 'sectionTitle',
          margin: [0, 10, 0, 10]
        },

        // MAESTRO: Datos principales - estándar egresos-palacio
        {
          table: {
            widths: ['25%', '75%'],
            body: [
              [
                { text: 'SOLICITANTE:', style: 'masterLabel' },
                { text: solicitante, style: 'masterValue' }
              ],
              [
                { text: 'DEPARTAMENTO:', style: 'masterLabel' },
                { text: departmentName, style: 'masterValue' }
              ],
              [
                { text: 'PRIORIDAD:', style: 'masterLabel' },
                { text: prioridad, style: 'masterValue' }
              ],
              [
                { text: 'TIEMPO ENTREGA:', style: 'masterLabel' },
                { text: tiempoEntrega, style: 'masterValue' }
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

        // DETALLE: Artículos
        {
          text: 'MATERIALES SOLICITADOS',
          fontSize: 11,
          bold: true,
          color: '#198754',
          margin: [0, 0, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['5%', '15%', '40%', '10%', '15%', '15%'],
            body: [
              [
                { text: '#', style: 'tableHeader', alignment: 'center' },
                { text: 'CÓDIGO', style: 'tableHeader', alignment: 'center' },
                { text: 'DESCRIPCIÓN', style: 'tableHeader' },
                { text: 'CANT.', style: 'tableHeader', alignment: 'center' },
                { text: 'FECHA USO', style: 'tableHeader', alignment: 'center' },
                { text: 'COMENTARIO', style: 'tableHeader', alignment: 'center' }
              ],
              ...(articulos.length > 0
                ? articulos.map((item: any, index: number) => [
                    { text: (index + 1).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.numArticle || item.code || '', alignment: 'center', fontSize: 7 },
                    { text: item.article || item.description || '', fontSize: 7 },
                    { text: (item.quantity || 0).toString(), alignment: 'center', fontSize: 7 },
                    { text: item.dateuse ? item.dateuse.split('T')[0] : '', alignment: 'center', fontSize: 7 },
                    { text: item.comment || '', fontSize: 7 }
                  ])
                : [[{ text: 'No hay materiales en esta requisición', colSpan: 6, alignment: 'center', color: '#666', italics: true, fontSize: 7 }, {}, {}, {}, {}, {}]]
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
                    { text: 'Total Items:', bold: true, fillColor: '#e8f5e9' },
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
        sectionTitle: {
          fontSize: 11,
          bold: true,
          color: '#333333'
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
