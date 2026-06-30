//soriano develop

import { Component, OnInit, inject, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ICellEditorParams, ICellEditorComp } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { CustomersService } from 'app/services/customers.service';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';
import { ProviderModalService } from './services/provider-modal.service';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
import { TrackingService } from 'app/services/tracking.service';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detalles-egresospalacios',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, SearchableSelectComponent, SelectWithTooltipEditorV2Component],
  template: `
    <!-- Concepts Grid View -->
    <div class="detail-grid-container" *ngIf="detailType === 'concepts'">
      <div class="detail-actions d-flex justify-content-between align-items-center mb-2">
        <div class="totals-display">
          <span class="badge bg-secondary me-2">Subtotal: {{ subtotal | currency:'MXN' }}</span>
          <span class="badge bg-info me-2">IVA: {{ iva2 | currency:'MXN' }}</span>
          <span class="badge bg-warning me-2">ISR: {{ isr | currency:'MXN' }}</span>
          <span class="badge bg-primary">Total: {{ total | currency:'MXN' }}</span>
        </div>
        <div class="d-flex" *ngIf="!invited">
          <button class="btn btn-outline-secondary btn-sm me-2" (click)="closeDetail()">
            <i class="bi bi-x-lg"></i> Cerrar
          </button>
          <button class="btn btn-primary btn-sm me-2" (click)="addConcept()">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
            <i class="bi bi-arrow-counterclockwise"></i> Deshacer
          </button>
          <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedConcept()">
            <i class="bi bi-trash"></i> Eliminar
          </button>
          <button class="btn btn-info btn-sm me-2" (click)="printDocumentosReport()" [disabled]="isUploading || documentosData.length === 0">
            <i class="bi bi-printer"></i> Imprimir
          </button>
          <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
        </div>
      </div>
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        [components]="components"
        style="height: 480px; width: 100%;">
      </ag-grid-angular>
    </div>

    <!-- PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'report'">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Vista Previa del Recibo - Documento: {{ expenditureData?.numberDocument || 'Sin Número' }}</h5>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="report-content" style="height: 480px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              El formato de PDF se configurará próximamente.
              <br>
              <small class="text-muted">Por favor, proporcione el formato con los logos de la empresa.</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Catalog PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'catalogReport'">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Catálogo de Gasto - Documento: {{ expenditureData?.numberDocument || 'Sin Número' }}</h5>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="report-content" style="height: 480px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              El formato de PDF se configurará próximamente.
              <br>
              <small class="text-muted">Por favor, proporcione el formato con los logos de la empresa.</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Documentos Comprobados View -->
    <div class="detail-grid-container" *ngIf="detailType === 'comprobacion'" >
      <div class="detail-actions mb-2">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Documentos Comprobados</h6>
          <div *ngIf="isUploading" class="progress" style="width: 200px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" [style.width.%]="uploadProgress" [attr.aria-valuenow]="uploadProgress" aria-valuemin="0" aria-valuemax="100">
              {{uploadProgress | number:'1.0-0'}}%
            </div>
          </div>
        </div>
        <div class="d-flex" *ngIf="!invited">
          <button class="btn btn-outline-secondary btn-sm me-2" (click)="closeDetail()">
            <i class="bi bi-x-lg"></i> Cerrar
          </button>
          <button class="btn btn-success btn-sm me-2" (click)="addDocumento()">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-warning btn-sm me-2" (click)="discardDocumentosChanges()">
            <i class="bi bi-arrow-counterclockwise"></i> Deshacer
          </button>
          <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedDocumento()">
            <i class="bi bi-trash"></i> Eliminar
          </button>
          <button class="btn btn-info btn-sm me-2" (click)="printDocumentosReport()" [disabled]="isUploading || documentosData.length === 0">
            <i class="bi bi-printer"></i> Imprimir
          </button>
          <button class="btn btn-primary btn-sm position-relative" (click)="saveDocumentosChanges()" [disabled]="isUploading || !canSaveDocumentos">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedDocumentosChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
        </div>
      </div>
      <ag-grid-angular
        #agGridDocumentos
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="documentosData"
        [columnDefs]="colDefsComprobacion"
        [gridOptions]="gridOptionsComprobacion"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onDocumentosGridReady($event)"
        (cellValueChanged)="onDocumentoCellValueChanged($event)"
        style="height: 480px; width: 100%;">
      </ag-grid-angular>
    </div>

    <!-- Preview Modal -->
    <div class="modal fade show" *ngIf="showPreviewModal"
         style="display: block; background-color: rgba(0,0,0,0.5);"
         (click)="closePreviewModal()">
      <div class="modal-dialog modal-xl modal-dialog-centered" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-eye me-2"></i>
              Vista Previa: {{ previewFileName }}
            </h5>
            <button type="button" class="btn-close" (click)="closePreviewModal()"></button>
          </div>
          <div class="modal-body" style="height: 70vh;">
            <!-- PDF Preview -->
            <iframe *ngIf="previewFileType === 'PDF' && previewFileUrl"
                    [src]="previewFileUrl"
                    style="width: 100%; height: 100%; border: none;">
            </iframe>

            <!-- JPG/Image Preview -->
            <div *ngIf="previewFileType === 'JPG' && previewFileUrl"
                 class="d-flex justify-content-center align-items-center h-100"
                 style="overflow: auto;">
              <img [src]="previewFileUrl"
                   class="img-fluid"
                   style="max-width: 100%; max-height: 100%; object-fit: contain;"
                   alt="{{ previewFileName }}">
            </div>

            <!-- XML Preview -->
            <div *ngIf="previewFileType === 'XML'"
                 class="h-100"
                 style="overflow: auto;">
              <pre class="bg-light p-3 rounded" style="height: 100%; overflow: auto;">
                <code>{{ previewFileRawUrl }}</code>
              </pre>
            </div>
          </div>
          <div class="modal-footer">
            <a [href]="previewFileRawUrl"
               download="{{ previewFileName }}"
               target="_blank"
               class="btn btn-success">
              <i class="bi bi-download me-2"></i>Descargar
            </a>
            <button type="button" class="btn btn-secondary" (click)="closePreviewModal()">
              <i class="bi bi-x-lg me-2"></i>Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
    .totals-display {
      font-size: 0.95rem;
    }
    .report-detail-container {
      padding: 15px;
      background-color: #ffffff;
    }
  `]
})
export class DetallesEgresospalaciosComponent implements OnInit, OnDestroy {
  private trackingService = inject(TrackingService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private gridApiDocumentos!: GridApi;
  private context: any;
  private sanitizer = inject(DomSanitizer);
  private signalsService = inject(SignalsService);
  private customersService = inject(CustomersService);
  private employeesService = inject(EmployeesService);
  private providerModalService = inject(ProviderModalService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  measures: any[] = [];
  objetosImpuesto: any[] = [];
  invited: boolean = false;
  ivaPercent: number = 0;
  objetosGastoHijos: any[] = []; // Objetos de gasto nivel 4 (hijos del objeto de gasto seleccionado nivel 1)
  objetosGastoNivel1: any[] = []; // Objetos de gasto nivel 1 (para agrupar en reporte)
  setupManagementInfo: any = null; // Información de firmas
  lastSelectedIdCatIng: number = 0; // Para copiar el último objeto de gasto seleccionado
  providers: any[] = []; // Proveedores para el combo box
  loadedTypeComps: any[] = []; // Tipos de comprobante cargados (para evitar recargarlos)

  // Información de grupos para paginación dinámica (Hoja X de Y por grupo)
  gruposParaPaginacion: Array<{
    codigoNivel1: string;
    nombreGrupo: string;
    numConceptos: number;
  }> = [];

  // Totals
  subtotal: number = 0;
  iva2: number = 0;
  isr: number = 0;
  total: number = 0;

  // Report properties
  detailType: string = 'concepts';
  expenditureData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  // Documentos Comprobados properties
  documentosData: any[] = [];
  hasUnsavedDocumentosChanges: boolean = false;
  tempDocumentoIdCounter: number = 0;

  // Preview Modal properties
  showPreviewModal: boolean = false;
  previewFileUrl: SafeResourceUrl | null = null;
  previewFileName: string = '';
  previewFileType: string = '';
  previewFileRawUrl: string = '';

  // Upload progress properties
  isUploading: boolean = false;
  uploadProgress: number = 0;

  // Getter to check if save button should be enabled
  get canSaveDocumentos(): boolean {
    return this.documentosData.length > 0 && this.documentosData.every(doc =>
      doc.nombreArchivo || (doc.uuidCfdi && doc.uuidCfdi.trim() !== '')
    );
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Initial load will happen in agInit

    // Suscribirse a la confirmación de guardado del modal de proveedor
    this.providerModalService.saveConfirmed$.subscribe((providerData) => {
      this.onProviderCreated(providerData);
    });
    //this.loadMeasures();  
  }

  async agInit(params: ICellRendererParams): Promise<void> {
    this.params = params;
    this.context = params.context;
    this.expenditureData = params.data;
    this.detailType = params.data.detailType || 'concepts';
    this.invited = this.signalsService.getInvited()();
    if (this.detailType === 'concepts') {
      this.getBillingManagementInfo();
      await this.loadObjetosGastoHijos(); // Esperar a que cargue los objetos de gasto nivel 4
      this.loadConceptsData();
    } else if (this.detailType === 'report' || this.detailType === 'catalogReport') {
      this.loadConceptsDataForReport();
    } else if (this.detailType === 'comprobacion') {
      await this.loadProviders(); // Esperar a que cargue proveedores para el combo box
      this.loadDocumentosComprobados();
    }
  }

  loadConceptsData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      console.log('🔵 DETALLE: Cargando conceptos para egreso ID:', expenditureId);
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        console.log(`📊 DETALLE: Conceptos recibidos para ID ${expenditureId}:`, data.length);
        this.rowData = data.map(concept => ({
          ...concept,
          __isNew: false,
          __modified: false,
          ivaManuallyEdited: concept.ivaManuallyEdited || false // Preservar bandera de edición manual
        }));
        // Calculate totalFinal for each concept
        this.rowData.forEach(concept => {
          concept.aplicaIsr = concept.aplicaIsr !== undefined ? concept.aplicaIsr : false;
          concept.totalFinal = (concept.total || 0) + (concept.iva2 || 0) - (concept.isr || 0);
        });
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        // Update the count in master grid
        if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
          console.log(`🔄 DETALLE: Actualizando contador en maestro. ID: ${expenditureId}, Count: ${this.rowData.length}`);
          this.context.CONCEPTS.updateCount(expenditureId, this.rowData.length);
        }
        // Recalcular totales
        this.recalculateTotals();
      });
    }
  }

  async loadConceptsDataForReport() {
    // Cargar información de firmas
    await this.loadSetupManagementInfo();

    // Si el checkbox "Mostrar Todos" está activo, cargar objetos de nivel 1 y nivel 4 para agrupar
    if (this.expenditureData?.mostrartodo === true) {
      await this.loadObjetosNivel1();
      await this.loadObjetosNivel4ParaReporte();
    }

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        this.rowData = data;
        // Calculate totalFinal for each concept
        this.rowData.forEach(concept => {
          concept.aplicaIsr = concept.aplicaIsr !== undefined ? concept.aplicaIsr : false;
          concept.totalFinal = (concept.total || 0) + (concept.iva2 || 0) - (concept.isr || 0);
        });
        // Calculate totals for report (without updating master)
        this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
        this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
        this.isr = this.rowData.reduce((acc, row) => acc + (Number(row.isr) || 0), 0);
        this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
        // Generate report after data is loaded
        this.generateReport();
      });
    } else {
      // If no data loader available, show empty state
      this.generateReport();
    }
  }

  async loadSetupManagementInfo() {
    if (this.context?.administrationService && this.context?.idRoot) {
      try {
        this.setupManagementInfo = await lastValueFrom(
          this.context.administrationService.getSetupManagementInfo(this.context.idRoot)
        );
        // El endpoint devuelve un array, tomar el primer elemento
        if (Array.isArray(this.setupManagementInfo) && this.setupManagementInfo.length > 0) {
          this.setupManagementInfo = this.setupManagementInfo[0];
        }
      } catch (error) {
        console.error('Error loading setup management info:', error);
        this.setupManagementInfo = null;
      }
    }
  }

  async loadObjetosNivel1() {
    if (this.context?.administrationService && this.context?.idRoot) {
      try {
        console.log('🔵 Cargando objetos de nivel 1 para reporte agrupado...');
        const data: any = await lastValueFrom(
          this.context.administrationService.getByNivelObjeto(this.context.idRoot, 1)
        );
        this.objetosGastoNivel1 = (data || []).map((obj: any) => ({
          id: obj.id,
          codigo: obj.codigo,
          nombre: obj.nombre,
          codigoNombre: `${obj.codigo} - ${obj.nombre}`
        }));
        console.log('✅ Objetos nivel 1 cargados:', this.objetosGastoNivel1.length);
      } catch (error) {
        console.error('❌ Error loading objetos nivel 1:', error);
        this.objetosGastoNivel1 = [];
      }
    }
  }

  async loadObjetosNivel4ParaReporte() {
    if (this.context?.administrationService && this.context?.idRoot) {
      try {
        console.log('🔵 Cargando objetos de nivel 4 para mapeo en reporte...');
        const data: any = await lastValueFrom(
          this.context.administrationService.getByNivelObjeto(this.context.idRoot, 4)
        );
        this.objetosGastoHijos = (data || []).map((obj: any) => ({
          id: obj.id,
          codigo: obj.codigo,
          nombre: obj.nombre,
          codigoNombre: `${obj.codigo} - ${obj.nombre}`
        }));
        console.log('✅ Objetos nivel 4 cargados para reporte:', this.objetosGastoHijos.length);
      } catch (error) {
        console.error('❌ Error loading objetos nivel 4:', error);
        this.objetosGastoHijos = [];
      }
    }
  }

  loadMeasures() {
    if (this.context && this.context.catalogsService && this.context.idRoot) {
      this.context.catalogsService.getCatalogs(this.context.idRoot, 'MEASURE').subscribe({
        next: (data: any[]) => {
          this.measures = data || [];
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
        },
        error: (error) => {
          console.error('Error loading measures:', error);
          this.measures = [];
        }
      });
    }
  }

  getBillingManagementInfo() {
    if (this.context && this.context.administrationService && this.context.idRoot) {
      this.context.administrationService.getBillingManagementInfo(this.context.idRoot).subscribe({
        next: (data: any) => {
          this.ivaPercent = data && data[0]?.iIva ? data[0].iIva : 0;
        },
        error: (error) => {
          console.error('Error al obtener la información de facturación:', error);
          this.ivaPercent = 0;
        }
      });
    }
  }

  async loadObjetosGastoHijos(): Promise<void> {
    if (!this.context || !this.context.administrationService) {
      console.warn('No se puede cargar objetos de gasto: falta administrationService');
      this.objetosGastoHijos = [];
      return Promise.resolve();
    }

    // Verificar si el checkbox "Mostrar Todos" está activado
    const mostrarTodos = this.expenditureData?.mostrartodo === true;

    if (mostrarTodos) {
      // ✅ Checkbox ACTIVO → Mostrar TODOS los objetos de nivel 4
      console.log('🔵 DETALLE: Checkbox ACTIVO - Cargando TODOS los objetos de nivel 4');
      return new Promise<void>((resolve) => {
        this.context.administrationService.getByNivelObjeto(this.context.idRoot, 4).subscribe({
          next: (data: any[]) => {
            // Formatear resultado: crear codigoNombre desde codigo + " - " + nombre
            this.objetosGastoHijos = (data || []).map(obj => ({
              id: obj.id,
              codigoNombre: `${obj.codigo} - ${obj.nombre}`,
              displayText: `${obj.codigo} - ${obj.nombre}`
            }));

            console.log('✅ DETALLE: Todos los objetos de nivel 4 cargados:', this.objetosGastoHijos.length);
            // Actualizar las columnas del grid con los nuevos valores
            this.refreshConceptsColumnDefinitions();
            resolve();
          },
          error: (error) => {
            console.error('❌ DETALLE: Error loading todos los objetos nivel 4:', error);
            this.objetosGastoHijos = [];
            resolve();
          }
        });
      });
    } else {
      // ✅ Checkbox INACTIVO → Mostrar solo objetos CONDICIONADOS (hijos del objeto específico)
      const objetoGastoCodigo = this.expenditureData?.objetoGastoCodigo;

      if (!objetoGastoCodigo) {
        console.warn('No se puede cargar objetos condicionados: falta objetoGastoCodigo');
        this.objetosGastoHijos = [];
        return Promise.resolve();
      }

      console.log('🔵 DETALLE: Checkbox INACTIVO - Cargando objetos CONDICIONADOS del objeto:', objetoGastoCodigo);
      // Usar getEspecifica para obtener solo los hijos del objeto específico
      return new Promise<void>((resolve) => {
        this.context.administrationService.getEspecifica(this.context.idRoot, objetoGastoCodigo).subscribe({
          next: (data: any[]) => {
            // Formatear resultado: ya viene con codigoNombre
            this.objetosGastoHijos = (data || []).map(obj => ({
              id: obj.id,
              codigoNombre: obj.codigoNombre,
              displayText: obj.codigoNombre
            }));

            console.log('✅ DETALLE: Objetos condicionados cargados:', this.objetosGastoHijos.length);
            // Actualizar las columnas del grid con los nuevos valores
            this.refreshConceptsColumnDefinitions();
            resolve();
          },
          error: (error) => {
            console.error('❌ DETALLE: Error loading objetos condicionados:', error);
            this.objetosGastoHijos = [];
            resolve();
          }
        });
      });
    }
  }

  async loadProviders() {
    // Obtener idRoot del contexto o del signalsService
    const idRoot = this.context?.idRoot 

    if (!idRoot) {
      console.warn('No se puede cargar proveedores/empleados: falta idRoot');
      this.providers = [];
      return;
    }

    // Si typeComps no está cargado en el contexto, cargarlo ahora
    let typeComps = this.context?.typeComps || [];
    if (!typeComps || typeComps.length === 0) {
      // Verificar si ya los cargamos antes
      if (this.loadedTypeComps && this.loadedTypeComps.length > 0) {
        typeComps = this.loadedTypeComps;
      } else {
        try {
          typeComps = await lastValueFrom(
            this.context.catalogadmonService.getCatalogs(idRoot, 'TYPECOMP')
          );
          this.loadedTypeComps = typeComps; // Guardar para reutilizar
        } catch (error) {
          console.error('Error cargando typeComps:', error);
          typeComps = [];
        }
      }
    } else {
      // Si vienen del contexto, guardarlos también
      this.loadedTypeComps = typeComps;
    }

    // Determinar si el tipo de comprobante es "Empleados"
    const isEmpleadosType = this.isEmpleadosComprobanteWithTypeComps(typeComps);

    console.log('🔵 DETALLE: Tipo de comprobante es Empleados?', isEmpleadosType);

    if (isEmpleadosType) {
      // Cargar empleados cuando el tipo de comprobante es "Empleados"
      const idBranch = this.context?.componentParent?.idBranch;
      const idBranchNegative = -Math.abs(idBranch); // Valor negativo del idBranch

      return new Promise<void>((resolve) => {
        this.employeesService.getEmployees(idBranchNegative).subscribe({
          next: (data: any[]) => {
            // Mapear los empleados con name
            this.providers = (data || []).map(employee => ({
              id: employee.id,
              displayText: employee.name || 'Sin nombre'
            }));

            console.log('✅ DETALLE: Empleados cargados:', this.providers.length);
            // Actualizar las columnas del grid con los nuevos valores
            this.refreshDocumentosColumnDefinitions();
            resolve();
          },
          error: (error) => {
            console.error('❌ DETALLE: Error loading employees:', error);
            this.providers = [];
            resolve();
          }
        });
      });
    } else {
      // Cargar proveedores (comportamiento original)
      return new Promise<void>((resolve) => {
        this.customersService.getCustomersByCompany(idRoot, 'PROVIDERS').subscribe({
          next: (data: any[]) => {
            // Mapear los proveedores solo con name (company)
            this.providers = (data || []).map(provider => ({
              id: provider.id,
              displayText: provider.name || 'Sin nombre'
            }));

            console.log('✅ DETALLE: Proveedores cargados:', this.providers.length);
            // Actualizar las columnas del grid con los nuevos valores
            this.refreshDocumentosColumnDefinitions();
            resolve();
          },
          error: (error) => {
            console.error('❌ DETALLE: Error loading providers:', error);
            this.providers = [];
            resolve();
          }
        });
      });
    }
  }

  /**
   * Determina si el tipo de comprobante del registro maestro es "Empleados"
   * Usa typeComps cargados o del contexto si está disponible
   */
  private isEmpleadosComprobante(): boolean {
    // Priorizar loadedTypeComps sobre context.typeComps
    const typeComps = this.loadedTypeComps.length > 0
      ? this.loadedTypeComps
      : (this.context?.typeComps || []);
    return this.isEmpleadosComprobanteWithTypeComps(typeComps);
  }

  /**
   * Determina si el tipo de comprobante del registro maestro es "Empleados"
   * Recibe el array de typeComps como parámetro
   */
  private isEmpleadosComprobanteWithTypeComps(typeComps: any[]): boolean {
    if (!this.expenditureData?.idTypeComp) {
      return false;
    }

    // Buscar el tipo de comprobante seleccionado
    const selectedTypeComp = typeComps.find((tc: any) => tc.id === this.expenditureData.idTypeComp);

    if (selectedTypeComp) {
      const description = selectedTypeComp.description || '';
      const descriptionLower = description.toLowerCase().trim();

      // Verificar si la descripción es "Empleados" (case-insensitive, trimmed)
      return descriptionLower === 'empleados';
    }

    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }

  // Método para refrescar las definiciones de columnas de conceptos (invalidar cache)
  private refreshConceptsColumnDefinitions() {
    console.log('🔄 DETALLE: Refrescando columnas de conceptos. Objetos disponibles:', this.objetosGastoHijos.length);
    this._colDefs = []; // Invalidar cache
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs); // Forzar actualización
      console.log('✅ DETALLE: Columnas de conceptos actualizadas en el grid');
    } else {
      console.log('⚠️ DETALLE: Grid API de conceptos no disponible aún');
    }
  }

  // Método para refrescar las definiciones de columnas de documentos (invalidar cache)
  private refreshDocumentosColumnDefinitions() {
    console.log('🔄 DETALLE: Refrescando columnas de documentos. Proveedores/Empleados disponibles:', this.providers.length);
    this._colDefsComprobacion = []; // Invalidar cache
    if (this.gridApiDocumentos) {
      this.gridApiDocumentos.setGridOption('columnDefs', this.colDefsComprobacion); // Forzar actualización
      console.log('✅ DETALLE: Columnas de documentos actualizadas en el grid');
    } else {
      console.log('⚠️ DETALLE: Grid API de documentos no disponible aún');
    }
  }

  // Cache para las definiciones de columnas de conceptos
  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    // Si ya fue inicializado, retornar la misma instancia (evita parpadeo)
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

    // Inicializar una sola vez
    this._colDefs = [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'dateExpend',
        headerName: 'Fecha',
        editable: true,
        cellDataType: 'date',
        width: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        type: 'number',
        hide: true,
        editable: true,
        width: 90
      },
      {
        field: 'idExpense',
        headerName: 'Catálogo Gasto',
        editable: true,
        width: 200,
        tooltipValueGetter: (params: any) => {
          if (!params.data?.idExpense) return '';
          const expensesCatalogLevel3 = this.context?.componentParent?.expensesCatalogLevel3 || [];
          const found = expensesCatalogLevel3.find((obj: any) => obj.id === params.data.idExpense);
          return found ? found.description : '';
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => {
          // Obtener el catálogo nivel 3 desde el componentParent (no del contexto estático)
          const expensesCatalogLevel3 = this.context?.componentParent?.expensesCatalogLevel3 || [];
          // Obtener el idExpendxcategr del maestro (padre) - this.params.data es la fila del MAESTRO
          const idExpendxcategr = this.params?.data?.idExpendxcategr || 0;
          // Obtener si "Mostrar Todo" está activado
          const mostrarTodo = this.params?.data?.mostrartodo || false;

          console.log('🔍 DETALLE - Filtro Catálogo Gasto:');
          console.log('   📌 idExpendxcategr del maestro:', idExpendxcategr);
          console.log('   📌 mostrartodo:', mostrarTodo);
          console.log('   📌 Total catálogo nivel 3:', expensesCatalogLevel3.length);

          // Filtrar opciones: si mostrarTodo es true, mostrar todos; si no, filtrar por parentId
          let filteredOptions = expensesCatalogLevel3;
          if (!mostrarTodo && idExpendxcategr > 0) {
            // Buscar items donde parentId coincida
            filteredOptions = expensesCatalogLevel3.filter((obj: any) => obj.parentId === idExpendxcategr);
            console.log('   📌 Filtrados por parentId=' + idExpendxcategr + ':', filteredOptions.length);

            // Si no encontró nada, mostrar algunos parentIds disponibles para debug
            if (filteredOptions.length === 0) {
              const parentIds = [...new Set(expensesCatalogLevel3.map((obj: any) => obj.parentId))];
              console.log('   ⚠️ parentIds disponibles en catálogo:', parentIds.slice(0, 10));
            }
          }

          return {
            values: filteredOptions.map((obj: any) => obj.description)
          };
        },
        valueGetter: (params: any) => {
          if (!params.data?.idExpense) return '';
          const expensesCatalogLevel3 = this.context?.componentParent?.expensesCatalogLevel3 || [];
          const found = expensesCatalogLevel3.find((obj: any) => obj.id === params.data.idExpense);
          return found ? found.description : '';
        },
        valueSetter: (params: any) => {
          const expensesCatalogLevel3 = this.context?.componentParent?.expensesCatalogLevel3 || [];
          const found = expensesCatalogLevel3.find((obj: any) => obj.description === params.newValue);
          if (found) {
            params.data.idExpense = found.id;
            return true;
          }
          return false;
        }
      },
      {
        field: 'idCatIng',
        headerName: 'Detalle Egreso',
        editable: true,
        width: 250,
        cellEditor: 'selectWithTooltipEditorV2',
        cellEditorParams: {
          options: this.objetosGastoHijos.map(obj => ({
            id: obj.id,
            description: obj.codigoNombre,
            valueAddition: obj.id.toString(),
            valueAddition2: obj.codigoNombre
          }))
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.objetosGastoHijos.find(obj => obj.id === params.value);
          return found ? found.codigoNombre : params.value;
        },
        cellStyle: (params) => {
          // Marcar en rojo si está vacío (obligatorio)
          if (!params.value || params.value === 0) {
            return { backgroundColor: '#ffe6e6', border: '1px solid #ff4444' };
          }
          return null;
        }
      },
      {
        field: 'description',
        headerName: 'Concepto',
        editable: true,
        width: 250,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 250,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: any) => {
          this.context.componentParent.modalServiceTable.showModal({
            params: event,
            value: event.value,
          });
        }
      },

      {
        field: 'numeroIdentificacion',
        headerName: 'UUID CFDI',
        editable: true,
        width: 280,
        type: 'text',
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 36
        }
      },

      {
        field: 'unit',
        headerName: 'Unidad',
        type: 'text',
        editable: true,
        hide: true,
        width: 90,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.measures.map(measure => measure.description),
        }
      },

      {
        field: 'price',
        headerName: 'Precio',
        type: 'number',
        editable: true,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'iva',
        headerName: '¿Aplic IVA?',
        type: 'boolean',
        editable: true,
        width: 120
      },
      {
        field: 'iva2',
        headerName: 'IVA',
        type: 'number',
        editable: true, // Editable para ajustar redondeo manualmente
        width: 80,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        cellStyle: { backgroundColor: '#fff9c4' } // Amarillo claro para indicar que es editable
      },
      {
        field: 'total',
        headerName: 'Subtotal',
        type: 'number',
        hide: true,
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'aplicaIsr',
        headerName: '¿Aplic ISR?',
        type: 'boolean',
        editable: true,
        width: 120
      },
      {
        field: 'isr',
        headerName: 'ISR',
        type: 'number',
        editable: true,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'totalFinal',
        headerName: 'Total Final',
        type: 'number',
        editable: false,
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },

      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        width: 100,
        cellEditor: 'multiLineEditorComponent'
      }
    ];

    // Retornar la instancia inicializada
    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    tooltipShowDelay: 500,
    tooltipHideDelay: 10000,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onCellKeyDown: (event: any) => {
      // Cuando se presiona Enter
      if (event.event.key === 'Enter' && !event.event.shiftKey) {
        // Detener la propagación para evitar el comportamiento por defecto
        event.event.preventDefault();
        event.event.stopPropagation();

        const currentColumn = event.column.getColId();

        if (currentColumn === 'idCatIng') {
          // Si estamos en "Detalle Egreso", mover a "Precio"
          const rowIndex = event.node.rowIndex;
          setTimeout(() => {
            this.gridApi.setFocusedCell(rowIndex, 'price');
            this.gridApi.startEditingCell({
              rowIndex: rowIndex,
              colKey: 'price'
            });
          }, 50);
        } else if (currentColumn === 'price') {
          // Si estamos en "Precio", guardar y agregar nuevo concepto con el mismo objeto de gasto
          this.addConcept(this.lastSelectedIdCatIng);
        } else {
          // Si estamos en cualquier otra columna, mover a "price"
          const rowIndex = event.node.rowIndex;
          setTimeout(() => {
            this.gridApi.setFocusedCell(rowIndex, 'price');
            this.gridApi.startEditingCell({
              rowIndex: rowIndex,
              colKey: 'price',
              key: null
            });
          }, 50);
        }
      }
    }
  };

  components = {
    multiLineEditorComponent: MultiLineEditorComponent,
    searchableSelect: SearchableSelectComponent,
    selectWithTooltipEditorV2: SelectWithTooltipEditorV2Component
  };

  addConcept(idCatIng?: number) {
    const tempId = `temp_concept_${this.tempIdCounter++}`;
    const newConcept = {
      id: tempId,
      idIncorExp: this.params.data.id,
      typeExpense: 'NA',
      idExpense: 0,
      dateExpend: this.params.data.date, // Fecha de pago del maestro
      description: '',
      quantity: 1,
      unit: '', // Campo vacío
      claveUnidad: '',
      objetoImp: '02', // Default to "Sí objeto de impuesto"
      claveProdServ: '',
      idCatIng: idCatIng || 0, // Campo para el objeto de gasto nivel 4
      descuento: 0,
      price: 0,
      total: 0,
      iva: false,
      iva2: 0,
      ivaManuallyEdited: false, // Bandera para saber si el IVA fue editado manualmente
      aplicaIsr: false,
      isr: 0,
      isrManuallyEdited: false,
      totalFinal: 0,
      comment: '',
      active: true,
      __isNew: true,
      __modified: false
    };

    // Si se proporciona idCatIng, establecer automáticamente la descripción
    if (idCatIng) {
      const selectedObjeto = this.objetosGastoHijos.find(obj => obj.id === idCatIng);
      if (selectedObjeto) {
        newConcept.description = selectedObjeto.codigoNombre;
      }
    }

    // Agregar al PRINCIPIO del array para que sea visible inmediatamente
    this.rowData = [newConcept, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Update count in master grid
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
      this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      // El nuevo registro está en el índice 0 (primera fila)
      const newRowIndex = 0;
      this.gridApi.ensureIndexVisible(newRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: idCatIng ? 'price' : 'idCatIng'
      });
    }, 0);
  }

  async deleteSelectedConcept() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un concepto para eliminar', 'warning');
      return;
    }

    const selectedConcept = selectedRows[0];

    // Mostrar confirmación antes de eliminar
    const result = await alerts.confirmAlert(
      '¿Eliminar concepto?',
      `¿Está seguro que desea eliminar este concepto? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    // Si es un registro nuevo (no guardado), eliminarlo solo localmente
    if (selectedConcept.__isNew) {
      console.log('🔵 Eliminando registro NUEVO:', selectedConcept.id);
      console.log('🔵 Total ANTES de eliminar:', this.total);
      console.log('🔵 rowData length ANTES:', this.rowData.length);

      // Filtrar el concepto del array
      this.rowData = this.rowData.filter(concept => concept.id !== selectedConcept.id);

      console.log('🔵 rowData length DESPUÉS:', this.rowData.length);

      // Eliminar del grid
      this.gridApi.applyTransaction({ remove: [selectedConcept] });

      this.hasUnsavedChanges = true;

      // Recalcular totales
      this.recalculateTotals();

      console.log('🔵 Total DESPUÉS de eliminar:', this.total);

      // Update count in master grid
      if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
        this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
      }
      return;
    }

    // Si es un registro existente, llamar al servicio del padre
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.delete) {
      console.log('🟢 Eliminando registro EXISTENTE:', selectedConcept.id);
      console.log('🟢 Total ANTES de eliminar:', this.total);
      console.log('🟢 rowData length ANTES:', this.rowData.length);

      // NO pasar el api, para que el padre NO haga applyTransaction
      this.context.CONCEPTS.delete({ data: selectedConcept }, () => {
        // Filtrar el concepto del array local
        this.rowData = this.rowData.filter(concept => concept.id !== selectedConcept.id);

        console.log('🟢 rowData length DESPUÉS del filter:', this.rowData.length);

        // Eliminar del grid usando applyTransaction
        this.gridApi.applyTransaction({ remove: [selectedConcept] });

        this.hasUnsavedChanges = true;

        // Recalcular totales
        this.recalculateTotals();

        console.log('🟢 Total DESPUÉS de eliminar:', this.total);

        // Update count in master grid
        if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
          this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detalles egresospalacios', 'Admon', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    console.log('💾 GUARDANDO CAMBIOS - Sincronizando datos del grid...');

    // PASO 1: Sincronizar datos del grid al array rowData
    const syncedData: any[] = [];
    this.gridApi.forEachNode(node => {
      if (node.data) {
        syncedData.push(node.data);
      }
    });
    this.rowData = syncedData;

    console.log('💾 Datos sincronizados. Total filas:', this.rowData.length);

    // PASO 2: Validar longitud de description y truncar si excede 250 caracteres
    const truncatedConcepts: string[] = [];
    this.rowData.forEach(concept => {
      if (concept.description && concept.description.length > 250) {
        const originalLength = concept.description.length;
        concept.description = concept.description.substring(0, 250);
        truncatedConcepts.push(`Concepto ID ${concept.id}: ${originalLength} caracteres truncado a 250`);
        console.log(`⚠️ TRUNCADO: Concepto ${concept.id} de ${originalLength} a 250 caracteres`);
      }

      // Recalcular total = quantity * price
      concept.total = Number(concept.quantity || 0) * Number(concept.price || 0);

      // Recalcular IVA solo si NO fue editado manualmente
      if (!concept.ivaManuallyEdited) {
        concept.iva2 = concept.iva ? concept.total * (this.ivaPercent / 100) : 0;
      }

      // Recalcular total final
      concept.totalFinal = concept.total + concept.iva2 - (concept.isr || 0);

      console.log(`  💾 Concepto ${concept.id}: total=${concept.total}, iva2=${concept.iva2}, totalFinal=${concept.totalFinal}`);
    });

    // Mostrar alerta si se truncaron conceptos
    if (truncatedConcepts.length > 0) {
      const message = `Se truncaron ${truncatedConcepts.length} concepto(s) que excedían 250 caracteres:\n\n${truncatedConcepts.join('\n')}`;
      alerts.basicAlert('Conceptos truncados', message, 'warning');
    }

    // PASO 3: Filtrar solo los conceptos con precio mayor a 0
    const validConcepts = this.rowData.filter(concept =>
      concept.price && Number(concept.price) > 0
    );

    console.log('💾 Conceptos válidos (precio > 0):', validConcepts.length);

    // Si no hay conceptos válidos, mostrar mensaje
    if (validConcepts.length === 0) {
      alerts.basicAlert(
        'Validación',
        'Debe haber al menos un concepto con precio mayor a 0 para guardar.',
        'warning'
      );
      return;
    }

    // PASO 4: Validar que todos los conceptos válidos tengan campos obligatorios
    const hasEmptyFields = validConcepts.some(concept =>
      !concept.description ||
      !concept.quantity ||
      !concept.idCatIng ||
      concept.idCatIng === 0
    );

    if (hasEmptyFields) {
      alerts.basicAlert(
        'Validación',
        'Todos los conceptos deben tener descripción, cantidad y detalle de egreso seleccionado.',
        'error'
      );
      return;
    }

    // PASO 5: Eliminar de rowData los conceptos con precio = 0
    this.rowData = validConcepts;
    this.gridApi.setGridOption('rowData', this.rowData);

    // PASO 6: Recalcular totales GLOBALES (subtotal, iva2, isr, total)
    console.log('💾 Recalculando totales globales...');
    this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
    this.isr = this.rowData.reduce((acc, row) => acc + (Number(row.isr) || 0), 0);
    this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);

    console.log('💾 TOTALES GLOBALES:');
    console.log('  💾 Subtotal:', this.subtotal);
    console.log('  💾 IVA:', this.iva2);
    console.log('  💾 ISR:', this.isr);
    console.log('  💾 Total:', this.total);

    // PASO 7: Guardar en el backend y ESPERAR a que termine
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.save) {
      const expenditureId = this.params.data.id;
      const dataToSave = {
        concepts: validConcepts, // Solo guardar conceptos con precio > 0
        subtotal: this.subtotal,
        tax: this.iva2,
        isr: this.isr,
        total: this.total
      };
      console.log('💾 Enviando al backend:', dataToSave);

      try {
        // ESPERAR a que el backend termine de guardar
        // El padre (egresos-palacio) actualizará el maestro después de guardar exitosamente
        await this.context.CONCEPTS.save(expenditureId, dataToSave);
        console.log('✅ Guardado exitoso. El maestro ya fue actualizado por el componente padre.');
        this.hasUnsavedChanges = false;

        // CERRAR el detalle y REFRESCAR el grid maestro (igual que ingresos)
        console.log('🔄 DETALLE: Cerrando detalle y refrescando grid maestro...');
        if (this.context?.componentParent) {
          // Cerrar el detalle
          this.context.componentParent.collapseReportDetail(expenditureId);

          // Refrescar el grid maestro después de un momento para que se vea el cambio
          setTimeout(() => {
            if (this.context.componentParent.gridApi) {
              this.context.componentParent.gridApi.refreshCells({ force: true });
              console.log('✅ DETALLE: Grid maestro refrescado');
            }
          }, 200);
        }
      } catch (error) {
        console.error('❌ Error al guardar:', error);
        // En caso de error, el padre ya mostró el alert
      }
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadConceptsData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;

    // Si se cambió el "Detalle Egreso", copiar automáticamente al Concepto y establecer la fecha
    if (event.colDef.field === 'idCatIng' && event.newValue) {
      this.lastSelectedIdCatIng = event.newValue; // Guardar para copiar en nuevas filas
      const selectedObjeto = this.objetosGastoHijos.find(obj => obj.id === event.newValue);
      if (selectedObjeto) {
        // Copiar el codigoNombre del objeto de gasto al campo Concepto
        event.data.description = selectedObjeto.codigoNombre;

        // Establecer la fecha igual a la fecha de pago del maestro
        event.data.dateExpend = this.params.data.date;

        // Actualizar la fila en el grid
        if (this.gridApi) {
          this.gridApi.applyTransaction({
            update: [event.data]
          });
        }
      }
    }

    // Detectar si el usuario editó el IVA manualmente
    if (event.colDef.field === 'iva2') {
      const rowData = event.data;
      rowData.ivaManuallyEdited = true; // Marcar como editado manualmente
      rowData.totalFinal = rowData.total + rowData.iva2 - (rowData.isr || 0);

      if (this.gridApi) {
        this.gridApi.applyTransaction({
          update: [rowData]
        });
      }

      // Recalcular totales globales
      this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
      this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
      this.isr = this.rowData.reduce((acc, row) => acc + (Number(row.isr) || 0), 0);
      this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
    }

    if (['iva', 'quantity', 'price', 'aplicaIsr', 'isr'].includes(event.colDef.field)) {
      const rowData = event.data;

      if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
        rowData.total = Number(rowData.quantity || 0) * Number(rowData.price || 0);
        // Resetear la bandera de edición manual cuando cambia el precio o cantidad
        rowData.ivaManuallyEdited = false;
      }

      if (event.colDef.field === 'iva') {
        // Si cambia el checkbox de IVA, resetear la bandera de edición manual
        rowData.ivaManuallyEdited = false;
      }

      if (event.colDef.field === 'aplicaIsr') {
        if (!rowData.aplicaIsr) {
          rowData.isr = 0;
        }
      }

      // Solo recalcular IVA si NO fue editado manualmente
      if (!rowData.ivaManuallyEdited) {
        rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;
      }

      rowData.totalFinal = rowData.total + rowData.iva2 - (rowData.isr || 0);

      if (this.gridApi) {
        this.gridApi.applyTransaction({
          update: [rowData]
        });
      }

      // Solo calcular totales locales sin actualizar el maestro
      this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
      this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
      this.isr = this.rowData.reduce((acc, row) => acc + (Number(row.isr) || 0), 0);
      this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
    }
  }

  private recalculateTotals() {
    try {
      console.log('📊 RECALCULANDO TOTALES...');
      console.log('📊 rowData.length:', this.rowData.length);
      console.log('📊 rowData IDs:', this.rowData.map(r => r.id));

      this.subtotal = this.rowData.reduce((acc, row) => {
        const total = Number(row.total) || 0;
        console.log(`  - Row ${row.id}: total = ${total}`);
        return acc + total;
      }, 0);

      this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
      this.isr = this.rowData.reduce((acc, row) => acc + (Number(row.isr) || 0), 0);

      const totalFinalSum = this.rowData.reduce((acc, row) => {
        const totalFinal = Number(row.totalFinal) || 0;
        console.log(`  - Row ${row.id}: totalFinal = ${totalFinal}`);
        return acc + totalFinal;
      }, 0);

      this.total = totalFinalSum;

      console.log('📊 TOTALES CALCULADOS:');
      console.log('  - Subtotal:', this.subtotal);
      console.log('  - IVA:', this.iva2);
      console.log('  - ISR:', this.isr);
      console.log('  - Total:', this.total);

      // Actualizar el maestro inmediatamente con los nuevos totales
      this.updateMasterTotals();
    } catch (error) {
      console.error('❌ Error recalculando totales:', error);
      this.subtotal = 0;
      this.iva2 = 0;
      this.isr = 0;
      this.total = 0;

      // Actualizar el maestro con valores en 0
      this.updateMasterTotals();
    }
  }

  /**
   * Actualiza los totales en la fila del maestro inmediatamente
   */
  private updateMasterTotals() {
    if (!this.context?.componentParent) {
      return;
    }

    const expenditureId = this.params?.data?.id;
    if (!expenditureId) {
      return;
    }

    // Actualizar directamente en el componente padre
    if (typeof this.context.componentParent.updateMasterRowInGrid === 'function') {
      this.context.componentParent.updateMasterRowInGrid({
        id: expenditureId,
        subtotal: this.subtotal,
        tax: this.iva2,
        isr: this.isr,
        total: this.total
      });
    }
  }

  closeReport() {
    // Emit event to parent component to handle collapse
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapseReportDetail(this.expenditureData.id);
    }
  }

  closeDetail() {
    // Close any type of detail
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapseReportDetail(this.expenditureData.id);
    }
  }

  // Método para abrir el modal de agregar proveedor
  openAddProviderModal() {
    if (!this.context?.idRoot) {
      console.warn('No se puede abrir modal: falta idRoot');
      return;
    }

    // Solicitar al servicio que abra el modal en el componente padre
    this.providerModalService.openModal({
      idRoot: this.context.idRoot
    });
  }

  // Método para manejar cuando se crea un nuevo proveedor
  onProviderCreated(providerData: { id: number; name: string }) {
    // Recargar la lista de proveedores
    this.loadProviders();

    // Esperar a que se carguen los proveedores y luego auto-seleccionar el nuevo
    setTimeout(() => {
      // Buscar la fila actualmente seleccionada
      const selectedNodes = this.gridApiDocumentos?.getSelectedNodes();
      if (selectedNodes && selectedNodes.length > 0) {
        const selectedRow = selectedNodes[0];
        selectedRow.setDataValue('idSpend', providerData.id);
        this.hasUnsavedDocumentosChanges = true;
      }

      // Refrescar la columna para mostrar el nuevo valor
      if (this.gridApiDocumentos) {
        this.gridApiDocumentos.refreshCells({
          columns: ['idSpend'],
          force: true
        });
      }
    }, 500);
  }

  /**
   * Mapea un ID de objeto nivel 4 a su código de nivel 1 padre
   * Ej: idCatIng=145 (objeto "3111") → retorna "3000"
   */
  private getNivel1CodigoFromNivel4Id(idCatIng: number): string | null {
    // Buscar el objeto nivel 4 en objetosGastoHijos
    const objetoNivel4 = this.objetosGastoHijos.find(obj => obj.id === idCatIng);
    if (!objetoNivel4 || !objetoNivel4.codigoNombre) {
      return null;
    }

    // Extraer el código del codigoNombre (ej: "3111 - Dietas" → "3111")
    const codigoMatch = objetoNivel4.codigoNombre.match(/^(\d+)/);
    if (!codigoMatch) {
      return null;
    }

    const codigoNivel4 = codigoMatch[1]; // "3111"

    // Tomar el primer dígito y completar con ceros
    const primerDigito = codigoNivel4.charAt(0); // "3"
    const codigoNivel1 = `${primerDigito}000`; // "3000"

    return codigoNivel1;
  }

  /**
   * Agrupa los conceptos por objeto de gasto nivel 1
   * Retorna un mapa: { "3000": { nivel1Info, conceptos[], subtotal }, ... }
   */
  private agruparConceptosPorNivel1(): Map<string, any> {
    const grupos = new Map<string, any>();

    // Iterar sobre cada concepto
    this.rowData.forEach(concepto => {
      const idCatIng = concepto.idCatIng;

      // Obtener el código del nivel 1 padre
      const codigoNivel1 = this.getNivel1CodigoFromNivel4Id(idCatIng);

      if (!codigoNivel1) {
        // Si no se puede determinar, agrupar en "Sin clasificar"
        if (!grupos.has('sin-clasificar')) {
          grupos.set('sin-clasificar', {
            nivel1Info: { codigo: '', nombre: 'SIN CLASIFICAR', codigoNombre: 'SIN CLASIFICAR' },
            conceptos: [],
            subtotal: 0
          });
        }
        const grupo = grupos.get('sin-clasificar');
        grupo.conceptos.push(concepto);
        grupo.subtotal += concepto.totalFinal || 0;
        return;
      }

      // Buscar la información del objeto nivel 1
      const nivel1Info = this.objetosGastoNivel1.find(obj => obj.codigo === codigoNivel1);

      if (!nivel1Info) {
        console.warn(`No se encontró info para nivel 1 código: ${codigoNivel1}`);
        return;
      }

      // Crear el grupo si no existe
      if (!grupos.has(codigoNivel1)) {
        grupos.set(codigoNivel1, {
          nivel1Info: nivel1Info,
          conceptos: [],
          subtotal: 0
        });
      }

      // Agregar el concepto al grupo
      const grupo = grupos.get(codigoNivel1);
      grupo.conceptos.push(concepto);
      grupo.subtotal += concepto.totalFinal || 0;
    });

    return grupos;
  }

  /**
   * Genera la tabla simple de conceptos (sin agrupar)
   */
  private generarTablaSimple(): any {
    return {
      table: {
        headerRows: 1,
        widths: [45, 90, 150, '*', 70],
        body: [
          // Encabezados
          [
            { text: 'Fecha', style: 'tableHeader', alignment: 'center' },
            { text: 'Catálogo Gasto (Clasificador Antiguo)', style: 'tableHeader', alignment: 'center' },
            { text: 'NUMERO DE RECIBO O FOLIO FISCAL (FACTURA)', style: 'tableHeader', alignment: 'center' },
            { text: 'Descripción', style: 'tableHeader', alignment: 'center' },
            { text: 'Total', style: 'tableHeader', alignment: 'center' }
          ],
          // Filas de conceptos
          ...this.rowData.map(concept => [
            { text: this.formatDate(concept.dateExpend), style: 'tableCell', fontSize: 6 },
            { text: this.getCatalogoGastoNivel3Text(concept.idExpense), style: 'tableCell', fontSize: 6 },
            { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 6 },
            { text: concept.description || '', style: 'tableCell' },
            { text: this.formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
          ]),
          // Fila de totales
          [
            { text: '', border: [false, false, false, false] },
            { text: '', border: [false, false, false, false] },
            { text: '', border: [false, false, false, false] },
            { text: 'TOTAL:', style: 'totalLabel', alignment: 'right', border: [false, true, false, false] },
            { text: this.formatCurrency(this.total), style: 'totalValue', alignment: 'right', border: [false, true, false, false] }
          ]
        ]
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#333333',
        vLineColor: () => '#cccccc',
        paddingTop: () => 3,
        paddingBottom: () => 3,
        paddingLeft: () => 4,
        paddingRight: () => 4
      },
      margin: [0, 0, 0, 20]
    };
  }

  /**
   * Genera las tablas agrupadas por objeto de gasto nivel 1
   * Cada grupo se imprime en una página separada con header, tabla, nota y firmas
   * NOTA: La paginación "Hoja X de Y" ahora se maneja en el footer dinámico del documento
   */
  private generarTablaAgrupada(rootResponse?: any): any[] {
    const elementos: any[] = [];

    // Agrupar conceptos
    const grupos = this.agruparConceptosPorNivel1();

    // Convertir el Map a array y ordenar por código
    const gruposOrdenados = Array.from(grupos.entries()).sort((a, b) => {
      if (a[0] === 'sin-clasificar') return 1;
      if (b[0] === 'sin-clasificar') return -1;
      return a[0].localeCompare(b[0]);
    });

    // Guardar información de grupos para el footer dinámico
    this.gruposParaPaginacion = gruposOrdenados.map(([codigoNivel1, grupo]) => ({
      codigoNivel1,
      nombreGrupo: grupo.nivel1Info.codigoNombre,
      numConceptos: grupo.conceptos.length
    }));

    // Total de grupos para la numeración de páginas
    const totalGrupos = gruposOrdenados.length;

    // Generar una tabla por cada grupo (cada grupo en una página separada con header y firmas)
    gruposOrdenados.forEach(([codigoNivel1, grupo], index) => {
      // Número de página actual (1-based)
      const paginaActual = index + 1;

      // ========== SALTO DE PÁGINA (excepto el primero) ==========
      if (index > 0) {
        elementos.push({ text: '', pageBreak: 'before' });
      }

      // ========== HEADER CON LOGOS ==========
      elementos.push({
        columns: [
          {
            image: 'logo',
            width: 80,
            alignment: 'left'
          },
          {
            stack: [
              {
                text: rootResponse?.name || 'Empresa',
                style: 'companyName',
                alignment: 'center'
              },
              {
                text: rootResponse?.email || '',
                style: 'companyInfo',
                alignment: 'center'
              },
              {
                text: rootResponse?.web || '',
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
                text: 'RECIBO DE EGRESO',
                style: 'documentTitle',
                alignment: 'right'
              },
              {
                text: `No. ${this.expenditureData?.numberDocument || 'Sin Número'}`,
                style: 'documentNumber',
                alignment: 'right',
                margin: [0, 5, 0, 0]
              },
              {
                text: `Fecha de Pago: ${this.formatDate(this.expenditureData?.date)}`,
                style: 'documentDate',
                alignment: 'right',
                margin: [0, 3, 0, 0]
              }
            ],
            width: 150
          }
        ],
        margin: [0, 0, 0, 15]
      });

      // Línea separadora después del header
      elementos.push({
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
        margin: [0, 0, 0, 10]
      });

      // ========== TÍTULO DEL GRUPO (Objeto Nivel 1) ==========
      elementos.push({
        text: grupo.nivel1Info.codigoNombre,
        style: 'groupTitle',
        margin: [0, 10, 0, 5]
      });

      // ========== TABLA DE CONCEPTOS DEL GRUPO ==========
      elementos.push({
        table: {
          headerRows: 1,
          widths: [45, 90, 150, '*', 70],
          body: [
            // Encabezados
            [
              { text: 'Fecha', style: 'tableHeader', alignment: 'center' },
              { text: 'Catálogo Gasto (Clasificador Antiguo)', style: 'tableHeader', alignment: 'center' },
              { text: 'NUMERO DE RECIBO O FOLIO FISCAL(FACTURA)', style: 'tableHeader', alignment: 'center' },
              { text: 'Descripción', style: 'tableHeader', alignment: 'center' },
              { text: 'Total', style: 'tableHeader', alignment: 'center' }
            ],
            // Filas de conceptos del grupo
            ...grupo.conceptos.map((concept: any) => [
              { text: this.formatDate(concept.dateExpend), style: 'tableCell', fontSize: 6 },
              { text: this.getCatalogoGastoNivel3Text(concept.idExpense), style: 'tableCell', fontSize: 6 },
              { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 6 },
              { text: concept.description || '', style: 'tableCell' },
              { text: this.formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
            ]),
            // Fila de subtotal del grupo
            [
              { text: '', border: [false, false, false, false] },
              { text: '', border: [false, false, false, false] },
              { text: '', border: [false, false, false, false] },
              { text: 'SUBTOTAL:', style: 'subtotalLabel', alignment: 'right', border: [false, true, false, false] },
              { text: this.formatCurrency(grupo.subtotal), style: 'subtotalValue', alignment: 'right', border: [false, true, false, false] }
            ]
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#333333',
          vLineColor: () => '#cccccc',
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 4,
          paddingRight: () => 4
        },
        margin: [0, 0, 0, 5]
      });

      // ========== NOTA AL FINAL DE LA TABLA ==========
      elementos.push({
        text: 'NOTA: Se realizó Pago con diferentes Objetos de Gasto',
        style: 'notaImportante',
        alignment: 'left',
        margin: [0, 10, 0, 15]
      });

      // ========== FIRMAS ==========
      elementos.push({
        table: {
          widths: ['33%', '34%', '33%'],
          body: [
            [
              { text: this.setupManagementInfo?.administratorTitle || 'TESORERO', style: 'signatureTitle', alignment: 'center' },
              { text: this.setupManagementInfo?.gerencyTitle || 'SINDICO DE HACIENDA', style: 'signatureTitle', alignment: 'center' },
              { text: this.setupManagementInfo?.directorTitle || 'PRESIDENTE MUNICIPAL', style: 'signatureTitle', alignment: 'center' }
            ],
            [
              { text: ' ', margin: [0, 25, 0, 0] },
              { text: ' ', margin: [0, 25, 0, 0] },
              { text: ' ', margin: [0, 25, 0, 0] }
            ],
            [
              {
                text: '________________________________',
                alignment: 'center',
                border: [false, true, false, false],
                margin: [0, 0, 0, 3]
              },
              {
                text: '________________________________',
                alignment: 'center',
                border: [false, true, false, false],
                margin: [0, 0, 0, 3]
              },
              {
                text: '________________________________',
                alignment: 'center',
                border: [false, true, false, false],
                margin: [0, 0, 0, 3]
              }
            ],
            [
              { text: this.setupManagementInfo?.administratorName || '', style: 'signatureName', alignment: 'center' },
              { text: this.setupManagementInfo?.gerencyName || '', style: 'signatureName', alignment: 'center' },
              { text: this.setupManagementInfo?.directorName || '', style: 'signatureName', alignment: 'center' }
            ],
            [
              { text: 'Firma', style: 'signatureLabel', alignment: 'center' },
              { text: 'Firma', style: 'signatureLabel', alignment: 'center' },
              { text: 'Firma', style: 'signatureLabel', alignment: 'center' }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 10, 0, 0]
      });

      // NOTA: La numeración "Hoja X de Y" se maneja en el footer dinámico del documento
      // para que aparezca en CADA página física del grupo, no solo al final
    });

    return elementos;
  }

  private async generateReport() {
    try {
      // Verificar que tengamos los servicios necesarios en el contexto
      if (!this.context?.rootService || !this.context?.base64EncodeService || !this.context?.idRoot) {
        console.error('Servicios necesarios no disponibles en el contexto');
        this.pdfUrl = null;
        return;
      }

      // Obtener información de la empresa (root) con el logo
      const rootResponse: any = await lastValueFrom(
        this.context.rootService.getRootbyId(this.context.idRoot)
      );

      // Convertir logo a Base64
      const logoBase64 = await this.context.base64EncodeService.convertImageToBase64(
        rootResponse.picture
      );

      // Convertir picture2 (segundo logo) a Base64
      const logo2Base64 = rootResponse.picture2
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture2)
        : logoBase64; // Si no hay picture2, usar picture

      // Convertir picture3 (marca de agua) a Base64
      const watermarkBase64 = rootResponse.picture3
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture3)
        : null;

      // ==================== PRE-GENERAR CONTENIDO AGRUPADO SI ES MOSTRAR TODO ====================
      // Necesitamos generar el contenido ANTES para calcular la paginación por grupo
      let contenidoAgrupado: any[] = [];
      let pageToGroupMapping: Array<{
        groupIndex: number;
        groupName: string;
        localPage: number;
        totalPagesInGroup: number;
      }> = [];

      if (this.expenditureData?.mostrartodo === true) {
        // Generar el contenido agrupado primero (esto llena this.gruposParaPaginacion)
        contenidoAgrupado = this.generarTablaAgrupada(rootResponse);

        // Ahora calcular el mapeo de páginas con la información de grupos
        if (this.gruposParaPaginacion.length > 0) {
          // Estimar filas por página (aproximadamente 15 filas por página en formato LETTER portrait)
          const ROWS_PER_PAGE = 15;

          let currentGlobalPage = 1;

          this.gruposParaPaginacion.forEach((grupo, groupIndex) => {
            // Calcular páginas para este grupo basándose en el número de conceptos
            const pagesForThisGroup = Math.max(1, Math.ceil(grupo.numConceptos / ROWS_PER_PAGE));

            for (let localPage = 1; localPage <= pagesForThisGroup; localPage++) {
              pageToGroupMapping[currentGlobalPage] = {
                groupIndex: groupIndex,
                groupName: grupo.nombreGrupo,
                localPage: localPage,
                totalPagesInGroup: pagesForThisGroup
              };
              currentGlobalPage++;
            }
          });
        }
      }

      // Crear la estructura del documento PDF
      const docDefinition: any = {
        pageSize: 'LETTER',
        pageMargins: [40, 60, 40, 80], // Aumentar margen inferior para el footer
        // Footer dinámico para "Mostrar Todo" - muestra "Hoja X de Y" por cada grupo
        footer: this.expenditureData?.mostrartodo === true ? (currentPage: number, pageCount: number) => {
          const pageInfo = pageToGroupMapping[currentPage];

          if (pageInfo) {
            // Mostrar paginación local del grupo
            return {
              text: `Hoja ${pageInfo.localPage} de ${pageInfo.totalPagesInGroup}`,
              alignment: 'center',
              fontSize: 10,
              bold: true,
              color: '#0066cc',
              margin: [0, 15, 0, 0]
            };
          } else {
            // Fallback para páginas no mapeadas (usar paginación global)
            return {
              text: `Hoja ${currentPage} de ${pageCount}`,
              alignment: 'center',
              fontSize: 10,
              bold: true,
              color: '#0066cc',
              margin: [0, 15, 0, 0]
            };
          }
        } : undefined,
        background: watermarkBase64 ? [
          {
            image: 'watermark',
            width: 400,
            opacity: 0.15,
            absolutePosition: { x: 106, y: 250 }
          }
        ] : [],
        content: [
          // Header con logo y título (solo si NO es Mostrar Todo, porque cada grupo ya tiene su propio header)
          ...(this.expenditureData?.mostrartodo !== true ? [{
            columns: [
              {
                image: 'logo',
                width: 80,
                alignment: 'left'
              },
              {
                stack: [
                  {
                    text: rootResponse.name || 'Empresa',
                    style: 'companyName',
                    alignment: 'center'
                  },
                  {
                    text: rootResponse.email || '',
                    style: 'companyInfo',
                    alignment: 'center'
                  },
                  {
                    text: rootResponse.web || '',
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
                    text: 'RECIBO DE EGRESO',
                    style: 'documentTitle',
                    alignment: 'right'
                  },
                  {
                    text: `No. ${this.expenditureData?.numberDocument || 'Sin Número'}`,
                    style: 'documentNumber',
                    alignment: 'right',
                    margin: [0, 5, 0, 0]
                  },
                  {
                    text: `Fecha de Pago: ${this.formatDate(this.expenditureData?.date)}`,
                    style: 'documentDate',
                    alignment: 'right',
                    margin: [0, 3, 0, 0]
                  }
                ],
                width: 150
              }
            ],
            margin: [0, 0, 0, 20]
          }] : []),
          // Línea separadora (solo si NO es Mostrar Todo)
          ...(this.expenditureData?.mostrartodo !== true ? [{
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
          }] : []),
          // DETALLES DEL EGRESO (Maestro) - Solo si NO es Mostrar Todo
          ...(this.expenditureData?.mostrartodo !== true ? [{
           text: this.detailType === 'catalogReport' ? 'CATALOGO DE GASTO' : 'DETALLES DEL EGRESO',
           style: 'sectionTitle',
           margin: [0, 10, 0, 10]
         }] : []),
         ...(this.expenditureData?.mostrartodo !== true ? [{
           table: {
             widths: ['25%', '75%'],
             body: [
               [
                 { text: 'FECHA PAGO:', style: 'masterLabel' },
                 { text: this.formatDate(this.expenditureData?.date), style: 'masterValue' }
               ],
               [
                 { text: this.detailType === 'catalogReport' ? 'RUBRO:' : 'OBJETO DE GASTO:', style: 'masterLabel' },
                 {
                   text: this.detailType === 'catalogReport' ? `${this.getCatalogoGastoText()}        ${this.formatCurrency(this.expenditureData?.total || 0)}` : `${this.getObjetoGastoText()}        ${this.formatCurrency(this.expenditureData?.total || 0)}`,
                   style: 'masterValue'
                 }
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
          }] : []),
          // Tabla de Conceptos (Detalle) - Condicional según mostrartodo
          // Si mostrartodo=true, usar el contenido pre-generado para que el mapeo de páginas funcione
          ...(this.expenditureData?.mostrartodo === true
            ? contenidoAgrupado
            : [this.generarTablaSimple()]),
          // Footer con Firmas (solo si NO es Mostrar Todo, porque ya están incluidas en cada grupo)
          ...(this.expenditureData?.mostrartodo !== true ? [{
            table: {
              widths: ['33%', '34%', '33%'],
              body: [
                [
                  { text: this.setupManagementInfo?.administratorTitle || 'TESORERO', style: 'signatureTitle', alignment: 'center' },
                  { text: this.setupManagementInfo?.gerencyTitle || 'SINDICO DE HACIENDA', style: 'signatureTitle', alignment: 'center' },
                  { text: this.setupManagementInfo?.directorTitle || 'PRESIDENTE MUNICIPAL', style: 'signatureTitle', alignment: 'center' }
                ],
                [
                  { text: ' ', margin: [0, 30, 0, 0] },
                  { text: ' ', margin: [0, 30, 0, 0] },
                  { text: ' ', margin: [0, 30, 0, 0] }
                ],
                [
                  {
                    text: '________________________________',
                    alignment: 'center',
                    border: [false, true, false, false],
                    margin: [0, 0, 0, 5]
                  },
                  {
                    text: '________________________________',
                    alignment: 'center',
                    border: [false, true, false, false],
                    margin: [0, 0, 0, 5]
                  },
                  {
                    text: '________________________________',
                    alignment: 'center',
                    border: [false, true, false, false],
                    margin: [0, 0, 0, 5]
                  }
                ],
                [
                  { text: this.setupManagementInfo?.administratorName || '', style: 'signatureName', alignment: 'center' },
                  { text: this.setupManagementInfo?.gerencyName || '', style: 'signatureName', alignment: 'center' },
                  { text: this.setupManagementInfo?.directorName || '', style: 'signatureName', alignment: 'center' }
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
          }] : [])
        ],
        images: watermarkBase64 ? {
          logo: logoBase64,
          logo2: logo2Base64,
          watermark: watermarkBase64
        } : {
          logo: logoBase64,
          logo2: logo2Base64
        },
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
            fontSize: 16,
            bold: true,
            color: '#cc0000'
          },
          documentNumber: {
            fontSize: 12,
            bold: true,
            color: '#333333'
          },
          documentDate: {
            fontSize: 10,
            color: '#666666'
          },
          sectionTitle: {
            fontSize: 11,
            bold: true,
            color: '#cc0000'
          },
          masterLabel: {
            fontSize: 9,
            bold: true,
            color: '#333333'
          },
          masterValue: {
            fontSize: 9,
            color: '#000000'
          },
          tableHeader: {
            fontSize: 8,
            bold: true,
            fillColor: '#e6e6e6',
            color: '#000000'
          },
          tableCell: {
            fontSize: 8,
            color: '#000000'
          },
          totalLabel: {
            fontSize: 9,
            bold: true,
            color: '#000000'
          },
          totalValue: {
            fontSize: 9,
            bold: true,
            color: '#cc0000'
          },
          groupTitle: {
            fontSize: 10,
            bold: true,
            color: '#0066cc',
            fillColor: '#e6f2ff'
          },
          subtotalLabel: {
            fontSize: 8,
            bold: true,
            color: '#333333'
          },
          subtotalValue: {
            fontSize: 8,
            bold: true,
            color: '#0066cc'
          },
          signatureTitle: {
            fontSize: 8,
            bold: true,
            color: '#333333'
          },
          signatureName: {
            fontSize: 8,
            color: '#000000'
          },
          signatureLabel: {
            fontSize: 8,
            italics: true,
            color: '#666666'
          },
          notaImportante: {
            fontSize: 9,
            bold: true,
            italics: true,
            color: '#cc0000'
          },
          pageNumber: {
            fontSize: 10,
            bold: true,
            color: '#0066cc'
          }
        }
      };

      // Generar el PDF
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió/abrió PDF detalle egreso palacio', 'Admon / Egresos Palacio', this.trackingService.getEmail());
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      pdfDocGenerator.getBlob((blob: Blob) => {
        // Limpiar URL anterior si existe
        if (this.originalPdfUrl) {
          URL.revokeObjectURL(this.originalPdfUrl);
        }

        // Crear nueva URL para el blob
        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.originalPdfUrl);
      });

    } catch (error) {
      console.error('Error generando el reporte PDF:', error);
      this.pdfUrl = null;
      alerts.basicAlert('Error', 'No se pudo generar el reporte PDF', 'error');
    }
  }

  private getCurrentDateTime(): string {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return `${fecha} ${hora}`;
  }

  private formatDate(date: any): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  private formatCurrency(amount: number): string {
    return '$ ' + amount.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private getObjetoGastoText(): string {
    // Si el checkbox "Mostrar Todos" está activo, concatenar todos los objetos nivel 1
    if (this.expenditureData?.mostrartodo === true) {
      // Agrupar conceptos para obtener los objetos nivel 1 únicos
      const grupos = this.agruparConceptosPorNivel1();

      // Extraer los nombres de los objetos nivel 1 y ordenarlos
      const objetosNivel1 = Array.from(grupos.entries())
        .filter(([codigo, grupo]) => codigo !== 'sin-clasificar') // Excluir "sin clasificar"
        .sort((a, b) => a[0].localeCompare(b[0])) // Ordenar por código
        .map(([codigo, grupo]) => grupo.nivel1Info.nombre); // Solo el nombre, sin código

      // Si no hay objetos, retornar fallback
      if (objetosNivel1.length === 0) {
        return 'Sin objetos de gasto';
      }

      // Concatenar con " + "
      return objetosNivel1.join(' + ');
    }

    // Comportamiento original cuando checkbox está inactivo
    if (this.expenditureData?.objetoGastoTexto) {
      return this.expenditureData.objetoGastoTexto;
    }

    // Fallback: intentar construir el texto si no está disponible
    if (!this.expenditureData?.idExpend) {
      return 'Sin objeto de gasto';
    }

    return 'Sin descripción';
  }

  private getCatalogoGastoText(): string {
    // Obtener el valor de la columna "Catálogo Gasto" (idExpendxcategr)
    if (this.expenditureData?.idExpendxcategr && this.context?.componentParent?.expensesCatalogLevel2) {
      const foundItem = this.context.componentParent.expensesCatalogLevel2.find(
        (item: any) => item.id === this.expenditureData.idExpendxcategr
      );
      return foundItem ? foundItem.description : 'Sin catálogo de gasto';
    }
    return 'Sin catálogo de gasto';
  }

  /**
   * Obtiene la descripción del catálogo de gasto nivel 3 por su ID (idExpense del detalle)
   */
  private getCatalogoGastoNivel3Text(idExpense: number): string {
    if (!idExpense) return '';
    const expensesCatalogLevel3 = this.context?.componentParent?.expensesCatalogLevel3 || [];
    const foundItem = expensesCatalogLevel3.find((item: any) => item.id === idExpense);
    return foundItem ? foundItem.description : '';
  }

  // ==================== MÉTODOS PARA DOCUMENTOS COMPROBADOS ====================

  loadDocumentosComprobados() {
    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.load) {
      const expenditureId = this.params.data.id;
      console.log('🔵 DETALLE: Cargando documentos comprobados para egreso ID:', expenditureId);
      this.context.DOCUMENTOS_COMPROBADOS.load(expenditureId, (data: any[]) => {
        console.log(`📊 DETALLE: Documentos comprobados recibidos para ID ${expenditureId}:`, data.length);
        this.documentosData = data.map(doc => ({
          ...doc,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApiDocumentos) {
          this.gridApiDocumentos.setGridOption('rowData', this.documentosData);
        }
        // Update the count in master grid
        if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.updateCount) {
          console.log(`🔄 DETALLE: Actualizando contador de documentos en maestro. ID: ${expenditureId}, Count: ${this.documentosData.length}`);
          this.context.DOCUMENTOS_COMPROBADOS.updateCount(expenditureId, this.documentosData.length);
        }
      });
    }
  }

  onDocumentosGridReady(params: GridReadyEvent) {
    this.gridApiDocumentos = params.api;
    this.gridApiDocumentos.setGridOption('columnDefs', this.colDefsComprobacion);
  }

  // Cache para las definiciones de columnas de documentos comprobados
  private _colDefsComprobacion: ColDef[] = [];

  get colDefsComprobacion(): ColDef[] {
    // Si ya fue inicializado, retornar la misma instancia (evita parpadeo)
    if (this._colDefsComprobacion.length > 0) {
      return this._colDefsComprobacion;
    }

    // Determinar el nombre de la columna según el tipo de comprobante
    const isEmpleados = this.isEmpleadosComprobante();
    const providerColumnName = isEmpleados ? 'Empleado' : 'Proveedor';

    // Inicializar una sola vez
    this._colDefsComprobacion = [
      {
        headerName: '#',
        width: 60,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'idSpend',
        headerName: providerColumnName,
        editable: true,
        width: 340,
        cellEditor: 'selectWithTooltipEditorV2',
        cellEditorParams: {
          options: [
            ...this.providers.map(provider => ({
              id: provider.id,
              description: provider.displayText,
              valueAddition: provider.id.toString(),
              valueAddition2: provider.displayText
            })),
            {
              id: -999,
              description: '➕ Agregar nuevo proveedor...',
              valueAddition: '-999',
              valueAddition2: '➕ Agregar nuevo proveedor...'
            }
          ]
        },
        valueFormatter: (params) => {
          if (!params.value || params.value === -999) return '';
          const found = this.providers.find(provider => provider.id === params.value);
          return found ? found.displayText : params.value;
        },
        onCellValueChanged: (event: any) => {
          if (event.newValue === -999) {
            // Usuario seleccionó "Agregar nuevo proveedor"
            event.data.idSpend = event.oldValue || null;
            this.gridApiDocumentos.refreshCells({ rowNodes: [event.node], force: true });
            this.openAddProviderModal();
          }
        }
      },
      {
        field: 'tipoDocumento',
        headerName: 'Tipo Documento',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'PDF', 'XML']
        }
      },
      {
        field: 'nombreArchivo',
        headerName: 'Nombre Archivo',
        width: 350,
        editable: false,
        cellRenderer: (params: any) => {
          if (!params.value) {
            return 'Haga clic para subir archivo...';
          }
          const fileName = this.getFileNameFromUrl(params.value);
          return `${fileName} <i class="bi bi-eye ms-2" style="color: #6c757d; font-size: 0.9rem;"></i>`;
        },
        cellStyle: (params) => {
          if (!params.value) {
            return { cursor: 'pointer', color: '#999', fontStyle: 'italic' };
          }
          return { cursor: 'pointer', color: '#0066cc' };
        },
        onCellClicked: (params: any) => {
          if (!params.value) {
            // No hay archivo, abrir diálogo para subir
            this.openFileUpload(params);
          } else {
            // Hay archivo, abrir vista previa
            this.openPreviewModal(params);
          }
        }
      },

      {
        field: 'uuidCfdi',
        headerName: 'UUID CFDI/COMENTARIO',
        editable: true,
        width: 500,
        type: 'text',
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 36
        }
      }
    ];

    // Retornar la instancia inicializada
    return this._colDefsComprobacion;
  }

  public gridOptionsComprobacion: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    components: {
      selectWithTooltipEditorV2: SelectWithTooltipEditorV2Component
    },
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    }
  };

  addDocumento() {
    const tempId = `temp_doc_${this.tempDocumentoIdCounter++}`;
    const newDocumento = {
      id: tempId,
      idincorexp: this.params.data.id,
      idSpend: 0,
      tipoDocumento: 'PDF',
      uuidCfdi: '',
      nombreArchivo: '',
      valido: false,
      createdBy: this.context?.componentParent?.currentUser || 'Usuario',
      createdAt: new Date().toISOString(),
      modifiedBy: '',
      modifiedAt: new Date().toISOString(),
      active: true,
      __isNew: true,
      __modified: false
    };

    // Agregar al PRINCIPIO del array para que sea visible inmediatamente
    this.documentosData = [newDocumento, ...this.documentosData];
    this.hasUnsavedDocumentosChanges = true;
    this.gridApiDocumentos.setGridOption('rowData', this.documentosData);

    // Update count in master grid
    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.updateCount) {
      this.context.DOCUMENTOS_COMPROBADOS.updateCount(this.params.data.id, this.documentosData.length);
    }

    setTimeout(() => {
      // El nuevo registro está en el índice 0 (primera fila)
      const newRowIndex = 0;
      this.gridApiDocumentos.ensureIndexVisible(newRowIndex);
      this.gridApiDocumentos.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'idSpend'
      });
    }, 0);
  }

  async deleteSelectedDocumento() {
    const selectedRows = this.gridApiDocumentos.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un documento para eliminar', 'warning');
      return;
    }

    const selectedDocumento = selectedRows[0];

    // Mostrar confirmación antes de eliminar
    const result = await alerts.confirmAlert(
      '¿Eliminar documento?',
      `¿Está seguro que desea eliminar este documento comprobado? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    // Si es un registro nuevo (no guardado), eliminarlo solo localmente
    if (selectedDocumento.__isNew) {
      this.documentosData = this.documentosData.filter(doc => doc.id !== selectedDocumento.id);
      this.gridApiDocumentos.applyTransaction({ remove: [selectedDocumento] });
      this.hasUnsavedDocumentosChanges = true;

      // Update count in master grid
      if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.updateCount) {
        this.context.DOCUMENTOS_COMPROBADOS.updateCount(this.params.data.id, this.documentosData.length);
      }
      return;
    }

    // Si es un registro existente, llamar al servicio del padre
    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.delete) {
      // NO pasar el api, para que el padre NO haga applyTransaction
      this.context.DOCUMENTOS_COMPROBADOS.delete({ data: selectedDocumento }, () => {
        // Eliminar del array local
        this.documentosData = this.documentosData.filter(doc => doc.id !== selectedDocumento.id);

        // Eliminar del grid usando applyTransaction (más eficiente que setGridOption)
        this.gridApiDocumentos.applyTransaction({ remove: [selectedDocumento] });

        this.hasUnsavedDocumentosChanges = true;

        // Update count in master grid
        if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.updateCount) {
          this.context.DOCUMENTOS_COMPROBADOS.updateCount(this.params.data.id, this.documentosData.length);
        }
      });
    }
  }

  saveDocumentosChanges() {
    if (!this.hasUnsavedDocumentosChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Validar que todos los documentos tengan tipo de documento
    const hasEmptyFields = this.documentosData.some(doc =>
      !doc.tipoDocumento
    );

    if (hasEmptyFields) {
      alerts.basicAlert(
        'Validación',
        'Todos los documentos deben tener tipo de documento.',
        'error'
      );
      return;
    }

    // Validar que UUID CFDI no exceda 36 caracteres
    const hasInvalidUuid = this.documentosData.some(doc =>
      doc.uuidCfdi && doc.uuidCfdi.length > 36
    );

    if (hasInvalidUuid) {
      alerts.basicAlert(
        'Validación',
        'El UUID CFDI no puede exceder 36 caracteres.',
        'error'
      );
      return;
    }

    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.save) {
      const expenditureId = this.params.data.id;
      const dataToSave = {
        documentos: this.documentosData
      };
      this.context.DOCUMENTOS_COMPROBADOS.save(expenditureId, dataToSave);
      this.hasUnsavedDocumentosChanges = false;

      // Update the count in master grid after saving
      if (this.context.DOCUMENTOS_COMPROBADOS.updateCount) {
        this.context.DOCUMENTOS_COMPROBADOS.updateCount(expenditureId, this.documentosData.length);
      }
    }
  }

  discardDocumentosChanges() {
    if (!this.hasUnsavedDocumentosChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadDocumentosComprobados();
    this.hasUnsavedDocumentosChanges = false;
  }

  onDocumentoCellValueChanged(event: any) {
    event.data.__modified = true;
    event.data.modifiedBy = this.context?.componentParent?.currentUser || 'Usuario';
    event.data.modifiedAt = new Date().toISOString();
    this.hasUnsavedDocumentosChanges = true;
  }

  async printDocumentosReport() {
    if (this.documentosData.length === 0) {
      alerts.basicAlert('Sin documentos', 'No hay documentos para imprimir.', 'warning');
      return;
    }

    // Filtrar solo imágenes (todos los formatos de imagen soportados)
    const imagenes = this.documentosData.filter(doc =>
      ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(doc.tipoDocumento) ||
      (doc.nombreArchivo && (doc.nombreArchivo.toLowerCase().includes('.jpg') || doc.nombreArchivo.toLowerCase().includes('.jpeg') || doc.nombreArchivo.toLowerCase().includes('.png') || doc.nombreArchivo.toLowerCase().includes('.gif') || doc.nombreArchivo.toLowerCase().includes('.webp')))
    );

    if (imagenes.length === 0) {
      alerts.basicAlert('Sin imágenes', 'No hay imágenes válidas para generar el reporte fotográfico.', 'warning');
      return;
    }

    alerts.showLoadingWithProgress('Generando reporte...', 'Procesando imágenes...', 0);

    try {
      // 1. Obtener datos institucionales (Logos, Firmas)
      const rootService = this.context.rootService;
      const base64Service = this.context.base64EncodeService;
      const adminService = this.context.administrationService;
      const idRoot = this.context.idRoot;

      const rootResponse: any = await lastValueFrom(rootService.getRootbyId(idRoot));
      const setupManagementInfo: any = await lastValueFrom(adminService.getSetupManagementInfo(idRoot));
      const firmas = Array.isArray(setupManagementInfo) && setupManagementInfo.length > 0 ? setupManagementInfo[0] : null;

      // 2. Convertir Logos a Base64
      const logoBase64 = await base64Service.convertImageToBase64(rootResponse.picture);
      const logo2Base64 = rootResponse.picture2 ? await base64Service.convertImageToBase64(rootResponse.picture2) : logoBase64;
      const watermarkBase64 = rootResponse.picture3 ? await base64Service.convertImageToBase64(rootResponse.picture3) : null;

      // 3. Procesar imágenes del reporte
      const processedImages: { base64: string, descripcion: string }[] = [];
      let progress = 10;
      const step = 80 / imagenes.length;

      for (const img of imagenes) {
        try {
          const base64 = await this.getBase64ImageFromUrl(img.nombreArchivo);
          processedImages.push({
            base64: base64,
            descripcion: img.descripcion || ''
          });
        } catch (e) {
          console.error('Error cargando imagen', img, e);
        }
        progress += step;
        alerts.updateLoadingProgress('Generando reporte...', 'Procesando imágenes...', progress);
      }

      // 4. Construir grid de fotos - 3 o 4 fotos por hoja en formato horizontal
      // Determinar si usar 3 o 4 columnas según cantidad de fotos
      const totalPhotos = processedImages.length;
      const useThreeColumns = totalPhotos <= 3 || totalPhotos % 3 === 0;
      const photosPerRow = useThreeColumns ? 3 : 4;
      const photoWidth = useThreeColumns ? 220 : 170;  // Ajustar ancho según columnas
      const photoHeight = 180; // Alto de cada foto

      // Crear filas de fotos
      const photoRows: any[] = [];
      for (let i = 0; i < processedImages.length; i += photosPerRow) {
        const rowPhotos = processedImages.slice(i, i + photosPerRow);
        const row: any[] = [];

        for (const photo of rowPhotos) {
          row.push({
            stack: [
              {
                image: photo.base64,
                width: photoWidth,
                height: photoHeight,
                fit: [photoWidth, photoHeight],
                alignment: 'center'
              },
              {
                text: photo.descripcion || '',
                fontSize: 7,
                alignment: 'center',
                margin: [0, 3, 0, 0]
              }
            ],
            alignment: 'center',
            margin: [5, 5, 5, 10]
          });
        }

        // Completar fila con celdas vacías si es necesario
        while (row.length < photosPerRow) {
          row.push({ text: '', width: photoWidth });
        }

        photoRows.push(row);
      }

      // Construir anchos de columnas dinámicamente
      const columnWidths = Array(photosPerRow).fill(`${100 / photosPerRow}%`);

      // 5. Definición del PDF en formato HORIZONTAL (landscape)
      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape', // HORIZONTAL
        pageMargins: [40, 90, 40, 60],
        header: {
          margin: [40, 20, 40, 0],
          columns: [
            { image: 'logo', width: 60, alignment: 'left' },
            {
              stack: [
                { text: rootResponse.name || 'H. JUNTA MUNICIPAL', style: 'headerTitle', alignment: 'center' },
                { text: 'REPORTE FOTOGRÁFICO', style: 'reportTitle', alignment: 'center', margin: [0, 5, 0, 0] },
                { text: `Documento: ${this.expenditureData?.numberDocument || 'S/N'}`, style: 'headerAddress', alignment: 'center', margin: [0, 3, 0, 0] }
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
          // Información del egreso
          {
            columns: [
              { text: [{ text: 'FECHA: ', bold: true }, { text: this.formatDate(this.expenditureData?.date) }], fontSize: 9 },
              { text: [{ text: 'DESCRIPCIÓN: ', bold: true }, { text: this.expenditureData?.description || '' }], fontSize: 9 }
            ],
            margin: [0, 0, 0, 15]
          },
          // Tabla con todas las fotos (3-4 por fila) - centrada verticalmente
          {
            table: {
              widths: columnWidths,
              body: photoRows
            },
            layout: 'noBorders',
            margin: [0, 30, 0, 30]
          },
          // Sección de firmas al final
          { text: 'FIRMAS DE AUTORIZACIÓN', style: 'sectionTitle', alignment: 'center', margin: [0, 20, 0, 15] },
          {
            table: {
              widths: ['33%', '34%', '33%'],
              body: [
                [
                  { text: firmas?.administratorTitle || 'TESORERO', style: 'signatureTitle', alignment: 'center' },
                  { text: firmas?.gerencyTitle || 'SINDICO DE HACIENDA', style: 'signatureTitle', alignment: 'center' },
                  { text: firmas?.directorTitle || 'PRESIDENTE', style: 'signatureTitle', alignment: 'center' }
                ],
                [
                  { text: '________________________________', alignment: 'center', margin: [0, 25, 0, 0] },
                  { text: '________________________________', alignment: 'center', margin: [0, 25, 0, 0] },
                  { text: '________________________________', alignment: 'center', margin: [0, 25, 0, 0] }
                ],
                [
                  { text: firmas?.administratorName || '', style: 'signatureName', alignment: 'center' },
                  { text: firmas?.gerencyName || '', style: 'signatureName', alignment: 'center' },
                  { text: firmas?.directorName || '', style: 'signatureName', alignment: 'center' }
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

      alerts.closeLoading();

      // Manejar popup blocker
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió/abrió PDF reporte fotográfico egreso palacio', 'Admon / Egresos Palacio', this.trackingService.getEmail());
      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch (error) {
        pdf.download(`Reporte_Fotografico_${this.expenditureData?.numberDocument || 'SN'}_${new Date().getTime()}.pdf`);
        alerts.basicAlert(
          'Reporte descargado',
          'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.',
          'info'
        );
      }

    } catch (error) {
      console.error(error);
      alerts.closeLoading();
      alerts.basicAlert('Error', 'Error al generar el reporte.', 'error');
    }
  }

  async getBase64ImageFromUrl(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  getFileNameFromUrl(url: string): string {
    if (!url) return 'Sin archivo';
    try {
      // Extraer el nombre del archivo de la URL de Firebase
      // Ejemplo: "images%2Fcl8oc%20delphi.png" -> "delphi.png"
      const match = url.match(/([^\/]+)\?alt=media/);
      if (match) {
        const encodedName = match[1];
        const decodedName = decodeURIComponent(encodedName);
        // Obtener solo el nombre del archivo sin la ruta
        const parts = decodedName.split('/');
        return parts[parts.length - 1];
      }
      return 'Archivo';
    } catch (error) {
      console.error('Error extrayendo nombre de archivo:', error);
      return 'Archivo';
    }
  }

  openFileUpload(params: any) {
    const input = document.createElement('input');
    input.type = 'file';

    // Determinar tipo de archivo según tipoDocumento
    const tipoDoc = params.data.tipoDocumento;
    if (tipoDoc === 'JPG' || tipoDoc === 'JPEG') {
      input.accept = 'image/jpeg,image/jpg';
    } else if (tipoDoc === 'PNG') {
      input.accept = 'image/png';
    } else if (tipoDoc === 'GIF') {
      input.accept = 'image/gif';
    } else if (tipoDoc === 'WEBP') {
      input.accept = 'image/webp';
    } else if (tipoDoc === 'PDF') {
      input.accept = 'application/pdf';
    } else if (tipoDoc === 'XML') {
      input.accept = 'text/xml,application/xml';
    } else {
      input.accept = '*/*';
    }

    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        // Validar tipo de archivo
        if ((tipoDoc === 'JPG' || tipoDoc === 'JPEG') && !file.type.includes('image/jpeg')) {
          alerts.basicAlert('Error de tipo', 'Por favor seleccione un archivo JPG/JPEG válido', 'error');
          return;
        }
        if (tipoDoc === 'PNG' && file.type !== 'image/png') {
          alerts.basicAlert('Error de tipo', 'Por favor seleccione un archivo PNG válido', 'error');
          return;
        }
        if (tipoDoc === 'GIF' && file.type !== 'image/gif') {
          alerts.basicAlert('Error de tipo', 'Por favor seleccione un archivo GIF válido', 'error');
          return;
        }
        if (tipoDoc === 'WEBP' && file.type !== 'image/webp') {
          alerts.basicAlert('Error de tipo', 'Por favor seleccione un archivo WEBP válido', 'error');
          return;
        }
        if (tipoDoc === 'PDF' && file.type !== 'application/pdf') {
          alerts.basicAlert('Error de tipo', 'Por favor seleccione un archivo PDF válido', 'error');
          return;
        }
        if (tipoDoc === 'XML' && !file.type.includes('xml')) {
          alerts.basicAlert('Error de tipo', 'Por favor seleccione un archivo XML válido', 'error');
          return;
        }

        // Validar tamaño del archivo (máximo 10 MB)
        const maxSize = 10 * 1024 * 1024; // 10 MB en bytes
        if (file.size > maxSize) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          alerts.basicAlert(
            'Archivo muy grande',
            `El archivo pesa ${sizeMB} MB. El tamaño máximo permitido es 10 MB.`,
            'error'
          );
          return;
        }

        // Validar nombre del archivo (máximo 100 caracteres)
        if (file.name.length > 100) {
          alerts.basicAlert(
            'Nombre muy largo',
            `El nombre del archivo tiene ${file.name.length} caracteres. El máximo permitido es 100 caracteres.`,
            'error'
          );
          return;
        }

        // Mostrar loading y iniciar progreso
        this.isUploading = true;
        this.uploadProgress = 0;
        alerts.basicAlert('Subiendo archivo...', 'Por favor espere', 'info');

        // Subir archivo a Firebase
        const downloadURL = await this.uploadFileToFirebase(file, tipoDoc);

        // Actualizar la fila con la URL
        params.data.nombreArchivo = downloadURL;
        params.data.__modified = true;
        params.data.modifiedBy = this.context?.componentParent?.currentUser || 'Usuario';
        params.data.modifiedAt = new Date().toISOString();
        this.hasUnsavedDocumentosChanges = true;

        // Refrescar la celda
        this.gridApiDocumentos.refreshCells({
          rowNodes: [params.node],
          columns: ['nombreArchivo'],
          force: true
        });

        alerts.basicAlert('Éxito', 'Archivo subido correctamente', 'success');
      } catch (error: any) {
        this.isUploading = false;
        this.uploadProgress = 0;

        // Mostrar mensaje de error específico
        let errorMessage = 'Error al subir el archivo';
        if (error?.message) {
          errorMessage += `: ${error.message}`;
        } else if (error?.code) {
          errorMessage += `: Código ${error.code}`;
        }

        alerts.basicAlert('Error de subida', errorMessage, 'error');
      }
    };

    input.click();
  }

  async uploadFileToFirebase(file: File, tipoDoc: string): Promise<string> {
    // Importar Firebase Storage y la app inicializada
    const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
    const { app } = await import('app/firebase.config');

    const storage = getStorage(app);

    // Determinar la carpeta según el tipo de documento
    let folder = 'documents';
    if (tipoDoc === 'JPG') {
      folder = 'images';
    } else if (tipoDoc === 'PDF') {
      folder = 'pdf';
    } else if (tipoDoc === 'XML') {
      folder = 'xml';
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);

    // Subir archivo con progreso
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          // Calcular y actualizar progreso
          this.uploadProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        },
        (error) => {
          // Error
          this.isUploading = false;
          this.uploadProgress = 0;
          reject(error);
        },
        async () => {
          // Éxito
          this.isUploading = false;
          this.uploadProgress = 0;
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  openPreviewModal(params: any) {
    const fileUrl = params.data.nombreArchivo;
    const fileType = params.data.tipoDocumento;
    const fileName = this.getFileNameFromUrl(fileUrl);

    if (!fileUrl || fileUrl.trim() === '') {
      alerts.basicAlert('Sin archivo', 'No hay archivo para mostrar', 'warning');
      return;
    }

    this.previewFileName = fileName;
    this.previewFileType = fileType;
    this.previewFileRawUrl = fileUrl;

    // Para PDFs e imágenes, usar DomSanitizer para crear URL segura
    if (fileType === 'PDF' || fileType === 'JPG') {
      this.previewFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileUrl);
    } else if (fileType === 'XML') {
      // Para XML, cargar el contenido del archivo
      this.loadXmlContent(fileUrl);
    }

    this.showPreviewModal = true;
  }

  async loadXmlContent(url: string) {
    try {
      const response = await fetch(url);
      const xmlText = await response.text();
      this.previewFileRawUrl = xmlText;
    } catch (error) {
      console.error('Error cargando XML:', error);
      this.previewFileRawUrl = 'Error al cargar el archivo XML';
    }
  }

  closePreviewModal() {
    this.showPreviewModal = false;
    this.previewFileUrl = null;
    this.previewFileName = '';
    this.previewFileType = '';
    this.previewFileRawUrl = '';
  }

  @HostListener('document:keydown.f10', ['$event'])
  handleKeyboardEvent(event: Event) {
    // Verificar si estamos en modo conceptos y hay cambios
    if (this.detailType === 'concepts' && this.hasUnsavedChanges) {
      event.preventDefault();
      event.stopPropagation();

      if (this.gridApi) {
        this.gridApi.stopEditing();
      }

      setTimeout(() => {
        this.saveChanges();
      }, 100);
    } else if (this.detailType === 'comprobacion' && this.hasUnsavedDocumentosChanges) {
      event.preventDefault();
      event.stopPropagation();
      if (this.gridApiDocumentos) {
        this.gridApiDocumentos.stopEditing();
      }
      setTimeout(() => {
        this.saveDocumentosChanges();
      }, 100);
    }
  }

  ngOnDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
  }
}
