import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

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
          <span class="badge bg-primary">Total: {{ total | currency:'MXN' }}</span>
        </div>
        <div class="d-flex">
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
        style="height: 400px; width: 100%;">
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
          <button class="btn btn-success btn-sm me-2" (click)="addDocumento()">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-warning btn-sm me-2" (click)="discardDocumentosChanges()">
            <i class="bi bi-arrow-counterclockwise"></i> Deshacer
          </button>
          <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedDocumento()">
            <i class="bi bi-trash"></i> Eliminar
          </button>
          <button class="btn btn-primary btn-sm position-relative" (click)="saveDocumentosChanges()">
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
        style="height: 400px; width: 100%;">
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

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  measures: any[] = [];
  objetosImpuesto: any[] = [];
  ivaPercent: number = 0;
  objetosGastoHijos: any[] = []; // Objetos de gasto nivel 4 (hijos del objeto de gasto seleccionado nivel 1)
  setupManagementInfo: any = null; // Información de firmas
  lastSelectedIdCatIng: number = 0; // Para copiar el último objeto de gasto seleccionado

  // Totals
  subtotal: number = 0;
  iva2: number = 0;
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

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Initial load will happen in agInit
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.expenditureData = params.data;
    this.detailType = params.data.detailType || 'concepts';

    if (this.detailType === 'concepts') {
      this.loadSATCatalogs();
      this.getBillingManagementInfo();
      this.loadObjetosGastoHijos(); // Cargar los objetos de gasto nivel 4
      this.loadConceptsData();
    } else if (this.detailType === 'report') {
      this.loadConceptsDataForReport();
    } else if (this.detailType === 'comprobacion') {
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
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        this.recalculateTotals();
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

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        this.rowData = data;
        this.recalculateTotals();
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

  loadSATCatalogs() {
    if (this.context && this.context.administrationService) {
      this.context.administrationService.getObjetosImpuesto().subscribe({
        next: (data: any[]) => {
          this.objetosImpuesto = data || [];
        },
        error: (err) => {
          console.error('Error loading Objetos Impuesto:', err);
          this.objetosImpuesto = [];
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
    // Obtener el idExpend del registro maestro (que ahora es el objeto de gasto nivel 1)
    const idExpend = this.expenditureData?.idExpend;

    if (!idExpend || !this.context || !this.context.administrationService) {
      console.warn('No se puede cargar objetos de gasto hijos: falta idExpend o administrationService');
      this.objetosGastoHijos = [];
      return;
    }

    // Llamar al endpoint para obtener los objetos de gasto nivel 4
    this.context.administrationService.getByNivelObjeto(this.context.idRoot, 4).subscribe({
      next: (data: any[]) => {
        // Agregar campo displayText para búsqueda combinando codigo + nombre
        this.objetosGastoHijos = (data || []).map(obj => ({
          ...obj,
          displayText: `${obj.codigo} - ${obj.nombre}`
        }));
        console.log('Objetos de gasto nivel 4 cargados:', this.objetosGastoHijos);

        // Actualizar las columnas del grid con los nuevos valores
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.colDefs);
        }
      },
      error: (error) => {
        console.error('Error loading objetos de gasto nivel 4:', error);
        this.objetosGastoHijos = [];
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
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
        width: 100,
        valueFormatter: (params) => this.formatDate(params.value)
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        type: 'number',
        editable: true,
        width: 90
      },
      {
        field: 'idCatIng',
        headerName: 'Detalle Egreso',
        editable: true,
        width: 480,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: {
          options: this.objetosGastoHijos.map(obj => ({
            id: obj.id,
            description: obj.displayText,
            valueAddition: obj.codigo || '',
            valueAddition2: obj.nombre || ''
          }))
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.objetosGastoHijos.find(obj => obj.id === params.value);
          return found ? found.displayText : params.value;
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
        width: 250
      },
      {
        field: 'claveUnidad',
        headerName: 'Clave Unidad',
        editable: true,
        hide: true,
        width: 120,
        cellEditor: 'searchableSelect',
        cellEditorParams: {
          searchFunction: (searchText: string) => {
            return this.context.administrationService.getUnitsSATSearch(searchText);
          },
          displayField: 'texto',
          valueField: 'idClavesUnidades',
          placeholder: 'Buscar unidad...'
        }
      },
      {
        field: 'objetoImp',
        headerName: 'Objeto Impuesto',
        hide: true,
        editable: true,
        width: 140,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.objetosImpuesto.map(obj => obj.objeto)
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.objetosImpuesto.find(obj => obj.objeto === params.value);
          return found ? `${found.objeto} - ${found.descripcion}` : params.value;
        }
      },
      {
        field: 'claveProdServ',
        headerName: 'Producto/Servicio',
        editable: true,
        hide: true,
        width: 150,
        cellEditor: 'searchableSelect',
        cellEditorParams: {
          searchFunction: (searchText: string) => {
            return this.context.administrationService.getProductsAndServicesSAT(searchText);
          },
          displayField: 'texto',
          valueField: 'idProductosServicios',
          placeholder: 'Buscar producto o servicio...'
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
        headerName: '¿Aplica IVA?',
        type: 'boolean',
        editable: true,
        width: 80
      },
      {
        field: 'iva2',
        headerName: 'Valor IVA',
        type: 'number',
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
    
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        width: 200,
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
    searchableSelect: SearchableSelectComponent
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
      comment: '',
      active: true,
      __isNew: true,
      __modified: false
    };

    // Si se proporciona idCatIng, establecer automáticamente la descripción
    if (idCatIng) {
      const selectedObjeto = this.objetosGastoHijos.find(obj => obj.id === idCatIng);
      if (selectedObjeto) {
        newConcept.description = selectedObjeto.displayText;
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
        colKey: idCatIng ? 'price' : 'idCatIng' // Focus en Precio si es copia, sino en Detalle Egreso
      });
    }, 0);
  }

  deleteSelectedConcept() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un concepto para eliminar', 'warning');
      return;
    }

    const selectedConcept = selectedRows[0];
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
        // Copiar el displayText (codigo - nombre) del objeto de gasto al campo Concepto
        event.data.description = selectedObjeto.displayText;

        // Establecer la fecha igual a la fecha de pago del maestro
        event.data.dateExpend = this.params.data.date;

        // Actualizar la fila en el grid
        if (this.gridApi) {
          setTimeout(() => {
            this.gridApi.applyTransactionAsync({
              update: [event.data]
            });
          }, 0);
        }
      }
    }

    if (['iva', 'quantity', 'price'].includes(event.colDef.field)) {
      const rowData = event.data;

      if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
        rowData.total = Number(rowData.quantity || 0) * Number(rowData.price || 0);
      }

      rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;

      if (this.gridApi) {
        this.gridApi.applyTransactionAsync({
          update: [rowData]
        });
      }

      this.recalculateTotals();
    }
  }

  private recalculateTotals() {
    try {
      this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
      this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
      this.total = this.subtotal + this.iva2;
    } catch (error) {
      console.error('Error recalculando totales:', error);
      this.subtotal = 0;
      this.iva2 = 0;
      this.total = 0;
    }
  }

  closeReport() {
    // Emit event to parent component to handle collapse
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapseReportDetail(this.expenditureData.id);
    }
  }

  private async generateReport() {
    try {
      console.log('=== Generando Reporte PDF de Egreso ===');

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
                    text: this.getCurrentDateTime(),
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
          // Tabla de Conceptos (Detalle)
          {
            table: {
              headerRows: 1,
              widths: ['*', 50, 80, 70],
              body: [
                // Encabezados
                [
                  { text: 'Descripción', style: 'tableHeader' },
                  { text: 'Cant.', style: 'tableHeader', alignment: 'center' },
                  { text: 'Unidad', style: 'tableHeader', alignment: 'center' },
                  { text: 'Total', style: 'tableHeader', alignment: 'right' }
                ],
                // Filas de conceptos
                ...this.rowData.map(concept => [
                  { text: concept.description || '', style: 'tableCell' },
                  { text: concept.quantity || '', style: 'tableCell', alignment: 'center' },
                  { text: concept.unit || '', style: 'tableCell', alignment: 'center', fontSize: 7 },
                  { text: this.formatCurrency(concept.total || 0), style: 'tableCell', alignment: 'right' }
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
          },
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

  private formatDate(dateString: string | null | undefined): string {
    if (!dateString) {
      return 'Sin fecha';
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Error en fecha';
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

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private getObjetoGastoText(): string {
    // Usar el texto del objeto de gasto que fue preparado en toggleReportDetail
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
  }

  get colDefsComprobacion(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 60,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
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
        width: 550,
        editable: false,
        cellRenderer: (params: any) => {
          const hasFile = params.value && params.value.trim() !== '';
          const fileName = hasFile ? this.getFileNameFromUrl(params.value) : 'Sin archivo';
          const buttonClass = hasFile ? 'btn-success' : 'btn-primary';
          const icon = hasFile ? 'bi-file-check' : 'bi-upload';
          const previewButton = hasFile ? `
            <button class="btn btn-info btn-sm preview-file-btn"
                    data-row-id="${params.node.id}"
                    title="Ver vista previa">
              <i class="bi bi-eye"></i>
            </button>
          ` : '';
          return `
            <div class="d-flex align-items-center gap-2">
              <button class="btn ${buttonClass} btn-sm upload-file-btn"
                      data-row-id="${params.node.id}"
                      title="Subir archivo">
                <i class="bi ${icon}"></i>
              </button>
              ${previewButton}
              <span class="text-truncate" style="font-size: 0.85rem;">${fileName}</span>
            </div>
          `;
        },
        onCellClicked: (params: any) => {
          const target = params.event.target as HTMLElement;
          if (target.classList.contains('upload-file-btn') || target.closest('.upload-file-btn')) {
            this.openFileUpload(params);
          } else if (target.classList.contains('preview-file-btn') || target.closest('.preview-file-btn')) {
            this.openPreviewModal(params);
          }
        }
      },
    
      {
        field: 'uuidCfdi',
        headerName: 'UUID CFDI/COMENTARIO',
        editable: true,
        width: 500,
        type: 'text'
      }
    ];
  }

  public gridOptionsComprobacion: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
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
        colKey: 'tipoDocumento'
      });
    }, 0);
  }

  deleteSelectedDocumento() {
    const selectedRows = this.gridApiDocumentos.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un documento para eliminar', 'warning');
      return;
    }

    const selectedDocumento = selectedRows[0];
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
    // Crear input file dinámico
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
    // Importar Firebase Storage dinámicamente
    const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');

    const storage = getStorage();

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

  ngOnDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
  }
}
