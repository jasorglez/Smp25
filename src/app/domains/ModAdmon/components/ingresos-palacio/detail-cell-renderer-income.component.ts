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
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detail-cell-renderer-income',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, SearchableSelectComponent],
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
        style="height: 700px; width: 100%;">
      </ag-grid-angular>
    </div>

    <!-- PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'report'">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Vista Previa del Recibo - Documento: {{ incomeData?.numberDocument || 'Sin Número' }}</h5>
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
export class DetailCellRendererIncomeComponent implements OnInit, OnDestroy {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private sanitizer = inject(DomSanitizer);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  measures: any[] = [];
  objetosImpuesto: any[] = [];
  ivaPercent: number = 0;
  catalogosHijos: any[] = []; // Catálogos de nivel 3 (hijos del catálogo de ingreso seleccionado)
  setupManagementInfo: any = null; // Información de firmas
  contribuyentes: any[] = []; // Lista de contribuyentes

  // Totals
  subtotal: number = 0;
  iva2: number = 0;
  total: number = 0;

  // Report properties
  detailType: string = 'concepts';
  incomeData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Initial load will happen in agInit
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.incomeData = params.data;
    this.detailType = params.data.detailType || 'concepts';

    if (this.detailType === 'concepts') {
      this.loadMeasures();
      this.loadSATCatalogs();
      this.getBillingManagementInfo();
      this.loadCatalogosHijos(); // Cargar los catálogos hijos del catálogo de ingreso
      this.loadContribuyentes(); // Cargar contribuyentes
      this.loadConceptsData();
    } else if (this.detailType === 'report') {
      this.loadConceptsDataForReport();
    }
  }

  loadConceptsData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const incomeId = this.params.data.id;
      this.context.CONCEPTS.load(incomeId, (data: any[]) => {
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
          this.context.CONCEPTS.updateCount(incomeId, this.rowData.length);
        }
      });
    }
  }

  async loadConceptsDataForReport() {
    // Cargar información de firmas
    await this.loadSetupManagementInfo();

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const incomeId = this.params.data.id;
      this.context.CONCEPTS.load(incomeId, (data: any[]) => {
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

  loadCatalogosHijos() {
    // Obtener el idCustomer del registro maestro (que ahora es el catálogo de ingreso nivel 2)
    const idCustomer = this.incomeData?.idCustomer;

    if (!idCustomer || !this.context || !this.context.catalogadmonService) {
      console.warn('No se puede cargar catálogos hijos: falta idCustomer o catalogadmonService');
      this.catalogosHijos = [];
      return;
    }

    // Llamar al endpoint para obtener los catálogos hijos (nivel 3)
    this.context.catalogadmonService.getCatalogsxParent(idCustomer).subscribe({
      next: (data: any[]) => {
        this.catalogosHijos = data || [];
        console.log('Catálogos hijos cargados:', this.catalogosHijos);

        // Actualizar las columnas del grid con los nuevos valores
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.colDefs);
        }
      },
      error: (error) => {
        console.error('Error loading catálogos hijos:', error);
        this.catalogosHijos = [];
      }
    });
  }

  loadContribuyentes() {
    if (this.context && this.context.customerService && this.context.idRoot) {
      this.context.customerService.getCustomersByCompany(this.context.idRoot, 'CUSTOMERS').subscribe({
        next: (data: any[]) => {
          this.contribuyentes = data || [];
          console.log('Contribuyentes cargados:', this.contribuyentes);

          // Actualizar las columnas del grid
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
        },
        error: (error) => {
          console.error('Error loading contribuyentes:', error);
          this.contribuyentes = [];
        }
      });
    }
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
        editable: true,
        width: 90
      },
         {
        field: 'idCatIng',
        headerName: 'Detalle Ingreso',
        editable: true,
        width: 280,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.catalogosHijos.map(cat => cat.id)
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.catalogosHijos.find(cat => cat.id === params.value);
          return found ? found.description : params.value;
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
        type: 'text',
        editable: true,
        width: 250
      },
      {
        field: 'idContribuyente',
        headerName: 'Contribuyente',
        editable: true,
        width: 220,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.contribuyentes.map(c => c.id)
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.contribuyentes.find(c => c.id === params.value);
          return found ? found.description : params.value;
        }
      },
      {
        field: 'unit',
        headerName: 'Unidad',
        type: 'text',
        editable: true,
        width: 140,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.measures.map(measure => measure.description),
        }
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
        field: 'total',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
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
        field: 'comment',
        headerName: 'Comentario',
        type: 'text',
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

        // Si estamos en la columna "price", agregar un nuevo renglón
        if (currentColumn === 'price') {
          // Agregar un nuevo concepto
          this.addConcept();
        } else {
          // Si estamos en cualquier otra columna, mover a "price"
          const rowIndex = event.node.rowIndex;
          setTimeout(() => {
            // Primero establecer el focus en la celda
            this.gridApi.setFocusedCell(rowIndex, 'price');

            // Luego iniciar la edición inmediatamente
            this.gridApi.startEditingCell({
              rowIndex: rowIndex,
              colKey: 'price',
              key: null // Esto asegura que se abra en modo edición limpio
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

  addConcept() {
    const tempId = `temp_concept_${this.tempIdCounter++}`;
    const newConcept = {
      id: tempId,
      idIncorExp: this.params.data.id,
      typeExpense: 'NA',
      idExpense: 0,
      dateExpend: this.params.data.date, // Fecha de pago del maestro
      description: '',
      quantity: 1,
      unit: 'PARTICIPACIONES', // Valor por defecto
      claveUnidad: '',
      objetoImp: '02', // Default to "Sí objeto de impuesto"
      claveProdServ: '',
      idCatIng: 0, // Campo para el catálogo de ingreso nivel 3
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
        colKey: 'idCatIng' // Focus en Detalle Ingreso
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
        'Todos los conceptos deben tener descripción, cantidad y detalle de ingreso seleccionado.',
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
      const incomeId = this.params.data.id;
      const dataToSave = {
        concepts: validConcepts, // Solo guardar conceptos con precio > 0
        subtotal: this.subtotal,
        tax: this.iva2,
        total: this.total
      };
      this.context.CONCEPTS.save(incomeId, dataToSave);
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

    // Si se cambió el "Detalle Ingreso", copiar automáticamente al Concepto y establecer la fecha
    if (event.colDef.field === 'idCatIng' && event.newValue) {
      const selectedCatalogo = this.catalogosHijos.find(cat => cat.id === event.newValue);
      if (selectedCatalogo) {
        // Copiar la descripción del catálogo al campo Concepto
        event.data.description = selectedCatalogo.description;

        // Establecer la fecha igual a la fecha de pago del maestro
        event.data.dateExpend = this.params.data.date;

        // Actualizar la fila en el grid
        if (this.gridApi) {
          this.gridApi.applyTransactionAsync({
            update: [event.data]
          });
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
      this.context.componentParent.collapseReportDetail(this.incomeData.id);
    }
  }

  private async generateReport() {
    try {
      console.log('=== Generando Reporte PDF ===');
      console.log('incomeData completo:', this.incomeData);
      console.log('incomeData.date (campo Pago):', this.incomeData?.date);
      console.log('incomeData.idCustomer (catálogo):', this.incomeData?.idCustomer);
      console.log('incomeData.total:', this.incomeData?.total);
      console.log('Context disponible:', {
        hasRootService: !!this.context?.rootService,
        hasBase64Service: !!this.context?.base64EncodeService,
        hasIngresosCatalog: !!this.context?.ingresosCatalog,
        catalogLength: this.context?.ingresosCatalog?.length
      });

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
            absolutePosition: { x: 106, y: 250 } // Centrado aproximado (letter width 612 - 400 = 212 / 2 = 106)
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
                    text: 'RECIBO DE INGRESO',
                    style: 'documentTitle',
                    alignment: 'right'
                  },
                  {
                    text: `No. ${this.incomeData?.numberDocument || 'Sin Número'}`,
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
          // DETALLES DEL INGRESO (Maestro)
          {
            text: 'DETALLES DEL INGRESO',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          {
            table: {
              widths: ['25%', '75%'],
              body: [
                [
                  { text: 'FECHA PAGO:', style: 'masterLabel' },
                  { text: this.formatDate(this.incomeData?.date), style: 'masterValue' }
                ],
                [
                  { text: 'CATÁLOGO INGRESO:', style: 'masterLabel' },
                  {
                    text: `${this.getCatalogoIngresoText()}        $ ${this.formatCurrency(this.incomeData?.total || 0)}`,
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
            color: '#0066cc'
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
            color: '#0066cc'
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

  private formatDate(dateString: string | null | undefined): string {
    if (!dateString) {
      console.warn('formatDate: No hay fecha disponible');
      return 'Sin fecha';
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('formatDate: Fecha inválida:', dateString);
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

  private getCatalogoIngresoText(): string {
    // Usar el texto del catálogo que fue preparado en toggleReportDetail
    if (this.incomeData?.catalogoIngresoTexto) {
      console.log('Usando catalogoIngresoTexto:', this.incomeData.catalogoIngresoTexto);
      return this.incomeData.catalogoIngresoTexto;
    }

    // Fallback: intentar construir el texto si no está disponible
    if (!this.incomeData?.idCustomer) {
      console.warn('getCatalogoIngresoText: No hay idCustomer en incomeData');
      return 'Sin catálogo';
    }

    return 'Sin descripción';
  }

  ngOnDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
  }
}
