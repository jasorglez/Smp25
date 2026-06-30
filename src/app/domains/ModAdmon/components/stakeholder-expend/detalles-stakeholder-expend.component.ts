import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
import { TrackingService } from 'app/services/tracking.service';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detalles-stakeholder-expend',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
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
      <div class="report-content" style="height: 480px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="text-muted">Generando reporte PDF...</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 0.375rem;
    }
    .report-detail-container {
      padding: 15px;
      background-color: #ffffff;
    }
    .totals-display {
      font-size: 0.9rem;
    }
  `]
})
export class DetallesStakeholderExpendComponent implements OnInit, OnDestroy {
  private trackingService = inject(TrackingService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private sanitizer = inject(DomSanitizer);
  private signalsService = inject(SignalsService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  projects: any[] = [];
  ivaPercent: number = 16;
  setupManagementInfo: any = null;

  // Totals
  subtotal: number = 0;
  iva2: number = 0;
  total: number = 0;

  // Report properties
  detailType: string = 'concepts';
  expenditureData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    console.log('📊 DetallesStakeholderExpend inicializado');
  }

  async agInit(params: ICellRendererParams): Promise<void> {
    this.params = params;
    this.context = params.context;
    this.expenditureData = params.data;
    this.detailType = params.data.detailType || 'concepts';

    // Cargar proyectos del contexto
    if (this.context?.projects) {
      this.projects = this.context.projects;
    }

    if (this.detailType === 'concepts') {
      this.loadConceptsData();
    } else if (this.detailType === 'report') {
      this.loadConceptsDataForReport();
    }
  }

  loadConceptsData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      console.log('🔵 DETALLE: Cargando conceptos para retiro ID:', expenditureId);
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        console.log(`📊 DETALLE: Conceptos recibidos para ID ${expenditureId}:`, data.length);

        this.rowData = data.map(concept => ({
          ...concept,
          __isNew: false,
          __modified: false
        }));

        // Calculate total for each concept
        this.rowData.forEach(concept => {
          concept.total = (concept.quantity || 0) * (concept.price || 0);
          concept.iva2 = concept.iva ? concept.total * (this.ivaPercent / 100) : 0;
          concept.totalFinal = concept.total + concept.iva2;
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

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        this.rowData = data;
        // Calculate totals for each concept
        this.rowData.forEach(concept => {
          concept.total = (concept.quantity || 0) * (concept.price || 0);
          concept.iva2 = concept.iva ? concept.total * (this.ivaPercent / 100) : 0;
          concept.totalFinal = concept.total + concept.iva2;
        });
        // Calculate totals for report
        this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
        this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
        this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
        // Generate report after data is loaded
        this.generateReport();
      });
    } else {
      this.generateReport();
    }
  }

  async loadSetupManagementInfo() {
    if (this.context?.administrationService && this.context?.idRoot) {
      try {
        this.setupManagementInfo = await lastValueFrom(
          this.context.administrationService.getSetupManagementInfo(this.context.idRoot)
        );
        if (Array.isArray(this.setupManagementInfo) && this.setupManagementInfo.length > 0) {
          this.setupManagementInfo = this.setupManagementInfo[0];
        }
      } catch (error) {
        console.error('Error loading setup management info:', error);
        this.setupManagementInfo = null;
      }
    }
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  ngOnDestroy() {
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }

  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

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
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        width: 300,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          cols: 60,
          rows: 4
        },
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value || '';
          return `<div class="description-content" style="word-wrap: break-word; white-space: normal; line-height: 1.2; padding: 2px;">${value}</div>`;
        }
      },
      {
        field: 'idProject',
        headerName: 'Proyecto',
        editable: true,
        width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.projects ? this.projects.map((p) => p.id) : []
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const project = this.projects?.find((p) => p.id === params.value);
          return project ? project.name : params.value;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        type: 'number',
        editable: true,
        width: 100
      },
      {
        field: 'price',
        headerName: 'Precio',
        type: 'number',
        editable: true,
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'iva',
        headerName: '¿Aplica IVA?',
        type: 'boolean',
        editable: true,
        width: 120
      },
      {
        field: 'iva2',
        headerName: 'IVA',
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
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'totalFinal',
        headerName: 'Total Final',
        type: 'number',
        editable: false,
        width: 130,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        width: 150
      }
    ];

    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 45,
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
    multiLineEditorComponent: MultiLineEditorComponent
  };

  addConcept() {
    const tempId = `temp_concept_${this.tempIdCounter++}`;
    // Usar el typeExpense del contexto o del registro padre, con fallback a RETIRO
    const typeExpense = this.context?.selectedExpenseType || this.params.data?.type || 'RETIRO';
    const newConcept = {
      id: tempId,
      idIncorExp: this.params.data.id,
      dateExpend: this.params.data.date,
      description: '',
      idProject: this.params.data.idProject || null,
      typeExpense: typeExpense,
      quantity: 1,
      price: 0,
      total: 0,
      iva: false,
      iva2: 0,
      totalFinal: 0,
      comment: '',
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [newConcept, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
      this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'description'
      });
    }, 100);
  }

  async deleteSelectedConcept() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un concepto para eliminar', 'warning');
      return;
    }

    const selectedConcept = selectedRows[0];

    const result = await alerts.confirmAlert(
      '¿Eliminar concepto?',
      `¿Está seguro que desea eliminar este concepto? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    if (selectedConcept.__isNew) {
      this.rowData = this.rowData.filter(concept => concept.id !== selectedConcept.id);
      this.gridApi.applyTransaction({ remove: [selectedConcept] });
      this.hasUnsavedChanges = true;
      this.recalculateTotals();
      if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
        this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
      }
      return;
    }

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.delete) {
      const newCount = this.rowData.length - 1;
      this.context.CONCEPTS.delete({ data: selectedConcept, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(concept => concept.id !== selectedConcept.id);
        this.gridApi.applyTransaction({ remove: [selectedConcept] });
        this.hasUnsavedChanges = true;
        this.recalculateTotals();
        if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
          this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
        }
      }, newCount);
    }
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detalles stakeholder expend', 'Admon', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    console.log('💾 GUARDANDO CAMBIOS - Sincronizando datos del grid...');

    const syncedData: any[] = [];
    this.gridApi.forEachNode(node => {
      if (node.data) {
        syncedData.push(node.data);
      }
    });
    this.rowData = syncedData;

    // Recalculate totals for each concept
    this.rowData.forEach(concept => {
      concept.total = Number(concept.quantity || 0) * Number(concept.price || 0);
      concept.iva2 = concept.iva ? concept.total * (this.ivaPercent / 100) : 0;
      concept.totalFinal = concept.total + concept.iva2;
    });

    // Filter valid concepts
    const validConcepts = this.rowData.filter(concept =>
      concept.price && Number(concept.price) > 0
    );

    if (validConcepts.length === 0) {
      alerts.basicAlert(
        'Validación',
        'Debe haber al menos un concepto con precio mayor a 0 para guardar.',
        'warning'
      );
      return;
    }

    // Validate required fields
    const hasEmptyFields = validConcepts.some(concept =>
      !concept.description || !concept.quantity
    );

    if (hasEmptyFields) {
      alerts.basicAlert(
        'Validación',
        'Todos los conceptos deben tener descripción y cantidad.',
        'error'
      );
      return;
    }

    this.rowData = validConcepts;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Recalculate global totals
    this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
    this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);

    // Save to backend
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.save) {
      const expenditureId = this.params.data.id;
      const dataToSave = {
        concepts: validConcepts,
        subtotal: this.subtotal,
        tax: this.iva2,
        total: this.total
      };

      try {
        await this.context.CONCEPTS.save(expenditureId, dataToSave);
        console.log('✅ Guardado exitoso.');
        this.hasUnsavedChanges = false;

        if (this.context?.componentParent?.gridApi) {
          this.context.componentParent.gridApi.refreshCells({ force: true });
        }
      } catch (error) {
        console.error('❌ Error al guardar:', error);
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

    if (['iva', 'quantity', 'price'].includes(event.colDef.field)) {
      const rowData = event.data;

      if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
        rowData.total = Number(rowData.quantity || 0) * Number(rowData.price || 0);
      }

      rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;
      rowData.totalFinal = rowData.total + rowData.iva2;

      if (this.gridApi) {
        this.gridApi.applyTransaction({
          update: [rowData]
        });
      }

      // Recalculate totals
      this.recalculateTotals();
    }
  }

  private recalculateTotals() {
    this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
    this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);

    // Actualizar totales en el padre en tiempo real
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateTotals) {
      this.context.CONCEPTS.updateTotals(this.params.data.id, this.subtotal, this.iva2, this.total);
    }
  }

  closeDetail() {
    if (this.context && this.context.componentParent) {
      const expenditureId = this.params.data.id;
      this.context.componentParent.collapseCurrentRow(expenditureId);
    }
  }

  closeReport() {
    this.closeDetail();
  }

  // ==================== PDF GENERATION ====================

  private async generateReport() {
    try {
      if (!this.context?.rootService || !this.context?.base64EncodeService || !this.context?.idRoot) {
        console.error('Servicios necesarios no disponibles en el contexto');
        this.pdfUrl = null;
        return;
      }

      const rootResponse: any = await lastValueFrom(
        this.context.rootService.getRootbyId(this.context.idRoot)
      );

      const logoBase64 = await this.context.base64EncodeService.convertImageToBase64(
        rootResponse.picture
      );

      const logo2Base64 = rootResponse.picture2
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture2)
        : logoBase64;

      const watermarkBase64 = rootResponse.picture3
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture3)
        : null;

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageMargins: [40, 40, 40, 60],
        background: watermarkBase64 ? [
          {
            image: 'watermark',
            width: 400,
            opacity: 0.15,
            absolutePosition: { x: 106, y: 250 }
          }
        ] : [],
        content: [
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
                    image: 'logo2',
                    width: 80,
                    alignment: 'right',
                    margin: [0, 0, 0, 5]
                  },
                  {
                    text: 'RECIBO DE RETIRO',
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
                    text: `Fecha: ${this.formatDate(this.expenditureData?.date)}`,
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
          {
            text: 'DETALLES DEL RETIRO',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          {
            table: {
              widths: ['15%', '35%', '18%', '32%'],
              body: [
                [
                  { text: 'FECHA:', style: 'masterLabel' },
                  { text: this.formatDate(this.expenditureData?.date), style: 'masterValue' },
                  { text: 'SOCIO:', style: 'masterLabel' },
                  { text: this.expenditureData?.stakeholderName || 'Sin socio', style: 'masterValue' }
                ],
                [
                  { text: 'DESCRIPCIÓN:', style: 'masterLabel' },
                  { text: this.expenditureData?.description || 'Sin descripción', style: 'masterValue', colSpan: 3 },
                  {},
                  {}
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
          {
            text: 'CONCEPTOS',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          this.generateConceptsTable(),
          {
            table: {
              widths: ['*', '20%', '20%'],
              body: [
                [
                  { text: '', border: [false, false, false, false] },
                  { text: 'SUBTOTAL:', style: 'totalLabel', alignment: 'right' },
                  { text: `$ ${this.formatCurrency(this.subtotal)}`, style: 'totalValue', alignment: 'right' }
                ],
                [
                  { text: '', border: [false, false, false, false] },
                  { text: 'IVA:', style: 'totalLabel', alignment: 'right' },
                  { text: `$ ${this.formatCurrency(this.iva2)}`, style: 'totalValue', alignment: 'right' }
                ],
                [
                  { text: '', border: [false, false, false, false] },
                  { text: 'TOTAL:', style: 'totalLabel', alignment: 'right' },
                  { text: `$ ${this.formatCurrency(this.total)}`, style: 'totalValue', alignment: 'right' }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 10, 0, 20]
          },
          {
            table: {
              widths: ['50%', '50%'],
              body: [
                [
                  { text: this.setupManagementInfo?.administratorTitle || 'ADMINISTRADOR', style: 'signatureTitle', alignment: 'center' },
                  { text: this.setupManagementInfo?.directorTitle || 'SOCIO', style: 'signatureTitle', alignment: 'center' }
                ],
                [
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
                  }
                ],
                [
                  { text: this.setupManagementInfo?.administratorName || '', style: 'signatureName', alignment: 'center' },
                  { text: this.expenditureData?.stakeholderName || '', style: 'signatureName', alignment: 'center' }
                ],
                [
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
          logo2: logo2Base64,
          watermark: watermarkBase64
        } : {
          logo: logoBase64,
          logo2: logo2Base64
        },
        styles: {
          companyName: { fontSize: 14, bold: true, color: '#333333' },
          companyInfo: { fontSize: 9, color: '#666666' },
          documentTitle: { fontSize: 16, bold: true, color: '#1a5276' },
          documentNumber: { fontSize: 12, bold: true, color: '#333333' },
          documentDate: { fontSize: 10, color: '#666666' },
          sectionTitle: { fontSize: 11, bold: true, color: '#1a5276' },
          masterLabel: { fontSize: 9, bold: true, color: '#333333' },
          masterValue: { fontSize: 9, color: '#000000' },
          tableHeader: { fontSize: 8, bold: true, fillColor: '#e6e6e6', color: '#000000' },
          tableCell: { fontSize: 8, color: '#000000' },
          totalLabel: { fontSize: 9, bold: true, color: '#000000' },
          totalValue: { fontSize: 9, bold: true, color: '#1a5276' },
          signatureTitle: { fontSize: 8, bold: true, color: '#333333' },
          signatureName: { fontSize: 8, color: '#000000' },
          signatureLabel: { fontSize: 8, italics: true, color: '#666666' }
        }
      };

      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      pdfDocGenerator.getBlob((blob: Blob) => {
        if (this.originalPdfUrl) {
          URL.revokeObjectURL(this.originalPdfUrl);
        }

        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.originalPdfUrl);
      });

    } catch (error) {
      console.error('Error generando el reporte PDF:', error);
      this.pdfUrl = null;
      alerts.basicAlert('Error', 'No se pudo generar el reporte PDF', 'error');
    }
  }

  private generateConceptsTable(): any {
    const tableBody: any[] = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center' },
        { text: 'DESCRIPCIÓN', style: 'tableHeader' },
        { text: 'CANT.', style: 'tableHeader', alignment: 'center' },
        { text: 'P. UNIT.', style: 'tableHeader', alignment: 'right' },
        { text: 'SUBTOTAL', style: 'tableHeader', alignment: 'right' },
        { text: 'IVA', style: 'tableHeader', alignment: 'right' },
        { text: 'TOTAL', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    this.rowData.forEach((concept, index) => {
      tableBody.push([
        { text: (index + 1).toString(), style: 'tableCell', alignment: 'center' },
        { text: concept.description || '', style: 'tableCell' },
        { text: (concept.quantity || 0).toString(), style: 'tableCell', alignment: 'center' },
        { text: `$ ${this.formatCurrency(concept.price || 0)}`, style: 'tableCell', alignment: 'right' },
        { text: `$ ${this.formatCurrency(concept.total || 0)}`, style: 'tableCell', alignment: 'right' },
        { text: `$ ${this.formatCurrency(concept.iva2 || 0)}`, style: 'tableCell', alignment: 'right' },
        { text: `$ ${this.formatCurrency(concept.totalFinal || 0)}`, style: 'tableCell', alignment: 'right' }
      ]);
    });

    return {
      table: {
        headerRows: 1,
        widths: ['5%', '*', '8%', '12%', '12%', '12%', '12%'],
        body: tableBody
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#cccccc',
        vLineColor: () => '#cccccc',
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 4,
        paddingRight: () => 4
      }
    };
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
      return '';
    }
  }

  private formatCurrency(amount: number): string {
    return (amount || 0).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
