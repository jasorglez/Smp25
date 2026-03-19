import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { DepartmentsService } from 'app/services/departments.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProjectsService } from 'app/services/projects.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

const HEADER_BLUE = '#2F75B6';
const LABEL_BLUE = '#D9E1F2';
const MIN_ITEM_ROWS = 16;

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
      <div class="report-content" style="height: 1200px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
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
  private catalogsService = inject(CatalogsService);
  private projectsService = inject(ProjectsService);
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

      const companyData: any = await lastValueFrom(this.rootService.getRootbyId(idRoot));

      try {
        this.productos = await lastValueFrom(this.materialsService.getMaterials2Fields(idRoot)) as any[];
      } catch (error) {
        console.warn('No se pudieron cargar los productos:', error);
        this.productos = [];
      }

      // Unidades de medida
      let measures: any[] = [];
      try {
        measures = await lastValueFrom(this.catalogsService.getMeasures()) as any[];
      } catch (error) {
        console.warn('No se pudieron cargar las unidades:', error);
      }

      // Nombre del departamento
      let departmentName = '';
      const departmentId = this.requisitionData.idDepartament;
      if (departmentId && departmentId > 0) {
        try {
          const departments: any = await lastValueFrom(this.departmentsService.getDepartments(idRoot));
          const dept = departments.find((d: any) => d.id === departmentId);
          departmentName = dept?.description || '';
        } catch (error) {
          console.warn('No se pudo cargar el departamento:', error);
        }
      }

      // Nombre del proyecto/contrato
      let projectName = '';
      const typeRef = this.requisitionData.type_reference || this.requisitionData.typeReference;
      const idRef = this.requisitionData.id_reference || this.requisitionData.idReference;
      if (typeRef === 'project' && idRef) {
        try {
          const project: any = await lastValueFrom(this.projectsService.getProjectsById(idRef));
          projectName = project?.description || project?.name || '';
        } catch (error) {
          console.warn('No se pudo cargar el proyecto:', error);
        }
      }

      const logoBase64 = companyData?.picture
        ? await this.base64EncodeService.convertImageToBase64(companyData.picture)
        : '';

      const watermarkBase64 = companyData?.picture3
        ? await this.base64EncodeService.convertImageToBase64(companyData.picture3)
        : null;

      // Artículos de la requisición
      let articulos: any[] = [];
      const requisitionId = this.requisitionData.id;
      if (requisitionId && !requisitionId.toString().startsWith('temp_')) {
        try {
          const items: any = await lastValueFrom(this.requisitionsService.getReqItems(requisitionId));
          articulos = items.map((item: any) => {
            const producto = this.productos.find((p: any) => p.id === item.idSupplie);
            const measure = measures.find((m: any) => m.id === (producto?.idMedida || item.idMedida));
            return {
              ...item,
              article: producto?.description || item.namearticle || '',
              numArticle: producto?.articulo || producto?.code || item.numarticle || '',
              unit: measure?.description || producto?.measure || ''
            };
          });
        } catch (error) {
          console.warn('No se pudieron cargar los items:', error);
        }
      }

      const docDefinition = this.buildDocDefinition(
        companyData, logoBase64, watermarkBase64,
        departmentName, articulos, projectName
      );

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
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch {
      return '';
    }
  }

  private buildDocDefinition(
    companyData: any,
    logoBase64: string,
    watermarkBase64: string | null,
    departmentName: string,
    articulos: any[],
    projectName: string
  ): any {
    const fechaRequisicion = this.formatDate(this.requisitionData.dateCreate || this.requisitionData.datecreate);
    const folio = this.requisitionData.folio || '';
    const solicitante = this.requisitionData.solicit || '';
    const ciudad = this.requisitionData.city || '';
    const lugarYFecha = [ciudad, fechaRequisicion].filter(Boolean).join(', ');
    const observaciones = this.requisitionData.comments || '';
    const referencia = this.requisitionData.conditions || '';

    // Fill item rows to minimum
    const itemRows: any[] = [...articulos];
    while (itemRows.length < MIN_ITEM_ROWS) {
      itemRows.push({ _empty: true });
    }

    const tableBody = [
      // Header row
      [
        { text: 'PARTIDA', style: 'tableHeader' },
        { text: 'CODIGO', style: 'tableHeader' },
        { text: 'DESCRIPCION', style: 'tableHeader' },
        { text: 'CANTIDAD', style: 'tableHeader' },
        { text: 'UNIDAD', style: 'tableHeader' },
        { text: 'FECHA DE SUMINISTRO', style: 'tableHeader' },
        { text: 'Especificaciones', style: 'tableHeader' }
      ],
      ...itemRows.map((item: any, index: number) => {
        if (item._empty) {
          return [
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' }
          ];
        }
        return [
          { text: (index + 1).toString(), style: 'tableCell', alignment: 'center' },
          { text: item.numArticle || '', style: 'tableCell', alignment: 'center' },
          { text: item.article || '', style: 'tableCell' },
          { text: item.quantity != null ? item.quantity.toString() : '', style: 'tableCell', alignment: 'center' },
          { text: item.unit || '', style: 'tableCell', alignment: 'center' },
          { text: item.dateuse ? item.dateuse.split('T')[0] : '', style: 'tableCell', alignment: 'center' },
          { text: item.comment || '', style: 'tableCell' }
        ];
      }),
      // OBSERVACIONES row
      [
        { text: 'OBSERVACIONES', style: 'obsLabel', fillColor: LABEL_BLUE, colSpan: 2 },
        {},
        { text: observaciones, style: 'tableCell', colSpan: 5 },
        {}, {}, {}, {}
      ]
    ];

    const images: any = {};
    if (logoBase64) images['logo'] = logoBase64;
    if (watermarkBase64) images['watermark'] = watermarkBase64;

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 40],
      defaultStyle: { fontSize: 9 },

      background: watermarkBase64 ? [{
        image: 'watermark',
        width: 500,
        opacity: 0.12,
        absolutePosition: { x: 120, y: 180 }
      }] : [],

      content: [
        // ── HEADER ──────────────────────────────────────────────────────
        {
          table: {
            widths: [110, '*', 180],
            body: [
              [
                logoBase64
                  ? { image: 'logo', width: 100, rowSpan: 3, alignment: 'center', margin: [0, 4, 0, 4] }
                  : { text: companyData?.name || '', rowSpan: 3, alignment: 'center', bold: true, margin: [0, 20, 0, 0] },
                { text: 'REQUISICION', style: 'mainTitle', colSpan: 2, alignment: 'center', margin: [0, 8, 0, 8] },
                {}
              ],
              [
                {},
                { text: 'HCO-ADM-FO-001', alignment: 'center', bold: true, fontSize: 9, fillColor: LABEL_BLUE },
                { text: 'REV.01', alignment: 'center', bold: true, fontSize: 9, fillColor: LABEL_BLUE }
              ],
              [
                {},
                {
                  text: companyData?.name || '',
                  colSpan: 2,
                  alignment: 'center',
                  bold: true,
                  fontSize: 10,
                  fillColor: HEADER_BLUE,
                  color: 'white',
                  margin: [0, 4, 0, 4]
                },
                {}
              ]
            ]
          },
          layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#555', vLineColor: () => '#555' },
          margin: [0, 0, 0, 0]
        },

        // ── INFO ─────────────────────────────────────────────────────────
        {
          table: {
            widths: ['18%', '32%', '13%', '37%'],
            body: [
              [
                { text: 'LUGAR Y FECHA:', style: 'infoLabel', fillColor: LABEL_BLUE },
                { text: lugarYFecha, style: 'infoValue' },
                { text: 'FOLIO:', style: 'infoLabel', fillColor: LABEL_BLUE },
                { text: folio, style: 'infoValue' }
              ],
              [
                { text: 'GERENCIA SOLICITANTE:', style: 'infoLabel', fillColor: LABEL_BLUE },
                { text: solicitante, style: 'infoValue' },
                { text: 'AREA :', style: 'infoLabel', fillColor: LABEL_BLUE },
                { text: departmentName, style: 'infoValue' }
              ],
              [
                { text: 'CONTRATO/PROYECTO:', style: 'infoLabel', fillColor: LABEL_BLUE },
                { text: projectName, style: 'infoValue' },
                { text: 'Ref:', style: 'infoLabel', fillColor: LABEL_BLUE },
                { text: referencia, style: 'infoValue' }
              ]
            ]
          },
          layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#555', vLineColor: () => '#555' },
          margin: [0, 0, 0, 0]
        },

        // ── TABLA DE ARTÍCULOS + OBSERVACIONES ───────────────────────────
        {
          table: {
            headerRows: 1,
            widths: [35, 75, '*', 48, 48, 78, 95],
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? HEADER_BLUE : null,
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#555',
            vLineColor: () => '#555'
          },
          margin: [0, 0, 0, 6]
        },

        // ── NOTA FINAL ───────────────────────────────────────────────────
        {
          text: 'Tratándose de equipos de cómputo/drones, se deberá adjuntar el Formato HCO-ADM-FO-022 para solicitud de equipos con las características y software requerido, así como los detalles de uso para valorar características requeridas.',
          fontSize: 7,
          italics: true,
          margin: [0, 2, 0, 0]
        }
      ],

      styles: {
        mainTitle: {
          fontSize: 18,
          bold: true,
          color: '#000000'
        },
        infoLabel: {
          bold: true,
          fontSize: 8,
          margin: [2, 3, 2, 3]
        },
        infoValue: {
          fontSize: 8,
          margin: [2, 3, 2, 3]
        },
        tableHeader: {
          bold: true,
          fontSize: 8,
          color: 'white',
          alignment: 'center',
          fillColor: HEADER_BLUE,
          margin: [2, 3, 2, 3]
        },
        tableCell: {
          fontSize: 7,
          margin: [2, 2, 2, 2]
        },
        obsLabel: {
          bold: true,
          fontSize: 8,
          margin: [2, 3, 2, 3]
        }
      },

      images,

      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-MX')}`, fontSize: 7, color: '#666', margin: [30, 0, 0, 0] },
          { text: `Página ${currentPage} de ${pageCount}`, fontSize: 7, color: '#666', alignment: 'right', margin: [0, 0, 30, 0] }
        ],
        margin: [0, 15, 0, 0]
      })
    };
  }

  closeReport() {
    if (this.params.context?.componentParent?.collapseReportDetail) {
      this.params.context.componentParent.collapseReportDetail();
    }
  }
}
