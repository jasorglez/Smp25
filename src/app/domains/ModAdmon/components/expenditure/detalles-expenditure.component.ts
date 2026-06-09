import { Component, OnInit, inject, OnDestroy, HostListener, ElementRef } from '@angular/core';
import Swal from 'sweetalert2';
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
import { SignalsService } from 'app/services/signals.service';
// import { ProviderModalService } from '../egresos-palacio/services/provider-modal.service'; // Ya no needed
import { CustomersService } from 'app/services/customers.service';
import { AdministrationService } from 'app/services/administration.service';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { lastValueFrom } from 'rxjs';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detalles-expenditure',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, SearchableSelectComponent, SelectWithTooltipEditorV2Component],
  template: `
    <!-- Concepts Grid View -->
    <div class="detail-grid-container" *ngIf="detailType === 'concepts'"
      (mouseenter)="onGridInteractionStart()"
      (mouseleave)="onGridInteractionEnd()">
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
          <button class="btn btn-info btn-sm me-2 text-white" (click)="abrirDialogoComprobante()"
            [disabled]="isParsingImage" title="Crear concepto desde imagen de transferencia">
            <span *ngIf="isParsingImage" class="spinner-border spinner-border-sm me-1"></span>
            <i *ngIf="!isParsingImage" class="bi bi-camera me-1"></i>
            {{ isParsingImage ? 'Analizando...' : 'Desde comprobante' }}
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
        (cellEditingStarted)="onCellEditingStarted()"
        (cellEditingStopped)="onCellEditingStopped()"
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
            <div class="spinner-border text-primary mb-3" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="text-muted">Generando reporte PDF...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para agregar nuevo proveedor -->
    <div class="modal fade" [class.show]="showProviderModal" [style.display]="showProviderModal ? 'block' : 'none'" tabindex="-1" role="dialog" aria-labelledby="providerModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title" id="providerModalLabel">
              <i class="bi bi-plus-circle me-2"></i>Agregar Nuevo Proveedor
            </h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeProviderModal()" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="providerCompany" class="form-label">Compañía <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="providerCompany" [(ngModel)]="newProvider.company" name="providerCompany" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="providerContact" class="form-label">Nombre Contacto <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="providerContact" [(ngModel)]="newProvider.nameContact" name="providerContact" required>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="providerPosition" class="form-label">Puesto</label>
                    <input type="text" class="form-control" id="providerPosition" [(ngModel)]="newProvider.position" name="providerPosition">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="providerPhone" class="form-label">Teléfono</label>
                    <input type="text" class="form-control" id="providerPhone" [(ngModel)]="newProvider.phone" name="providerPhone">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="providerEmail" class="form-label">Email</label>
                    <input type="email" class="form-control" id="providerEmail" [(ngModel)]="newProvider.email" name="providerEmail">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="providerRfc" class="form-label">RFC</label>
                    <input type="text" class="form-control" id="providerRfc" [(ngModel)]="newProvider.rfc" name="providerRfc">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <div class="mb-3">
                    <label for="providerAddress" class="form-label">Dirección</label>
                    <textarea class="form-control" id="providerAddress" [(ngModel)]="newProvider.address" name="providerAddress" rows="2" 
                              style="word-wrap: break-word; white-space: pre-wrap; resize: vertical;"></textarea>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeProviderModal()">
              <i class="bi bi-x-circle me-1"></i>Cancelar
            </button>
            <button type="button" class="btn btn-success" (click)="saveNewProvider()" [disabled]="!newProvider.company || !newProvider.nameContact">
              <i class="bi bi-floppy me-1"></i>Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Backdrop del modal -->
    <div class="modal-backdrop fade" [class.show]="showProviderModal" [style.display]="showProviderModal ? 'block' : 'none'" 
         (click)="closeProviderModal()"></div>
  `,
  styleUrl: './detalles-expenditure.component.scss'
})
export class DetallesExpenditureComponent implements OnInit, OnDestroy {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private sanitizer = inject(DomSanitizer);
  private el       = inject(ElementRef);
  private signalsService = inject(SignalsService);
  // private providerModalService = inject(ProviderModalService); // Ya no needed
  private customersService = inject(CustomersService);
  private administrationService = inject(AdministrationService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  expenses: any[] = []; // Tipos de gasto (BILL catalog)
  employees: any[] = []; // Lista de empleados
  providers: any[] = []; // Lista de proveedores
  cuentasContables: any[] = []; // Lista de cuentas contables
  cuentasContablesNivel3: any[] = []; // Lista de cuentas contables nivel 3
  ivaPercent: number = 16; // Porcentaje de IVA por defecto
  setupManagementInfo: any = null; // Información de firmas

  // Totals
  subtotal: number = 0;
  iva2: number = 0;
  total: number = 0;

  // Report properties
  detailType: string = 'concepts';
  expenditureData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;
  private autoRefreshHandle: ReturnType<typeof setInterval> | null = null;
  private readonly autoRefreshMs: number = 5000;
  private lastServerFingerprint: string = '';
  private isInteractingWithGrid: boolean = false;
  private isEditingGrid: boolean = false;

  isParsingImage: boolean = false;
  private _fileInputComprobante: HTMLInputElement | null = null;

  // Provider Modal properties
  showProviderModal: boolean = false;
  newProvider: any = {
    idRoot: 0,
    idBranch: 0,
    idTypecop: 3,
    nameContact: '',
    company: '',
    rfc: '',
    city: '',
    position: 'GERENCIA',
    address: '',
    addressFiscal: '',
    cp: '',
    state: '',
    neighborhood: '',
    total: 0,
    radio: 0,
    phone: '',
    mobile: '',
    email: '',
    vigente: true,
    numCliente: 0,
    latitud: '',
    longitud: '',
    typeCustomer: '',
    typework: '',
    type: 'PROVIDERS',
    fieldContact: 0,
    fieldBank: 0,
    fieldCuenta: 0,
    active: true
  };

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // Leer siempre del componentParent (referencia viva) para evitar contexto stale
  private get _employees(): any[] {
    return this.context?.componentParent?.employees || this.context?.employees || this.employees || [];
  }
  private get _providers(): any[] {
    return this.context?.componentParent?.providers || this.context?.providers || this.providers || [];
  }
  private get _cuentasContables(): any[] {
    return this.context?.componentParent?.cuentasContables || this.context?.cuentasContables || this.cuentasContables || [];
  }
  private get _cuentasContablesNivel3(): any[] {
    return this.context?.componentParent?.cuentasContablesNivel3 || this.context?.cuentasContablesNivel3 || this.cuentasContablesNivel3 || [];
  }

  ngOnInit() {
  }

  async agInit(params: ICellRendererParams): Promise<void> {
    this.params = params;
    this.context = params.context;
    this.expenditureData = params.data;
    this.detailType = params.data.detailType || 'concepts';

    // Cargar expenses del contexto
    if (this.context?.expenses) {
      this.expenses = this.context.expenses;
    }

    // Cargar empleados del contexto
    if (this.context?.employees) {
      this.employees = this.context.employees;
    }

    // Cargar proveedores del contexto
    if (this.context?.providers) {
      this.providers = this.context.providers;
    }

    // Cargar cuentas contables del contexto
    if (this.context?.cuentasContables) {
      this.cuentasContables = this.context.cuentasContables;
    }

    // Cargar cuentas contables nivel 3 del contexto
    if (this.context?.cuentasContablesNivel3) {
      this.cuentasContablesNivel3 = this.context.cuentasContablesNivel3;
    }

    if (this.detailType === 'concepts') {
      this.loadConceptsData();
      this.startAutoRefresh();
    } else if (this.detailType === 'report') {
      this.stopAutoRefresh();
      this.loadConceptsDataForReport();
    }

  }

  loadConceptsData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const expenditureId = this.params.data.id;
      this.context.CONCEPTS.load(expenditureId, (data: any[]) => {
        const incomingData = Array.isArray(data) ? data : [];
        const incomingFingerprint = this.buildConceptsFingerprint(incomingData);

        if (this.hasUnsavedChanges && this.lastServerFingerprint && incomingFingerprint !== this.lastServerFingerprint) {
          return;
        }

        // Obtener datos del contexto
        const employees = this._employees;
        const providers = this._providers;
        const cuentasContables = this._cuentasContables;

        this.rowData = incomingData.map(concept => {
          const type = concept.typeExpense?.trim().toUpperCase();
          let selectedEntity = null;

          // Configurar selectedEntity basado en el tipo y idExpense
          if (type === 'EMPLEADOS' && concept.idExpense) {
            const employee = employees.find((e: any) => e.id === concept.idExpense);
            selectedEntity = employee ? this.getEmployeeDisplayName(employee) : null;
          } else if (type === 'PROVEEDORES' && concept.idExpense) {
            const provider = providers.find((p: any) => p.id === concept.idExpense);
            selectedEntity = provider ? this.getProviderDisplayName(provider) : null;
          } else if (type === 'OTROS' && concept.idExpense) {
            const cuenta = cuentasContables.find((c: any) => c.id === concept.idExpense);
            selectedEntity = cuenta ? `${cuenta['codigo']} - ${cuenta['nombre']}` : null;
          }

          return {
            ...concept,
            typeExpense: type,
            selectedEntity: selectedEntity,
            groupEntity: this.getGroupEntityLabel({
              ...concept,
              typeExpense: type,
              selectedEntity
            }),
            graficar: concept.graficar !== false, // undefined → true (compatibilidad hacia atrás)
            __isNew: false,
            __modified: false
          };
        });
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
          this.context.CONCEPTS.updateCount(expenditureId, this.rowData.length);
        }
        // Recalcular totales
        this.recalculateTotals();
        this.lastServerFingerprint = incomingFingerprint;
        this.syncMasterTotals();
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
        this.setupManagementInfo = null;
      }
    }
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
    }
    if (this._fileInputComprobante) {
      document.body.removeChild(this._fileInputComprobante);
      this._fileInputComprobante = null;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }

  onGridInteractionStart() {
    this.isInteractingWithGrid = true;
  }

  onGridInteractionEnd() {
    this.isInteractingWithGrid = false;
  }

  onCellEditingStarted() {
    this.isEditingGrid = true;
  }

  onCellEditingStopped() {
    this.isEditingGrid = false;
  }

  // Cache for column definitions
  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    // If already initialized, return the same instance
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

    // Initialize once
    this._colDefs = [
      {
        field: 'dateExpend',
        headerName: 'Fecha',
        editable: true,
        sort: 'desc',
        width: 120,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => params.data?.dateExpend ? String(params.data.dateExpend).substring(0, 10) : '',
        valueSetter: (params) => {
          params.data.dateExpend = params.newValue;
          return true;
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const [y, m, d] = String(params.value).substring(0, 10).split('-');
          return d && m && y ? `${d}/${m}/${y}` : params.value;
        }
      },
      {
        field: 'typeExpense',
        headerName: 'Tipo Gasto',
        editable: true,
        width: 130,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['EMPLEADOS', 'PROVEEDORES', 'OTROS'] },
        valueFormatter: (params) => {
          const value = params.value;
          if (value === 'EMPLEADOS') return 'Empleados';
          if (value === 'PROVEEDORES') return 'Proveedores';
          if (value === 'OTROS') return 'Otros';
          return value || '';
        }
      },
      {
        field: 'groupEntity',
        headerName: 'Agrupacion',
        rowGroup: true,
        hide: true
      },
      {
        field: 'selectedEntity',
        headerName: 'Empleado/Proveedor/Cuenta',
        width: 240,
        cellDataType: false,
        editable: (params) => !!params.data?.typeExpense,
        cellEditor: 'selectWithTooltipEditorV2',
        cellEditorParams: (params: any) => {
          if (!params.data) return { options: [] };
          const type = params.data.typeExpense;
          
          // Leer siempre del componentParent para obtener datos actualizados
          const employees = this._employees;
          const providers = this._providers;
          const cuentasContables = this._cuentasContables;

          let options = [];
          
          if (type === 'EMPLEADOS') {
            options = this.sortComboOptions(employees.map((e: any) => ({
              id: e.id,
              description: this.getEmployeeDisplayName(e),
              valueAddition: e.id.toString(),
              valueAddition2: this.getEmployeeDisplayName(e)
            })));
          } else if (type === 'PROVEEDORES') {
            options = this.sortComboOptions(providers.map((p: any) => ({
              id: p.id,
              description: this.getProviderDisplayName(p),
              valueAddition: p.id.toString(),
              valueAddition2: this.getProviderDisplayName(p)
            })));
            // Agregar opción "Agregar Proveedor" al final
            options.push({
              id: -999,
              description: '➕ Agregar Proveedor...',
              valueAddition: '-999',
              valueAddition2: '➕ Agregar Proveedor...'
            });
          } else if (type === 'OTROS') {
            options = cuentasContables.map((cuenta: any) => ({
              id: cuenta.id,
              description: `${cuenta['codigo']} - ${cuenta['nombre']}`,
              valueAddition: cuenta.id.toString(),
              valueAddition2: `${cuenta['codigo']} - ${cuenta['nombre']}`
            }));
          }

          return { options };
        },
        valueSetter: (params) => {
          if (!params.data) return false;
          const type = params.data.typeExpense;
          
          // Si seleccionó "Agregar Proveedor"
          if (params.newValue === -999) {
            this.openProviderModal(this.context?.idRoot || 0);
            params.data.idExpense = params.oldValue || null;
            return false;
          }
          
          // Obtener listas actualizadas
          const employees = this._employees;
          const providers = this._providers;
          const cuentasContables = this._cuentasContables;

          if (type === 'EMPLEADOS') {
            const employee = employees.find((e: any) => e.id === params.newValue);
            if (employee) {
              const employeeName = this.getEmployeeDisplayName(employee);
              params.data.idExpense = employee.id;
              params.data.selectedEntity = employeeName;
              params.data.groupEntity = this.getGroupEntityLabel(params.data);
              if (params.data.__isNew && !params.data.description) {
                params.data.description = `Salario de ${employeeName}`;
              }
              // Auto-fill cuenta contable desde historial
              if (params.data.__isNew) {
                const hist = this.context?.componentParent?.conceptsHistoryBySpend?.get(employee.id);
                if (hist?.idContribuyente) params.data.idContribuyente = hist.idContribuyente;
              }
              return true;
            }
          } else if (type === 'PROVEEDORES') {
            const provider = providers.find((p: any) => p.id === params.newValue);
            if (provider) {
              const providerName = this.getProviderDisplayName(provider);
              params.data.idExpense = provider.id;
              params.data.selectedEntity = providerName;
              params.data.groupEntity = this.getGroupEntityLabel(params.data);
              // Auto-fill cuenta contable y concepto desde historial
              if (params.data.__isNew) {
                const hist = this.context?.componentParent?.conceptsHistoryBySpend?.get(provider.id);
                if (hist?.idContribuyente) params.data.idContribuyente = hist.idContribuyente;
                if (hist?.description && !params.data.description) params.data.description = hist.description;
              }
              return true;
            }
          } else if (type === 'OTROS') {
            const cuenta = cuentasContables.find((c: any) => c.id === params.newValue);
            if (cuenta) {
              params.data.idExpense = cuenta.id;
              params.data.selectedEntity = `${cuenta['codigo']} - ${cuenta['nombre']}`;
              params.data.groupEntity = this.getGroupEntityLabel(params.data);
              return true;
            }
          }
          return false;
        },
        valueFormatter: (params) => {
          if (!params || !params.data) return '';
          const type = params.data.typeExpense;
          const idExpense = params.data.idExpense;
          
          // Si es el caso especial de "Agregar Proveedor"
          if (type === 'PROVEEDORES' && idExpense === -999) {
            return '➕ Agregar Proveedor...';
          }
          
          if (!type || !idExpense) return params.data.selectedEntity || '';

          const employees = this._employees;
          const providers = this._providers;
          const cuentasContables = this._cuentasContables;

          if (type === 'EMPLEADOS') {
            const employee = employees.find((e: any) => e.id === idExpense);
            return employee ? this.getEmployeeDisplayName(employee) : '';
          } else if (type === 'PROVEEDORES') {
            const provider = providers.find((p: any) => p.id === idExpense);
            return provider ? this.getProviderDisplayName(provider) : '';
          } else if (type === 'OTROS') {
            const cuenta = cuentasContables.find((c: any) => c.id === idExpense);
            return cuenta ? `${cuenta['codigo']} - ${cuenta['nombre']}` : '';
          }
          return '';
        }
      },
      {
        field: 'description',
        headerName: 'Concepto Adicional',
        editable: true,
        width: 200,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          cols: 60,
          rows: 4,
          style: 'word-wrap: break-word; white-space: pre-wrap; resize: vertical;',
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          const value = params.value || '';
          return `<div class="description-content" style="word-wrap: break-word; white-space: normal; line-height: 1.2; padding: 2px; overflow: visible; max-height: none;">${value}</div>`;
        }
      },
      {
        field: 'idContribuyente',
        headerName: 'Detalle Cuenta Contable',
        editable: true,
        width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => {
          // Filtrar cuentas nivel 3 por el padre (idExpend del maestro)
          const idPadre = this.expenditureData?.idExpend;
          const cuentasNivel3 = this._cuentasContablesNivel3;
          const filtradas = idPadre
            ? cuentasNivel3.filter((c: any) => c.idPadre === idPadre)
            : cuentasNivel3;
          return {
            values: filtradas.map((c: any) => c.id)
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const cuentasNivel3 = this._cuentasContablesNivel3;
          const cuenta = cuentasNivel3.find((c: any) => c.id === params.value);
          return cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : params.value;
        }
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
        aggFunc: 'sum',
        editable: false,
        width: 100,
        cellStyle: (params: any) => params.node?.footer ? { fontWeight: 'bold' } : null,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Subtotal',
        type: 'number',
        aggFunc: 'sum',
        editable: false,
        width: 120,
        cellStyle: (params: any) => params.node?.footer ? { fontWeight: 'bold' } : null,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'totalFinal',
        headerName: 'Total Final',
        type: 'number',
        aggFunc: 'sum',
        editable: false,
        width: 130,
        cellStyle: (params: any) => params.node?.footer ? { fontWeight: 'bold' } : null,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        width: 150
      },
      {
        field: 'graficar',
        headerName: 'Graficar',
        editable: true,
        type: 'boolean',
        width: 100,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) return '';
          const val = params.value !== false;
          return `<span style="font-size:16px;cursor:pointer">${val ? '✅' : '⬜'}</span>`;
        }
      }
    ];

    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 34,
    animateRows: true,
    rowSelection: 'single',
    groupDisplayType: 'singleColumn',
    groupDefaultExpanded: -1,
    groupIncludeFooter: true,
    groupIncludeTotalFooter: true,
    suppressAggFuncInHeader: true,
    rowClassRules: {
      'new-row-highlight':      (params: any) => !!params.data?.__isNew,
      'modified-row-highlight': (params: any) => !params.data?.__isNew && !!params.data?.__modified
    },
    autoGroupColumnDef: {
      headerName: 'Proveedor / Entidad',
      minWidth: 180,
      width: 190,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' },
      cellRendererParams: {
        suppressCount: false,
        footerValueGetter: (params: any) => {
          if (params.node?.level === -1) {
            return 'Total general';
          }
          return `Subtotal ${params.value || 'Sin asignar'}`;
        }
      }
    },
    postSortRows: (params: any) => {
      params.nodes.sort((a: any, b: any) => {
        if (a.group || b.group) {
          return 0;
        }

        const dateA = this.getDateSortValue(a.data?.dateExpend);
        const dateB = this.getDateSortValue(b.data?.dateExpend);

        if (dateA === dateB) {
          return 0;
        }

        return dateB - dateA;
      });
    },
    getRowClass: (params) => {
      if (params.node.footer) {
        return 'ag-row-footer';
      }
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    }
  };

  components = {
    multiLineEditorComponent: MultiLineEditorComponent,
    searchableSelect: SearchableSelectComponent,
    selectWithTooltipEditorV2: SelectWithTooltipEditorV2Component
  };

  addConcept() {
    const tempId = `temp_concept_${this.tempIdCounter++}`;
    const newConcept = {
      id: tempId,
      idIncorExp: this.params.data.id,
      typeExpense: 'EMPLEADOS',
      idExpense: null,
      idContribuyente: null,
      selectedEntity: null,
      groupEntity: this.getGroupEntityLabel({ typeExpense: 'EMPLEADOS', selectedEntity: null }),
      dateExpend: this.getTodayDateForInput(),
      description: '',
      quantity: 1,
      unit: '',
      price: 0,
      total: 0,
      iva: false,
      iva2: 0,
      totalFinal: 0,
      comment: '',
      graficar: true,
      active: true,
      __isNew: true,
      __modified: false
    };

    // Add to beginning of array
    this.rowData = [newConcept, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Update count in master grid
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
      this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const newRowIndex = 0;
      this.gridApi.ensureIndexVisible(newRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'typeExpense'
      });
    }, 100);
  }

  private getTodayDateForInput(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Sync grid data to rowData array
    const syncedData: any[] = [];
    this.gridApi.forEachLeafNode(node => {
      if (node.data) {
        node.data.groupEntity = this.getGroupEntityLabel(node.data);
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

    // Update rowData with valid concepts only
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
        total: this.total,
        idBranch: this.params.data.idBranch ?? null
      };

      try {
        await this.context.CONCEPTS.save(expenditureId, dataToSave);
        this.hasUnsavedChanges = false;
        this.lastServerFingerprint = this.buildConceptsFingerprint(this.rowData);

        // Refresh master grid (detail stays open for user to close manually)
        if (this.context?.componentParent?.gridApi) {
          this.context.componentParent.gridApi.refreshCells({ force: true });
        }
      } catch (error) {
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
    this.gridApi.redrawRows({ rowNodes: [event.node] });

    // Si cambió la entidad seleccionada y es empleado nuevo, refrescar descripción
    if (event.colDef.field === 'selectedEntity' && event.data.typeExpense === 'EMPLEADOS') {
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['description'],
        force: true
      });
    }

    // Si cambió el tipo de gasto, limpiar la entidad seleccionada
    if (event.colDef.field === 'typeExpense') {
      event.data.idExpense = null;
      event.data.selectedEntity = null;
      event.data.groupEntity = this.getGroupEntityLabel(event.data);
      
      // Forzar refresh completo de la columna para que se actualicen las opciones del editor
      this._colDefs = [];
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      
      // Luego forzar refresh de la celda específica
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        force: true,
        columns: ['selectedEntity']
      });
    }

    if (event.colDef.field === 'selectedEntity') {
      event.data.groupEntity = this.getGroupEntityLabel(event.data);
    }

    if (['typeExpense', 'selectedEntity'].includes(event.colDef.field) && this.gridApi) {
      this.gridApi.refreshClientSideRowModel('group');
    }

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
      this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
      this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
      this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
    }
  }

  private recalculateTotals() {
    this.subtotal = this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    this.iva2 = this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
    this.total = this.rowData.reduce((acc, row) => acc + (Number(row.totalFinal) || 0), 0);
  }

  private startAutoRefresh() {
    this.stopAutoRefresh();

    this.autoRefreshHandle = setInterval(() => {
      if (
        this.detailType !== 'concepts' ||
        this.showProviderModal ||
        this.hasUnsavedChanges ||
        this.isInteractingWithGrid ||
        this.isEditingGrid
      ) {
        return;
      }

      this.loadConceptsData();
    }, this.autoRefreshMs);
  }

  private stopAutoRefresh() {
    if (this.autoRefreshHandle) {
      clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  private buildConceptsFingerprint(concepts: any[]): string {
    return JSON.stringify(
      (concepts || [])
        .map((concept: any) => ({
          id: concept.id,
          idExpense: concept.idExpense,
          typeExpense: concept.typeExpense,
          quantity: Number(concept.quantity || 0),
          price: Number(concept.price || 0),
          iva: !!concept.iva,
          description: concept.description || '',
          comment: concept.comment || '',
          dateExpend: concept.dateExpend || ''
        }))
        .sort((a: any, b: any) => `${a.id}`.localeCompare(`${b.id}`))
    );
  }

  private syncMasterTotals() {
    if (this.context?.CONCEPTS?.syncMasterTotals) {
      this.context.CONCEPTS.syncMasterTotals(this.params.data.id, {
        subtotal: this.subtotal,
        tax: this.iva2,
        total: this.total,
        count: this.rowData.length
      });
    }
  }

  private getGroupEntityLabel(concept: any): string {
    const type = (concept?.typeExpense || '').trim().toUpperCase();
    const entityName = concept?.selectedEntity || '';

    if (type === 'PROVEEDORES') {
      return entityName || 'Sin asignar';
    }

    if (type === 'EMPLEADOS') {
      return entityName ? `Empleado ${entityName}` : 'Empleado Sin asignar';
    }

    if (type === 'OTROS') {
      return entityName ? `Cuenta ${entityName}` : 'Cuenta Sin asignar';
    }

    return 'Sin asignar';
  }

  private getEmployeeDisplayName(employee: any): string {
    return employee?.name || employee?.fullName || employee?.nameEmployee || 'Sin nombre';
  }

  private getProviderDisplayName(provider: any): string {
    return provider?.name || provider?.company || provider?.nameContact || 'Sin nombre';
  }

  private sortComboOptions(options: any[]): any[] {
    return [...(options || [])].sort((a: any, b: any) =>
      String(a?.description || '').localeCompare(String(b?.description || ''), 'es', {
        sensitivity: 'base'
      })
    );
  }

  private getDateSortValue(value: any): number {
    if (!value) {
      return 0;
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? 0 : date.getTime();
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

  // ==================== MÉTODOS PARA EL MODAL DE PROVEEDOR ====================

  openProviderModal(idRoot: number) {
    // Resetear el formulario del proveedor
    this.newProvider = {
      ...this.newProvider,
      idRoot: idRoot,
      idBranch: this.context?.componentParent?.idBranch || 0,
      company: '',
      nameContact: '',
      phone: '',
      email: '',
      rfc: '',
      address: ''
    };
    
    // Mostrar el modal con un pequeño delay para asegurar que se renderice
    setTimeout(() => {
      this.showProviderModal = true;
      document.body.classList.add('modal-open');
    }, 50);
  }

  closeProviderModal() {
    this.showProviderModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveNewProvider() {
    if (!this.newProvider.company || !this.newProvider.nameContact) {
      alerts.basicAlert(
        'Error',
        'La Compañía y el Nombre de Contacto son obligatorios.',
        'error'
      );
      return;
    }

    try {
      const result: any = await lastValueFrom(
        this.customersService.addCustomer(this.newProvider)
      );

      alerts.toastAlert('Proveedor creado correctamente', 'success');

      // Actualizar la lista de proveedores en el contexto
      const newProvider = {
        id: result.id,
        name: this.newProvider.company
      };

      // Actualizar la lista viva en componentParent y fallbacks
      if (this.context?.componentParent?.providers) {
        this.context.componentParent.providers.push(newProvider);
      } else if (this.context?.providers) {
        this.context.providers.push(newProvider);
      }
      this.providers.push(newProvider);

      this.closeProviderModal();

      // Actualizar el grid para que aparezca el nuevo proveedor
      this.onProviderCreated(newProvider);

    } catch (error) {
      alerts.basicAlert(
        'Error',
        `Error al crear el proveedor. ${error?.error?.message || error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  onProviderCreated(providerData: { id: number; name: string }) {
    // Refrescar las columnas para que aparezca el nuevo proveedor en el combo
    this._colDefs = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
    }

    // Esperar un poco y luego actualizar la celda si está seleccionada
    setTimeout(() => {
      const selectedNodes = this.gridApi?.getSelectedNodes();
      if (selectedNodes && selectedNodes.length > 0) {
        const selectedNode = selectedNodes[0];

        if (selectedNode.data.typeExpense === 'PROVEEDORES') {
          
          // Actualizar los valores directamente en el nodo
          selectedNode.data.idExpense = providerData.id;
          selectedNode.data.selectedEntity = this.getProviderDisplayName(providerData);
          selectedNode.data.groupEntity = this.getGroupEntityLabel(selectedNode.data);
          selectedNode.data.__modified = true;
          this.hasUnsavedChanges = true;
          this.gridApi.refreshClientSideRowModel('group');
          
          // Refrescar la celda específica
          this.gridApi.refreshCells({
            rowNodes: [selectedNode],
            columns: ['selectedEntity'],
            force: true
          });

          // También forzar un refresh de toda la fila para asegurar que se actualice
          this.gridApi.refreshCells({
            rowNodes: [selectedNode],
            force: true
          });

        }
      }
    }, 100);
  }

  // ==================== PDF GENERATION ====================

  private async generateReport() {
    try {
      // Verify required services in context
      if (!this.context?.rootService || !this.context?.base64EncodeService || !this.context?.idRoot) {
        this.pdfUrl = null;
        return;
      }

      // Get company info with logo
      const rootResponse: any = await lastValueFrom(
        this.context.rootService.getRootbyId(this.context.idRoot)
      );

      // Convert logo to Base64
      const logoBase64 = await this.context.base64EncodeService.convertImageToBase64(
        rootResponse.picture
      );

      // Convert picture2 (second logo) to Base64
      const logo2Base64 = rootResponse.picture2
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture2)
        : logoBase64;

      // Convert picture3 (watermark) to Base64
      const watermarkBase64 = rootResponse.picture3
        ? await this.context.base64EncodeService.convertImageToBase64(rootResponse.picture3)
        : null;

      // Create PDF document structure
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
          // Header with logo and title
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
          // Separator line
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
          // Expenditure details (Master)
          {
            text: 'DETALLES DEL EGRESO',
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
                  { text: 'DESCRIPCIÓN:', style: 'masterLabel' },
                  { text: this.expenditureData?.description || 'Sin descripción', style: 'masterValue' }
                ],
                [
                  { text: 'TIPO DE GASTO:', style: 'masterLabel' },
                  { text: this.getExpenseTypeText(), style: 'masterValue', colSpan: 3 },
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
          // Concepts table
          {
            text: 'CONCEPTOS',
            style: 'sectionTitle',
            margin: [0, 10, 0, 10]
          },
          this.generateConceptsTable(),
          // Totals section
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
          // Footer with signatures (2 signatures)
          {
            table: {
              widths: ['50%', '50%'],
              body: [
                [
                  { text: this.setupManagementInfo?.administratorTitle || 'ADMINISTRADOR', style: 'signatureTitle', alignment: 'center' },
                  { text: this.setupManagementInfo?.directorTitle || 'DIRECTOR', style: 'signatureTitle', alignment: 'center' }
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
                  { text: this.setupManagementInfo?.directorName || '', style: 'signatureName', alignment: 'center' }
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

      // Generate PDF
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      pdfDocGenerator.getBlob((blob: Blob) => {
        // Clean up previous URL
        if (this.originalPdfUrl) {
          URL.revokeObjectURL(this.originalPdfUrl);
        }

        // Create new URL for blob
        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.originalPdfUrl);
      });

    } catch (error) {
      this.pdfUrl = null;
      alerts.basicAlert('Error', 'No se pudo generar el reporte PDF', 'error');
    }
  }

  private generateConceptsTable(): any {
    const tableBody: any[] = [
      // Header row
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

    // Data rows
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

  private getExpenseTypeText(): string {
    // Primero verificar si ya existe expenseTypeText en los datos
    if (this.expenditureData?.expenseTypeText) {
      return this.expenditureData.expenseTypeText;
    }

    // Si no existe, buscar en el contexto actualizado
    const expenses = this.context?.componentParent?.expenses || this.context?.expenses || this.expenses;
    if (!this.expenditureData?.idExpend || !expenses || expenses.length === 0) {
      return 'Sin tipo de gasto';
    }

    const expense = expenses.find((e: any) => e.id === this.expenditureData.idExpend);
    return expense ? expense.description : 'Sin descripción';
  }

  // ==================== COMPROBANTE CON GEMINI ====================

  public abrirDialogoComprobante() {
    Swal.fire({
      title: 'Seleccionar comprobante',
      html: `<input type="file" id="swal-comprobante" accept="image/*" class="form-control mt-2">`,
      showCancelButton: true,
      confirmButtonText: 'Analizar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const input = document.getElementById('swal-comprobante') as HTMLInputElement;
        const file = input?.files?.[0];
        if (!file) { Swal.showValidationMessage('Selecciona una imagen'); return false; }
        return file;
      }
    }).then(result => {
      console.log('📷 Swal result:', result.isConfirmed, result.value);
      if (!result.isConfirmed || !result.value) return;
      const file = result.value as File;
      console.log('📷 Enviando archivo:', file.name, file.size, file.type);
      this.isParsingImage = true;
      const timer = setTimeout(() => { this.isParsingImage = false; }, 30000);
      this.administrationService.parseComprobante(file).subscribe({
        next: (data: any) => {
          clearTimeout(timer);
          console.log('📷 Gemini:', JSON.stringify(data));
          this.isParsingImage = false;
          this.addConceptFromComprobante(data);
        },
        error: (err: any) => {
          clearTimeout(timer);
          console.error('📷 ERROR:', err.status, err.message);
          this.isParsingImage = false;
          alerts.basicAlert('Error', 'No se pudo analizar el comprobante.', 'error');
        }
      });
    });
  }

  private addConceptFromComprobante(data: any) {
    const tempId = `temp_concept_${this.tempIdCounter++}`;
    const rawMonto = String(data?.monto ?? '0').replace(/[^0-9.]/g, '');
    const monto    = parseFloat(rawMonto) || 0;
    const newConcept = {
      id:              tempId,
      idIncorExp:      this.params.data.id,
      typeExpense:     'PROVEEDORES',
      idExpense:       null,
      idContribuyente: null,
      selectedEntity:  null,
      groupEntity:     this.getGroupEntityLabel({ typeExpense: 'PROVEEDORES', selectedEntity: null }),
      dateExpend:      data?.fecha || this.getTodayDateForInput(),
      description:     data?.descripcion || '',
      quantity:        1,
      unit:            '',
      price:           monto,
      total:           monto,
      iva:             false,
      iva2:            0,
      totalFinal:      monto,
      comment:         data?.referencia || '',
      graficar:        true,
      active:          true,
      __isNew:         true,
      __modified:      false
    };

    this.rowData = [newConcept, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);
    this.recalculateTotals();

    if (this.context?.CONCEPTS?.updateCount) {
      this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'typeExpense' });
    }, 100);
  }
}
