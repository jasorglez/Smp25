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
        style="height: 400px; width: 100%;">
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

  loadConceptsDataForReport() {
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
        type: 'date',
        editable: true,
        width: 100,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          });
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
        field: 'description',
        headerName: 'Concepto',
        type: 'text',
        editable: true,
        width: 250
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
      dateExpend: new Date().toISOString(),
      description: '',
      quantity: 1,
      unit: '',
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
        colKey: 'description'
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

    // Validar que todos los campos obligatorios estén llenos
    const hasEmptyFields = this.rowData.some(concept =>
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

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.save) {
      const incomeId = this.params.data.id;
      const dataToSave = {
        concepts: this.rowData,
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

  private generateReport() {
    // TODO: Implement PDF generation when format is provided
    // For now, just show empty state
    this.pdfUrl = null;
  }

  ngOnDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
  }
}
