import { Component, OnInit, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detalle-ingresos',
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
        style="height: 500px; width: 100%;">
      </ag-grid-angular>
    </div>

    <!-- PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'report'">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Recibo de Ingreso - Documento: {{ incomeData?.numberDocument || 'Sin Numero' }}</h5>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="report-content" style="height: 600px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status">
              <span class="visually-hidden">Generando...</span>
            </div>
            <p class="text-muted">Generando recibo PDF...</p>
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
export class DetalleIngresosComponent implements OnInit, OnDestroy {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private sanitizer = inject(DomSanitizer);
  private signalsService = inject(SignalsService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private administrationService = inject(AdministrationService);
  private catalogsService = inject(CatalogsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  measures: any[] = [];
  ivaPercent: number = 0;
  idRoot: number = 0;

  // Totals
  subtotal: number = 0;
  iva2: number = 0;
  total: number = 0;

  // Report properties
  detailType: string = 'concepts';
  incomeData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  // Logo and watermark for PDF
  logoBase64: string = '';
  watermarkBase64: string = '';
  rootInfo: any = null;
  setupManagementInfo: any = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Initial load will happen in agInit
  }

  ngOnDestroy() {
    // Cleanup PDF URL
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
    }
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.incomeData = params.data;
    this.detailType = params.data.detailType || 'concepts';
    this.idRoot = this.context?.idRoot || this.signalsService.getRootSelectedBySidebar()();

    if (this.detailType === 'concepts') {
      this.loadMeasures();
      this.getBillingManagementInfo();
      this.loadConceptsData();
    } else if (this.detailType === 'report') {
      this.loadConceptsDataForReport();
    }
    this.cdr.detectChanges();
  }

  async loadMeasures() {
    if (!this.idRoot) return;
    this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe({
      next: (data: any) => {
        this.measures = data || [];
        if (this.gridApi) {
          this.gridApi.updateGridOptions({ columnDefs: this.colDefs });
        }
      },
      error: (err) => {
        console.error('Error loading measures:', err);
        this.measures = [];
      }
    });
  }

  async getBillingManagementInfo() {
    if (!this.idRoot) return;
    this.administrationService.getBillingManagementInfo(this.idRoot).subscribe({
      next: (data: any) => {
        this.ivaPercent = data && data[0]?.iIva ? data[0].iIva : 0;
      },
      error: (err) => {
        console.error('Error loading billing info:', err);
        this.ivaPercent = 0;
      }
    });
  }

  loadConceptsData() {
    const incomeId = this.params.data.id;
    if (!incomeId || incomeId.toString().startsWith('temp_')) {
      this.rowData = [];
      return;
    }

    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(incomeId).subscribe({
      next: (data: any) => {
        this.rowData = data || [];
        this.calculateTotals();
      },
      error: (err) => {
        console.error('Error loading concepts:', err);
        this.rowData = [];
      }
    });
  }

  async loadConceptsDataForReport() {
    const incomeId = this.params.data.id;
    if (!incomeId || incomeId.toString().startsWith('temp_')) {
      this.rowData = [];
      return;
    }

    try {
      // Load concepts
      const concepts = await lastValueFrom(
        this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(incomeId)
      );
      this.rowData = concepts || [];
      this.calculateTotals();

      // Load setup info for signatures
      await this.loadSetupManagementInfo();

      // Load logo
      await this.loadLogo();

      // Generate PDF
      this.generateReport();
    } catch (error) {
      console.error('Error loading data for report:', error);
    }
  
    this.cdr.detectChanges();}

  async loadSetupManagementInfo() {
    if (!this.idRoot) return;
    try {
      const data = await lastValueFrom(this.administrationService.getSetupManagementInfo(this.idRoot));
      this.setupManagementInfo = Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('Error loading setup management:', error);
    }
  
    this.cdr.detectChanges();}

  async loadLogo() {
    if (!this.idRoot) return;
    try {
      const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idRoot));
      this.rootInfo = rootData;

      // Cargar logo principal (picture)
      if (rootData && rootData.picture) {
        this.logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
      }

      // Cargar marca de agua (picture3)
      if (rootData && rootData.picture3) {
        this.watermarkBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture3);
      }
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  
    this.cdr.detectChanges();}

  calculateTotals() {
    this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
    this.total = this.subtotal + this.iva2;
  }

  // Column definitions
  get colDefs(): ColDef[] {
    return [
      {
        field: 'dateExpend',
        headerName: 'Fecha',
        type: 'date',
        editable: true,
        flex: 2,
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
      { field: 'quantity', headerName: 'Cantidad', type: 'number', editable: true, flex: 2 },
      { field: 'description', headerName: 'Concepto', type: 'text', editable: true, flex: 4 },
      {
        field: 'unit',
        headerName: 'Unidad',
        editable: true,
        flex: 2,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: ['+ Nueva Unidad', ...this.measures.map(m => m.description)],
          allowTyping: true,
          filterList: true,
          highlightMatch: true,
        }),
      },
      {
        field: 'price',
        headerName: 'Precio',
        type: 'number',
        editable: true,
        flex: 2,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        flex: 2,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      { field: 'iva', headerName: 'Aplica IVA', type: 'boolean', editable: true, flex: 2 },
      {
        field: 'iva2',
        headerName: 'Valor IVA',
        type: 'number',
        editable: false,
        flex: 2,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      { field: 'comment', headerName: 'Comentario', type: 'text', editable: true, flex: 3, cellEditor: 'multiLineEditorComponent' }
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single'
  };

  components = {
    multiLineEditorComponent: MultiLineEditorComponent
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onCellValueChanged(event: any) {
    // Opción especial para crear nueva unidad
    if (event.colDef.field === 'unit' && event.newValue === '+ Nueva Unidad') {
      this.createNewMeasureForCell(event);
      return;
    }

    event.data.__modified = true;
    this.hasUnsavedChanges = true;

    if (['iva', 'quantity', 'price'].includes(event.colDef.field)) {
      const rowData = event.data;

      if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
        rowData.total = Number(rowData.quantity || 0) * Number(rowData.price || 0);
      }

      rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;

      if (this.gridApi) {
        this.gridApi.applyTransactionAsync({ update: [rowData] });
      }

      this.calculateTotals();
    }
  }

  private async createNewMeasureForCell(event: any): Promise<void> {
    // Restaurar valor anterior mientras el usuario escribe
    event.data.unit = event.oldValue || '';
    this.gridApi?.applyTransactionAsync({ update: [event.data] });

    const result = await alerts.inputAlert('Nueva Unidad', 'Ingrese el nombre de la nueva unidad de medida:', 'text');
    if (!result.isConfirmed || !result.value?.trim()) return;

    const description = (result.value as string).trim().toUpperCase();
    try {
      await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: this.idRoot,
        description,
        valueAddition: 'NA',
        valueAdditionBit2: false,
        valueAdditionBit3: false,
        vigente: true,
        type: 'MEASURE',
        active: 1
      }));

      // Recargar catálogo y actualizar grid
      await new Promise<void>((resolve) => {
        this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe({
          next: (data: any) => {
            this.measures = data || [];
            this.gridApi?.updateGridOptions({ columnDefs: this.colDefs });
            resolve();
          },
          error: () => resolve()
        });
      });

      // Asignar el nuevo valor a la celda
      event.data.unit = description;
      event.data.__modified = true;
      this.gridApi?.applyTransactionAsync({ update: [event.data] });
      this.hasUnsavedChanges = true;
    } catch (error) {
      console.error('Error creando nueva unidad:', error);
      alerts.basicAlert('Error', 'No se pudo crear la nueva unidad.', 'error');
      event.data.unit = event.oldValue || '';
      this.gridApi?.applyTransactionAsync({ update: [event.data] });
    }
  
    this.cdr.detectChanges();}

  addConcept() {
    const incomeId = this.params.data.id;
    if (!incomeId || incomeId.toString().startsWith('temp_')) {
      alerts.basicAlert('Aviso', 'Debe guardar el ingreso antes de agregar conceptos.', 'warning');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idIncorExp: incomeId,
      typeExpense: 'NA',
      idExpense: 0,
      dateExpend: new Date(),
      description: '',
      quantity: 1,
      unit: '',
      price: 0,
      total: 0,
      iva: false,
      iva2: 0,
      comment: '',
      active: true,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;

    setTimeout(() => {
      this.gridApi?.startEditingCell({
        rowIndex: 0,
        colKey: 'description'
      });
    }, 50);
  }

  async saveChanges() {
    const incomeId = this.params.data.id;
    if (!incomeId || incomeId.toString().startsWith('temp_')) {
      alerts.basicAlert('Error', 'El ingreso debe estar guardado antes de guardar conceptos.', 'error');
      return;
    }

    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    try {
      // Save new rows
      for (const row of newRows) {
        const cleanedData = this.cleanDataForServer(row);
        await lastValueFrom(this.incomesAndExpensesService.addConceptFromIncomesAndExpenses(cleanedData));
      }

      // Update modified rows
      for (const row of modifiedRows) {
        const cleanedData = this.cleanDataForServer(row);
        await lastValueFrom(this.incomesAndExpensesService.updateConceptFromIncomesAndExpenses(row.id, cleanedData));
      }

      // Update main income document with new totals and countItems
      const mainDocResponse: any[] = await lastValueFrom(
        this.incomesAndExpensesService.getIncomeAndExpenseById(incomeId)
      );
      const mainDoc = mainDocResponse[0];
      const updatedDoc = {
        ...mainDoc,
        subtotal: this.subtotal,
        tax: this.iva2,
        total: this.total,
        countItems: this.rowData.length,
        idBranch: this.incomeData?.idBranch ?? mainDoc.idBranch
      };
      await lastValueFrom(this.incomesAndExpensesService.updateIncomesAndExpenses(incomeId, updatedDoc));

      // Trigger update signal
      this.signalsService.triggerUpdateIncAndExp();

      // Update count in context if available
      if (this.context?.CONCEPTS?.updateCount) {
        this.context.CONCEPTS.updateCount(incomeId, this.rowData.length);
      }

      alerts.basicAlert('Exito', 'Datos guardados correctamente.', 'success');
      this.hasUnsavedChanges = false;
      this.loadConceptsData();
    } catch (error) {
      console.error('Error saving concepts:', error);
      alerts.basicAlert('Error', 'Error al guardar los conceptos.', 'error');
    }
  
    this.cdr.detectChanges();}

  deleteSelectedConcept() {
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alerts.basicAlert('Aviso', 'Seleccione un concepto para eliminar.', 'warning');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (id.toString().startsWith('temp_')) {
      // Just remove from local array
      this.rowData = this.rowData.filter(row => row.id !== id);
      this.calculateTotals();
      return;
    }

    this.incomesAndExpensesService.deleteConceptFromIncomesAndExpenses(id).subscribe({
      next: async () => {
        // Update countItems in master record
        const incomeId = this.params.data.id;
        const newCount = this.rowData.length - 1; // -1 because we just deleted one

        try {
          const mainDocResponse: any[] = await lastValueFrom(
            this.incomesAndExpensesService.getIncomeAndExpenseById(incomeId)
          );
          const mainDoc = mainDocResponse[0];
          const updatedDoc = {
            ...mainDoc,
            countItems: newCount,
            idBranch: this.incomeData?.idBranch ?? mainDoc.idBranch
          };
          await lastValueFrom(this.incomesAndExpensesService.updateIncomesAndExpenses(incomeId, updatedDoc));

          // Update parent grid
          if (this.context?.CONCEPTS?.updateCount) {
            this.context.CONCEPTS.updateCount(incomeId, newCount);
          }
        } catch (error) {
          console.error('Error updating countItems after delete:', error);
        }

        alerts.basicAlert('Exito', 'Concepto eliminado.', 'success');
        this.loadConceptsData();
      },
      error: (err) => {
        console.error('Error deleting concept:', err);
        alerts.basicAlert('Error', 'Error al eliminar el concepto.', 'error');
      }
    });
  }

  discardChanges() {
    this.loadConceptsData();
    this.hasUnsavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== PDF REPORT GENERATION ====================

  closeReport() {
    // Notify parent to collapse
    if (this.context?.componentParent?.collapseCurrentRow) {
      this.context.componentParent.collapseCurrentRow(this.params.node);
    }
  }

  generateReport() {
    try {
      const income = this.incomeData;
      const concepts = this.rowData;

      // Crear la estructura del documento PDF
      const docDefinition: any = {
        pageSize: 'LETTER',
        pageMargins: [40, 60, 40, 60],
        background: this.watermarkBase64 ? [
          {
            image: 'watermark',
            width: 400,
            opacity: 0.15,
            absolutePosition: { x: 106, y: 250 }
          }
        ] : [],
        content: [
          // Header con logo y titulo
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
                    text: this.rootInfo?.name || 'Empresa',
                    style: 'companyName',
                    alignment: 'center'
                  },
                  {
                    text: this.rootInfo?.email || '',
                    style: 'companyInfo',
                    alignment: 'center'
                  },
                  {
                    text: this.rootInfo?.web || '',
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
                    text: `No. ${income?.numberDocument || 'Sin Numero'}`,
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
          // Linea separadora
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
          // Detalles del ingreso
          {
            text: 'DETALLES DEL INGRESO',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          this.getMasterDetailsTable(),
          // Tabla de Conceptos
          {
            table: {
              headerRows: 1,
              widths: ['*', 50, 80, 70],
              body: [
                [
                  { text: 'Descripcion', style: 'tableHeader' },
                  { text: 'Cant.', style: 'tableHeader', alignment: 'center' },
                  { text: 'Unidad', style: 'tableHeader', alignment: 'center' },
                  { text: 'Total', style: 'tableHeader', alignment: 'right' }
                ],
                ...concepts.map(concept => [
                  { text: concept.description || '', style: 'tableCell' },
                  { text: concept.quantity || '', style: 'tableCell', alignment: 'center' },
                  { text: concept.unit || '', style: 'tableCell', alignment: 'center', fontSize: 7 },
                  { text: this.formatCurrency(concept.total || 0), style: 'tableCell', alignment: 'right' }
                ]),
                [
                  { text: '', border: [false, false, false, false] },
                  { text: '', border: [false, false, false, false] },
                  { text: 'TOTAL:', style: 'totalLabel', alignment: 'right', border: [false, true, false, false] },
                  { text: this.formatCurrency(this.total), style: 'totalValue', alignment: 'right', border: [false, true, false, false] }
                ]
              ]
            },
            layout: {
              hLineWidth: (i: any, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
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
          this.getSignaturesSection()
        ],
        images: this.watermarkBase64 ? {
          logo: this.logoBase64 || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          watermark: this.watermarkBase64
        } : {
          logo: this.logoBase64 || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        },
        styles: {
          companyName: { fontSize: 14, bold: true, color: '#333333' },
          companyInfo: { fontSize: 9, color: '#666666' },
          documentTitle: { fontSize: 16, bold: true, color: '#0066cc' },
          documentNumber: { fontSize: 12, bold: true, color: '#333333' },
          documentDate: { fontSize: 10, color: '#666666' },
          sectionTitle: { fontSize: 11, bold: true, color: '#0066cc' },
          masterLabel: { fontSize: 9, bold: true, color: '#333333' },
          masterValue: { fontSize: 9, color: '#000000' },
          tableHeader: { fontSize: 8, bold: true, fillColor: '#e6e6e6', color: '#000000' },
          tableCell: { fontSize: 8, color: '#000000' },
          totalLabel: { fontSize: 9, bold: true, color: '#000000' },
          totalValue: { fontSize: 9, bold: true, color: '#0066cc' },
          signatureTitle: { fontSize: 8, bold: true, color: '#333333' },
          signatureName: { fontSize: 8, color: '#000000' },
          signatureLabel: { fontSize: 8, italics: true, color: '#666666' }
        }
      };

      // Generar el PDF
      pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
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

  private getMasterDetailsTable(): any {
    return {
      table: {
        widths: ['25%', '75%'],
        body: [
          [
            { text: 'FECHA PAGO:', style: 'masterLabel' },
            { text: this.formatDateForPdf(this.incomeData?.date), style: 'masterValue' }
          ],
          [
            { text: 'DESCRIPCION:', style: 'masterLabel' },
            { text: `${this.incomeData?.description || 'Sin descripcion'}        $ ${this.formatCurrency(this.incomeData?.total || 0)}`, style: 'masterValue' }
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
    };
  }


  private getSignaturesSection(): any {
    return {
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
            { text: '________________________________', alignment: 'center', border: [false, true, false, false], margin: [0, 0, 0, 5] },
            { text: '________________________________', alignment: 'center', border: [false, true, false, false], margin: [0, 0, 0, 5] },
            { text: '________________________________', alignment: 'center', border: [false, true, false, false], margin: [0, 0, 0, 5] }
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
    };
  }

  private formatDateForPdf(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private formatCurrency(value: number): string {
    return (value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
