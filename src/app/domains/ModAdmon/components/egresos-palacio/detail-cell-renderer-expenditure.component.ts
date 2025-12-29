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
import { ProviderModalService } from './services/provider-modal.service';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detail-cell-renderer-expenditure',
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
        <div class="d-flex">
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
        style="height: 700px; width: 100%;">
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
      <div class="report-content" style="height: 700px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
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
    <div class="detail-grid-container" *ngIf="detailType === 'comprobacion'">
      <div class="detail-actions mb-2">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Documentos Comprobados</h6>
          <div *ngIf="isUploading" class="progress" style="width: 200px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" [style.width.%]="uploadProgress" [attr.aria-valuenow]="uploadProgress" aria-valuemin="0" aria-valuemax="100">
              {{uploadProgress | number:'1.0-0'}}%
            </div>
          </div>
        </div>
        <div class="d-flex">
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
        style="height: 700px; width: 100%;">
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
export class DetailCellRendererExpenditureComponent implements OnInit, OnDestroy {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private gridApiDocumentos!: GridApi;
  private context: any;
  private sanitizer = inject(DomSanitizer);
  private customersService = inject(CustomersService);
  private employeesService = inject(EmployeesService);
  private providerModalService = inject(ProviderModalService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  measures: any[] = [];
  objetosImpuesto: any[] = [];
  ivaPercent: number = 0;
  objetosGastoHijos: any[] = []; // Objetos de gasto nivel 4 (hijos del objeto de gasto seleccionado nivel 1)
  objetosGastoNivel1: any[] = []; // Objetos de gasto nivel 1 (para agrupar en reporte)
  setupManagementInfo: any = null; // Información de firmas
  lastSelectedIdCatIng: number = 0; // Para copiar el último objeto de gasto seleccionado
  providers: any[] = []; // Proveedores para el combo box
  loadedTypeComps: any[] = []; // Tipos de comprobante cargados (para evitar recargarlos)

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

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.expenditureData = params.data;
    this.detailType = params.data.detailType || 'concepts';

    if (this.detailType === 'concepts') {
      this.getBillingManagementInfo();
      this.loadObjetosGastoHijos(); // Cargar los objetos de gasto nivel 4
      this.loadConceptsData();
    } else if (this.detailType === 'report') {
      this.loadConceptsDataForReport();
    } else if (this.detailType === 'comprobacion') {
      this.loadProviders(); // Cargar proveedores para el combo box
      this.loadDocumentosComprobados();
    }
  }

  loadConceptsData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        this.rowData = data.map(concept => ({
          ...concept,
          __isNew: false,
          __modified: false
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
          this.context.CONCEPTS.updateCount(expenditureId, this.rowData.length);
        }
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

  loadObjetosGastoHijos() {
    if (!this.context || !this.context.administrationService) {
      console.warn('No se puede cargar objetos de gasto: falta administrationService');
      this.objetosGastoHijos = [];
      return;
    }

    // Verificar si el checkbox "Mostrar Todos" está activado
    const mostrarTodos = this.expenditureData?.mostrartodo === true;

    if (mostrarTodos) {
      // ✅ Checkbox ACTIVO → Mostrar TODOS los objetos de nivel 4
      console.log('🔵 Checkbox ACTIVO - Cargando TODOS los objetos de nivel 4');
      this.context.administrationService.getByNivelObjeto(this.context.idRoot, 4).subscribe({
        next: (data: any[]) => {
          // Formatear resultado: crear codigoNombre desde codigo + " - " + nombre
          this.objetosGastoHijos = (data || []).map(obj => ({
            id: obj.id,
            codigoNombre: `${obj.codigo} - ${obj.nombre}`,
            displayText: `${obj.codigo} - ${obj.nombre}`
          }));

          // Actualizar las columnas del grid con los nuevos valores
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
          console.log('✅ Todos los objetos de nivel 4 cargados:', this.objetosGastoHijos.length);
        },
        error: (error) => {
          console.error('❌ Error loading todos los objetos nivel 4:', error);
          this.objetosGastoHijos = [];
        }
      });
    } else {
      // ✅ Checkbox INACTIVO → Mostrar solo objetos CONDICIONADOS (hijos del objeto específico)
      const objetoGastoCodigo = this.expenditureData?.objetoGastoCodigo;

      if (!objetoGastoCodigo) {
        console.warn('No se puede cargar objetos condicionados: falta objetoGastoCodigo');
        this.objetosGastoHijos = [];
        return;
      }

      console.log('🔵 Checkbox INACTIVO - Cargando objetos CONDICIONADOS del objeto:', objetoGastoCodigo);
      // Usar getEspecifica para obtener solo los hijos del objeto específico
      this.context.administrationService.getEspecifica(this.context.idRoot, objetoGastoCodigo).subscribe({
        next: (data: any[]) => {
          // Formatear resultado: ya viene con codigoNombre
          this.objetosGastoHijos = (data || []).map(obj => ({
            id: obj.id,
            codigoNombre: obj.codigoNombre,
            displayText: obj.codigoNombre
          }));

          // Actualizar las columnas del grid con los nuevos valores
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
          console.log('✅ Objetos condicionados cargados:', this.objetosGastoHijos.length);
        },
        error: (error) => {
          console.error('❌ Error loading objetos condicionados:', error);
          this.objetosGastoHijos = [];
        }
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

    if (isEmpleadosType) {
      // Cargar empleados cuando el tipo de comprobante es "Empleados"
      const idBranch = this.context?.componentParent?.idBranch; 
      const idBranchNegative = -Math.abs(idBranch); // Valor negativo del idBranch

      this.employeesService.getEmployees(idBranchNegative).subscribe({
        next: (data: any[]) => {
          // Mapear los empleados con name
          this.providers = (data || []).map(employee => ({
            id: employee.id,
            displayText: employee.name || 'Sin nombre'
          }));

          // Actualizar las columnas del grid con los nuevos valores
          if (this.gridApiDocumentos) {
            this.gridApiDocumentos.setGridOption('columnDefs', this.colDefsComprobacion);
          }
        },
        error: (error) => {
          console.error('Error loading employees:', error);
          this.providers = [];
        }
      });
    } else {
      // Cargar proveedores (comportamiento original)
      this.customersService.getCustomersByCompany(idRoot, 'PROVIDERS').subscribe({
        next: (data: any[]) => {
          // Mapear los proveedores solo con name (company)
          this.providers = (data || []).map(provider => ({
            id: provider.id,
            displayText: provider.name || 'Sin nombre'
          }));

          // Actualizar las columnas del grid con los nuevos valores
          if (this.gridApiDocumentos) {
            this.gridApiDocumentos.setGridOption('columnDefs', this.colDefsComprobacion);
          }
        },
        error: (error) => {
          console.error('Error loading providers:', error);
          this.providers = [];
        }
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

    // Refrescar las columnas después de que los datos se carguen
    // para asegurar que los combo boxes tengan las opciones correctas
    setTimeout(() => {
      if (this.gridApi && this.objetosGastoHijos.length > 0) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
      }
    }, 500);
  }

  get colDefs(): ColDef[] {
    return [
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
          maxLength: 100,
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
        width: 150,
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
        editable: false,
        width: 80,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
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
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
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

    this.rowData = [...this.rowData, newConcept];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Update count in master grid
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
      this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
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

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.delete) {
      this.context.CONCEPTS.delete({ data: selectedConcept, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(concept => concept.id !== selectedConcept.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;
        this.recalculateTotals();

        // Update count in master grid
        if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
          this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Filtrar solo los conceptos con precio mayor a 0
    const validConcepts = this.rowData.filter(concept =>
      concept.price && Number(concept.price) > 0
    );

    // Si no hay conceptos válidos, mostrar mensaje
    if (validConcepts.length === 0) {
      alerts.basicAlert(
        'Validación',
        'Debe haber al menos un concepto con precio mayor a 0 para guardar.',
        'warning'
      );
      return;
    }

    // Validar que todos los conceptos válidos tengan campos obligatorios
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

    // Eliminar de rowData los conceptos con precio = 0
    this.rowData = validConcepts;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Recalcular totales con solo los conceptos válidos
    this.recalculateTotals();

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.save) {
      const expenditureId = this.params.data.id;
      const dataToSave = {
        concepts: validConcepts, // Solo guardar conceptos con precio > 0
        subtotal: this.subtotal,
        tax: this.iva2,
        isr: this.isr,
        total: this.total
      };
      this.context.CONCEPTS.save(expenditureId, dataToSave);
      this.hasUnsavedChanges = false;
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

    if (['iva', 'quantity', 'price', 'aplicaIsr', 'isr'].includes(event.colDef.field)) {
      const rowData = event.data;

      if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
        rowData.total = Number(rowData.quantity || 0) * Number(rowData.price || 0);
      }

      if (event.colDef.field === 'aplicaIsr') {
        if (!rowData.aplicaIsr) {
          rowData.isr = 0;
        }
      }

      rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;

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
      this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
      this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
      this.isr = this.rowData.reduce((acc, row) => acc + (Number(row.isr) || 0), 0);
      const totalFinalSum = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
      this.total = totalFinalSum;

      // Actualizar el maestro inmediatamente con los nuevos totales
      this.updateMasterTotals();
    } catch (error) {
      console.error('Error recalculando totales:', error);
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
        widths: [50, 180, '*', 80],
        body: [
          // Encabezados
          [
            { text: 'Fecha', style: 'tableHeader' },
            { text: 'NUMERO DE RECIBO O FOLIO FISCAL (FACTURA)', style: 'tableHeader' },
            { text: 'Descripción', style: 'tableHeader' },
            { text: 'Total', style: 'tableHeader', alignment: 'right' }
          ],
          // Filas de conceptos
          ...this.rowData.map(concept => [
            { text: this.formatDate(concept.dateExpend), style: 'tableCell', fontSize: 6 },
            { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 6 },
            { text: concept.description || '', style: 'tableCell' },
            { text: this.formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
          ]),
          // Fila de totales
          [
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
   */
  private generarTablaAgrupada(): any[] {
    const elementos: any[] = [];

    // Agrupar conceptos
    const grupos = this.agruparConceptosPorNivel1();

    // Convertir el Map a array y ordenar por código
    const gruposOrdenados = Array.from(grupos.entries()).sort((a, b) => {
      if (a[0] === 'sin-clasificar') return 1;
      if (b[0] === 'sin-clasificar') return -1;
      return a[0].localeCompare(b[0]);
    });

    // Generar una tabla por cada grupo
    gruposOrdenados.forEach(([codigoNivel1, grupo], index) => {
      // Línea separadora (solo después del primer grupo)
      if (index > 0) {
        elementos.push({
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#cccccc'
            }
          ],
          margin: [0, 10, 0, 10]
        });
      }

      // Título del grupo (Objeto Nivel 1)
      elementos.push({
        text: grupo.nivel1Info.codigoNombre,
        style: 'groupTitle',
        margin: [0, 10, 0, 5]
      });

      // Tabla de conceptos del grupo
      elementos.push({
        table: {
          headerRows: 1,
          widths: [50, 180, '*', 80],
          body: [
            // Encabezados
            [
              { text: 'Fecha', style: 'tableHeader' },
              { text: 'FOLIO FISCAL', style: 'tableHeader' },
              { text: 'Descripción', style: 'tableHeader' },
              { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ],
            // Filas de conceptos del grupo
            ...grupo.conceptos.map((concept: any) => [
              { text: this.formatDate(concept.dateExpend), style: 'tableCell', fontSize: 6 },
              { text: concept.numeroIdentificacion || '', style: 'tableCell', fontSize: 6 },
              { text: concept.description || '', style: 'tableCell' },
              { text: this.formatCurrency(concept.totalFinal || 0), style: 'tableCell', alignment: 'right' }
            ]),
            // Fila de subtotal del grupo
            [
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
    });

    // Línea separadora final
    elementos.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 2,
          lineColor: '#333333'
        }
      ],
      margin: [0, 15, 0, 5]
    });

    // Total general
    elementos.push({
      columns: [
        { text: '', width: '*' },
        { text: '', width: 170 },
        { text: 'TOTAL GENERAL:', style: 'totalLabel', alignment: 'right', width: 100 },
        { text: this.formatCurrency(this.total), style: 'totalValue', alignment: 'right', width: 80 }
      ],
      margin: [0, 5, 0, 20]
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

      // Convertir picture3 (marca de agua) a Base64
      const watermarkBase64 = rootResponse.picture3
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture3)
        : null;

      // Crear la estructura del documento PDF
      const docDefinition: any = {
        pageSize: 'LETTER',
        pageMargins: [40, 60, 40, 60],
        background: watermarkBase64 ? [
          {
            image: 'watermark',
            width: 400,
            opacity: 0.15,
            absolutePosition: { x: 106, y: 250 }
          }
        ] : [],
        content: [
          // Header con logo y título
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
          // DETALLES DEL EGRESO (Maestro)
          {
            text: 'DETALLES DEL EGRESO',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          {
            table: {
              widths: ['25%', '75%'],
              body: [
                [
                  { text: 'FECHA PAGO:', style: 'masterLabel' },
                  { text: this.formatDate(this.expenditureData?.date), style: 'masterValue' }
                ],
                [
                  { text: 'OBJETO DE GASTO:', style: 'masterLabel' },
                  {
                    text: `${this.getObjetoGastoText()}        $ ${this.formatCurrency(this.expenditureData?.total || 0)}`,
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
          },
          // Tabla de Conceptos (Detalle) - Condicional según mostrartodo
          ...(this.expenditureData?.mostrartodo === true
            ? this.generarTablaAgrupada()
            : [this.generarTablaSimple()]),
          // Footer con Firmas
          {
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
          }
        ],
        images: watermarkBase64 ? {
          logo: logoBase64,
          watermark: watermarkBase64
        } : {
          logo: logoBase64
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
          }
        }
      };

      // Generar el PDF
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
    return amount.toLocaleString('es-MX', {
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

  // ==================== MÉTODOS PARA DOCUMENTOS COMPROBADOS ====================

  loadDocumentosComprobados() {
    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.load) {
      const expenditureId = this.params.data.id;
      this.context.DOCUMENTOS_COMPROBADOS.load(expenditureId, (data: any[]) => {
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
          this.context.DOCUMENTOS_COMPROBADOS.updateCount(expenditureId, this.documentosData.length);
        }
      });
    }
  }

  onDocumentosGridReady(params: GridReadyEvent) {
    this.gridApiDocumentos = params.api;
    this.gridApiDocumentos.setGridOption('columnDefs', this.colDefsComprobacion);

    // Refrescar las columnas después de que los proveedores/empleados se carguen
    // para asegurar que el combo box tenga las opciones correctas
    setTimeout(() => {
      if (this.gridApiDocumentos && this.providers.length > 0) {
        this.gridApiDocumentos.setGridOption('columnDefs', this.colDefsComprobacion);
      }
    }, 500);
  }

  get colDefsComprobacion(): ColDef[] {
    // Determinar el nombre de la columna según el tipo de comprobante
    const isEmpleados = this.isEmpleadosComprobante();
    const providerColumnName = isEmpleados ? 'Empleado' : 'Proveedor';

    return [
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
          values: ['JPG', 'PDF', 'XML']
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

    this.documentosData = [...this.documentosData, newDocumento];
    this.hasUnsavedDocumentosChanges = true;
    this.gridApiDocumentos.setGridOption('rowData', this.documentosData);

    // Update count in master grid
    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.updateCount) {
      this.context.DOCUMENTOS_COMPROBADOS.updateCount(this.params.data.id, this.documentosData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.documentosData.length - 1;
      this.gridApiDocumentos.ensureIndexVisible(lastRowIndex);
      this.gridApiDocumentos.startEditingCell({
        rowIndex: lastRowIndex,
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

    if (this.context && this.context.DOCUMENTOS_COMPROBADOS && this.context.DOCUMENTOS_COMPROBADOS.delete) {
      this.context.DOCUMENTOS_COMPROBADOS.delete({ data: selectedDocumento, api: this.gridApiDocumentos }, () => {
        this.documentosData = this.documentosData.filter(doc => doc.id !== selectedDocumento.id);
        this.gridApiDocumentos.setGridOption('rowData', this.documentosData);
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
    if (tipoDoc === 'JPG') {
      input.accept = 'image/jpeg,image/jpg';
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
        if (tipoDoc === 'JPG' && !file.type.includes('image/jpeg')) {
          alerts.basicAlert('Error', 'Por favor seleccione un archivo JPG', 'error');
          return;
        }
        if (tipoDoc === 'PDF' && file.type !== 'application/pdf') {
          alerts.basicAlert('Error', 'Por favor seleccione un archivo PDF', 'error');
          return;
        }
        if (tipoDoc === 'XML' && !file.type.includes('xml')) {
          alerts.basicAlert('Error', 'Por favor seleccione un archivo XML', 'error');
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
      } catch (error) {
        console.error('Error subiendo archivo:', error);
        this.isUploading = false;
        this.uploadProgress = 0;
        alerts.basicAlert('Error', 'Error al subir el archivo', 'error');
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
