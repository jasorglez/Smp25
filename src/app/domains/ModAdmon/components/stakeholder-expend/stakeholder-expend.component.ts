import { Component, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { ModalService } from 'app/services/modal.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, concat, toArray, catchError, EMPTY } from 'rxjs';
import { AdministrationService } from 'app/services/administration.service';
import { UsersService } from 'app/services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';
import { TrackingService } from 'app/services/tracking.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { ProjectsService } from 'app/services/projects.service';
import { ButtonCellRendererStakeholderComponent } from './button-cell-renderer-stakeholder.component';
import { PdfButtonCellRendererStakeholderComponent } from './pdf-button-cell-renderer-stakeholder.component';
import { DetallesStakeholderExpendComponent } from './detalles-stakeholder-expend.component';

export interface Stakeholder {
  id: number;           // ID codificado: corporativoId * 10 + partnerNumber
  name: string;
  corporativoId: number;
  corporativoName: string;
  partnerNumber: number; // 1-5 indicando partner1, partner2, etc.
}

@Component({
  selector: 'app-stakeholder-expend',
  standalone: true,
  imports: [
    NgSelectModule,
    AgGridModule,
    MultiLineEditorComponent,
    CommonModule,
    FormsModule,
    ButtonCellRendererStakeholderComponent,
    PdfButtonCellRendererStakeholderComponent,
    DetallesStakeholderExpendComponent
  ],
  templateUrl: './stakeholder-expend.component.html',
  styleUrl: './stakeholder-expend.component.scss'
})
export class StakeholderExpendComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  public modalServiceTable = inject(ModalService);
  private administrationService = inject(AdministrationService);
  private usersService = inject(UsersService);
  public signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private projectsService = inject(ProjectsService);
  authService = inject(AuthService);
  public trackingService = inject(TrackingService);

  constructor() {
    effect(async () => {
      console.log('🔄 StakeholderExpend Effect Root/Branch ejecutado');
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (!this.idRoot) {
        console.log('⚠️ No hay idRoot, saliendo del effect');
        return;
      }

      console.log('📊 Cargando datos con idRoot:', this.idRoot, 'idBranch:', this.idBranch);
      await this.loadCorporativos();
      await this.getBankAccounts();
      await this.loadStakeholderExpenses();
      await this.getCurrentUser();
      await this.loadProjects();

      this.refreshColumnDefinitions();
      this.updateDetailContext();
      console.log('✅ StakeholderExpend Effect completado');
    });
  }

  // Propiedades principales
  idRoot: number;
  idBranch: number;
  currentUser: string;
  notSavedChanges: boolean = false;
  selectedExpense: any = null;

  // Tipo de retiro seleccionado: 'RETIRO' (Retiro de Socios) o 'UTILIDADES' (Retiro de Utilidades)
  selectedExpenseType: 'RETIRO' | 'UTILIDADES' = 'RETIRO';

  // Datos
  stakeholders: Stakeholder[] = [];
  corporativos: any[] = [];
  expenses: any[] = [];
  bankAccounts: any[] = [];
  projects: any[] = [];

  private _idAccount: number;
  private _idStakeholder: number;

  set idAccount(value: number) {
    if (this._idAccount !== value) {
      this._idAccount = value;
      if (value) {
        const selectedAccount = this.bankAccounts.find(account => account.id === value);
        if (selectedAccount) {
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            `Selección de cuenta bancaria: ${selectedAccount.nameAccount} - ${selectedAccount.bankName}`,
            'Retiro Socios - Selección Cuenta',
            this.trackingService.getEmail()
          );
        }
      }
      this.loadStakeholderExpenses();
    }
  }

  get idAccount(): number {
    return this._idAccount;
  }

  set idStakeholder(value: number) {
    if (this._idStakeholder !== value) {
      this._idStakeholder = value;
      if (value) {
        const selectedStakeholder = this.stakeholders.find(s => s.id === value);
        if (selectedStakeholder) {
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            `Selección de socio: ${selectedStakeholder.name}`,
            'Retiro Socios - Selección Socio',
            this.trackingService.getEmail()
          );
        }
      }
      this.loadStakeholderExpenses();
    }
  }

  get idStakeholder(): number {
    return this._idStakeholder;
  }

  // Grid
  public gridApi: GridApi;
  private tempIdCounter: number = 0;
  externalFilterActive: boolean = false;
  private isGeneratingPdfReport: boolean = false;

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 40,
    animateRows: true,
    enableBrowserTooltips: true,
    masterDetail: true,
    detailRowHeight: 500,
    detailCellRenderer: DetallesStakeholderExpendComponent,
    isExternalFilterPresent: () => {
      return this.externalFilterActive;
    },
    doesExternalFilterPass: (node: any) => {
      return node.data.visible !== false;
    },
    getRowStyle: (params: any) => {
      if (params.node.isSelected()) {
        return { backgroundColor: '#ffe6e6', color: '#000000', fontWeight: 'bold' };
      }
      if (params.data?.status === 'Pagada') {
        return { backgroundColor: '#d4edda', color: '#000000' };
      }
      if (params.data?.status === 'Cancelada') {
        return { backgroundColor: '#f8d7da', color: '#000000' };
      }
      if (params.data?.status === 'Pendiente') {
        return { backgroundColor: '#cce5ff', color: '#000000' };
      }
      return { color: '#000000' };
    },
    onRowClicked: (event: any) => {
      if (event.column && event.column.getColId() !== 'pdfReport') {
        event.node.setSelected(true);
      }
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node: any) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  components = {
    multiLineEditor: MultiLineEditorComponent,
  };

  // Cargar Corporativos y extraer socios solo del corporativo de la empresa actual
  async loadCorporativos() {
    return new Promise<void>((resolve) => {
      this.rootService.getRootbyId(this.idRoot).subscribe({
        next: (currentRoot: any) => {
          const idCorporativo = currentRoot?.idCorporativo;
          if (!idCorporativo) {
            this.corporativos = [];
            this.stakeholders = [];
            resolve();
            return;
          }
          this.rootService.getCorporativos().subscribe({
            next: (data: any) => {
              this.corporativos = data || [];
              this.extractStakeholders(idCorporativo);
              console.log('✅ Corporativos cargados:', this.corporativos.length);
              console.log('✅ Socios extraídos:', this.stakeholders.length);
              resolve();
            },
            error: (error) => {
              console.error('Error obteniendo corporativos:', error);
              this.corporativos = [];
              this.stakeholders = [];
              resolve();
            }
          });
        },
        error: (error) => {
          console.error('Error obteniendo empresa actual:', error);
          this.corporativos = [];
          this.stakeholders = [];
          resolve();
        }
      });
    });
  }

  // Extraer socios solo del corporativo al que pertenece la empresa
  // ID codificado: corporativoId * 10 + partnerNumber (1-5)
  private extractStakeholders(idCorporativo: number) {
    this.stakeholders = [];

    const corp = this.corporativos.find(c => c.id === idCorporativo);
    if (!corp) return;

    const partners = ['partner1', 'partner2', 'partner3', 'partner4', 'partner5'];
    partners.forEach((partnerField, index) => {
      const partnerNumber = index + 1; // 1-5
      if (corp[partnerField] && corp[partnerField].trim() !== '') {
        // ID codificado: corporativoId * 10 + partnerNumber
        const encodedId = corp.id * 10 + partnerNumber;
        this.stakeholders.push({
          id: encodedId,
          name: corp[partnerField].trim(),
          corporativoId: corp.id,
          corporativoName: corp.name || 'Sin nombre',
          partnerNumber: partnerNumber
        });
      }
    });
  }

  // Decodificar idCustomer para obtener corporativoId y partnerNumber
  private decodeStakeholderId(idCustomer: number): { corporativoId: number; partnerNumber: number } {
    return {
      corporativoId: Math.floor(idCustomer / 10),
      partnerNumber: idCustomer % 10
    };
  }

  // Obtener nombre del socio a partir de idCustomer
  getStakeholderNameFromId(idCustomer: number): string {
    if (!idCustomer) return '';
    const { corporativoId, partnerNumber } = this.decodeStakeholderId(idCustomer);
    const corp = this.corporativos.find(c => c.id === corporativoId);
    if (!corp) return '';
    const partnerField = `partner${partnerNumber}`;
    return corp[partnerField] || '';
  }

  async getBankAccounts() {
    return new Promise<void>((resolve) => {
      this.administrationService.getAccountBanks(this.idRoot).subscribe(
        (data: any) => {
          this.bankAccounts = data || [];
          console.log('✅ Cuentas bancarias cargadas:', this.bankAccounts.length);
          resolve();
        },
        error => {
          console.error('Error obteniendo cuentas bancarias:', error);
          this.bankAccounts = [];
          resolve();
        }
      );
    });
  }

  async loadProjects() {
    return new Promise<void>((resolve) => {
      this.projectsService.getProjectListByCompany(this.idRoot).subscribe(
        (data: any) => {
          this.projects = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name || p.projectName || 'Sin nombre'
          }));
          console.log('✅ Proyectos cargados:', this.projects.length);
          resolve();
        },
        error => {
          console.error('Error cargando proyectos:', error);
          this.projects = [];
          resolve();
        }
      );
    });
  }

  async getCurrentUser() {
    return new Promise<void>((resolve) => {
      this.usersService.getUserByEmail(String(localStorage.getItem('mail'))).subscribe({
        next: (user) => {
          this.currentUser = user?.usersmall || 'Sin nombre';
          resolve();
        },
        error: (err) => {
          console.error('Error obteniendo usuario:', err);
          this.currentUser = 'Error al cargar';
          resolve();
        }
      });
    });
  }

  // Método para cambiar el tipo de retiro
  onExpenseTypeChange(type: 'RETIRO' | 'UTILIDADES') {
    if (this.selectedExpenseType !== type) {
      this.selectedExpenseType = type;
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Cambio a pestaña: ${type === 'RETIRO' ? 'Retiro de Socios' : 'Retiro de Utilidades'}`,
        'Retiro Socios - Cambio Pestaña',
        this.trackingService.getEmail()
      );
      this.loadStakeholderExpenses();
      this.updateDetailContext();
    }
  }

  async loadStakeholderExpenses() {
    if (!this.idAccount) {
      this.expenses = [];
      return;
    }

    return new Promise<void>((resolve) => {
      this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot).subscribe({
        next: (data) => {
          // Filtrar por tipo seleccionado (RETIRO o UTILIDADES) y cuenta bancaria
          let filtered = (data || []).filter((item: any) => {
            return item.type === this.selectedExpenseType && item.idAccount === this._idAccount;
          });

          // Si hay socio seleccionado, filtrar por idCustomer (ID codificado del socio)
          if (this._idStakeholder) {
            filtered = filtered.filter((item: any) => item.idCustomer === this._idStakeholder);
          }

          // Agregar el nombre del socio decodificado y propiedades para master-detail
          this.expenses = filtered.map((item: any) => {
            const countItems = item.countItems || item.countitems || 0;
            return {
              ...item,
              stakeholderName: this.getStakeholderNameFromId(item.idCustomer),
              countItems: countItems,
              detailType: null,
              detailData: [],
              visible: true
            };
          });

          console.log(`✅ ${this.selectedExpenseType === 'RETIRO' ? 'Retiros de socios' : 'Retiros de utilidades'} cargados:`, this.expenses.length);
          resolve();
        },
        error: (err) => {
          console.error('Error obteniendo retiros:', err);
          this.expenses = [];
          resolve();
        }
      });
    });
  }

  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return [
      date.getDate().toString().padStart(2, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getFullYear()
    ].join('/');
  }

  // Cache para definiciones de columnas
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
        field: 'countitems',
        headerName: 'Items',
        width: 80,
        cellRenderer: ButtonCellRendererStakeholderComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data.countItems || params.data.countitems || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdfReport',
        headerName: 'PDF',
        width: 70,
        cellRenderer: PdfButtonCellRendererStakeholderComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            console.log('🔵 PDF Click detectado:', node.data.id);
            this.toggleReportDetail(node);
          },
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Hacer clic para generar el reporte PDF'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'numberDocument',
        headerName: '# Documento',
        editable: true,
        filter: true,
        width: 130
      },
      {
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        cellDataType: 'date',
        width: 110,
        valueFormatter: (params) => this.formatDate(params.value)
      },
      {
        field: 'stakeholderName',
        headerName: 'Socio',
        editable: false, // No editable, se define por el filtro de socio
        width: 180,
        filter: true,
        cellStyle: { backgroundColor: '#e8f5e9', fontWeight: '500' },
        valueGetter: (params) => {
          // Si ya tiene stakeholderName calculado, usarlo
          if (params.data?.stakeholderName) return params.data.stakeholderName;
          // Si no, decodificar desde idCustomer
          if (params.data?.idCustomer) {
            return this.getStakeholderNameFromId(params.data.idCustomer);
          }
          return '';
        }
      },
      {
        field: 'idProject',
        headerName: 'Proyecto',
        editable: true,
        width: 180,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.projects ? this.projects.map((p) => p.id) : []
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const project = this.projects?.find((p) => p.id === params.value);
          return project ? project.name : params.value;
        },
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        width: 250,
        filter: true,
        cellClass: 'description-cell',
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          cols: 50,
          rows: 3,
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value || '';
          return `<div class="description-content" style="word-wrap: break-word; white-space: normal; line-height: 1.2;">${value}</div>`;
        }
      },
      {
        field: 'subtotal',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        width: 120,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        cellStyle: { backgroundColor: '#f5f5f5' }
      },
      {
        field: 'tax',
        headerName: 'Impuestos',
        type: 'number',
        editable: false,
        width: 100,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        cellStyle: { backgroundColor: '#f5f5f5' }
      },
      {
        field: 'total',
        headerName: 'Total',
        type: 'number',
        editable: false,
        width: 120,
        valueGetter: (params) => {
          const subtotal = params.data?.subtotal || 0;
          const tax = params.data?.tax || 0;
          return subtotal + tax;
        },
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        cellStyle: { fontWeight: 'bold', backgroundColor: '#e8f5e9' }
      },
      {
        field: 'paymentMonth',
        headerName: 'Mes',
        editable: true,
        width: 110,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        }
      },
      {
        field: 'status',
        headerName: 'Estatus',
        editable: true,
        width: 110,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Pendiente', 'Pagada', 'Cancelada']
        }
      }
    ];

    return this._colDefs;
  }

  private refreshColumnDefinitions() {
    this._colDefs = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
    }
  }

  private updateDetailContext() {
    if (this.gridApi) {
      console.log('🔄 Actualizando contexto del detalle. Proyectos:', this.projects.length, 'Tipo:', this.selectedExpenseType);
      this.gridApi.setGridOption('detailCellRendererParams', {
        getDetailRowData: (params: any) => {
          params.successCallback(params.data.detailData || []);
        },
        context: {
          idRoot: this.idRoot,
          componentParent: this,
          gridApi: this.gridApi,
          rootService: this.rootService,
          base64EncodeService: this.base64EncodeService,
          administrationService: this.administrationService,
          projects: this.projects,
          selectedExpenseType: this.selectedExpenseType,
          CONCEPTS: {
            load: (expenditureId: number, callback: (data: any[]) => void) => {
              this.loadConceptsData(expenditureId, callback);
            },
            save: (expenditureId: number, data: any) => {
              return this.saveConceptsById(expenditureId, data);
            },
            delete: (params: any, callback: () => void, newCount?: number) => {
              this.deleteConceptRow(params, callback, newCount);
            },
            updateCount: (expenditureId: number, count: number) => {
              this.updateExpenseCountItems(expenditureId, count);
            },
            updateTotals: (expenditureId: number, subtotal: number, tax: number, total: number) => {
              this.updateMasterTotalsRealTime(expenditureId, subtotal, tax, total);
            }
          }
        }
      });
      console.log('✅ Contexto del detalle actualizado');
    }
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedExpense = selectedNodes[0].data;
    } else {
      this.selectedExpense = null;
    }
  }

  onCellValueChanged(event: any) {
    // Recalcular total cuando cambia subtotal o tax
    if (event.colDef.field === 'subtotal' || event.colDef.field === 'tax') {
      const subtotal = event.data.subtotal || 0;
      const tax = event.data.tax || 0;
      event.data.total = subtotal + tax;
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['total'] });
    }

    if (!event.data.__isNew) {
      event.data.modifiedBy = this.currentUser;
      event.data.modifiedAt = new Date().toISOString();
    }

    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    // Configurar el detailCellRendererParams
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData || []);
      },
      context: {
        idRoot: this.idRoot,
        componentParent: this,
        gridApi: this.gridApi,
        rootService: this.rootService,
        base64EncodeService: this.base64EncodeService,
        administrationService: this.administrationService,
        projects: this.projects,
        selectedExpenseType: this.selectedExpenseType,
        CONCEPTS: {
          load: (expenditureId: number, callback: (data: any[]) => void) => {
            this.loadConceptsData(expenditureId, callback);
          },
          save: (expenditureId: number, data: any) => {
            return this.saveConceptsById(expenditureId, data);
          },
          delete: (params: any, callback: () => void, newCount?: number) => {
            this.deleteConceptRow(params, callback, newCount);
          },
          updateCount: (expenditureId: number, count: number) => {
            this.updateExpenseCountItems(expenditureId, count);
          },
          updateTotals: (expenditureId: number, subtotal: number, tax: number, total: number) => {
            this.updateMasterTotalsRealTime(expenditureId, subtotal, tax, total);
          }
        }
      }
    });
  }

  addRow() {
    if (!this.idAccount) {
      alerts.basicAlert('Error', 'Seleccione una cuenta bancaria primero', 'error');
      return;
    }

    if (!this._idStakeholder) {
      alerts.basicAlert('Error', 'Seleccione un socio primero', 'error');
      return;
    }

    const typeLabel = this.selectedExpenseType === 'RETIRO' ? 'Retiro de Socio' : 'Retiro de Utilidades';
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Creación de ${typeLabel}`,
      'Retiro Socios',
      this.trackingService.getEmail()
    );

    const tempId = `temp_${this.tempIdCounter++}`;
    const selectedStakeholder = this._idStakeholder
      ? this.stakeholders.find(s => s.id === this._idStakeholder)
      : null;

    const descriptionByType = this.selectedExpenseType === 'RETIRO' ? 'RETIRO DE SOCIO' : 'RETIRO DE UTILIDADES';

    const newItem = {
      id: tempId,
      idAccount: this._idAccount,
      numberDocument: '',
      idBusinnes: this.idRoot,
      idBranch: this.idBranch > 0 ? this.idBranch : null,
      date: new Date().toISOString(),
      idCustomer: this._idStakeholder, // ID codificado del socio (corporativoId * 10 + partnerNumber)
      stakeholderName: selectedStakeholder?.name || '', // Solo para mostrar en el grid
      idProject: null,
      description: descriptionByType,
      type: this.selectedExpenseType,
      subtotal: 0,
      tax: 0,
      total: 0,
      countItems: 0,
      countitems: 0,
      paymentMonth: '',
      createdBy: this.currentUser || 'Usuario temporal',
      createdAt: new Date().toISOString(),
      modifiedBy: null,
      modifiedAt: new Date().toISOString(),
      status: 'Pagada',
      active: true,
      __isNew: true,
      visible: true,
      detailType: null,
      detailData: []
    };

    this.expenses = [newItem, ...this.expenses];
    this.notSavedChanges = true;

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'date'
      });
    }, 50);
  }

  async saveChanges() {
    const requiredFields = [
      { field: 'date', label: 'Fecha', check: (v: any) => !!v },
      { field: 'idCustomer', label: 'Socio', check: (v: any) => !!v && v > 0 },
      { field: 'description', label: 'Descripción', check: (v: any) => !!v },
    ];

    for (const item of this.expenses) {
      for (const rf of requiredFields) {
        if (!rf.check(item[rf.field])) {
          alerts.basicAlert('Campo requerido', `Falta llenar el campo: "${rf.label}"`, 'error');
          return;
        }
      }
    }

    const newRows = this.expenses.filter((row) => row.__isNew);
    const modifiedRows = this.expenses.filter((row) => row.__modified && !row.__isNew);

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.incomesAndExpensesService.updateIncomesAndExpenses(row.id, cleanedData);
    });

    try {
      if (addObservables.length > 0 || updateObservables.length > 0) {
        await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
      }

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Guardar Retiros de Socios',
        'Retiro Socios',
        this.trackingService.getEmail()
      );

      this.notSavedChanges = false;
      await this.loadStakeholderExpenses();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.', 'error');
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    const result = await alerts.confirmAlert(
      '¿Eliminar retiro?',
      `¿Está seguro que desea eliminar el retiro de "${selectedData.stakeholderName}"? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    if (id.toString().startsWith('temp_')) {
      this.expenses = this.expenses.filter(e => e.id !== id);
      this.notSavedChanges = this.expenses.some(e => e.__isNew || e.__modified);
      return;
    }

    this.incomesAndExpensesService.deleteIncomesAndExpenses(id).pipe(
      catchError((error) => {
        alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
      this.loadStakeholderExpenses();
      this.notSavedChanges = false;
      this.selectedExpense = null;
    });
  }

  revert() {
    this.loadStakeholderExpenses();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.visible;
    delete cleanedData.stakeholderName; // Solo es para mostrar, no se guarda
    delete cleanedData.detailType;
    delete cleanedData.detailData;

    // Sincronizar countItems (frontend) → countitems (backend)
    if ('countItems' in cleanedData) {
      cleanedData.countitems = cleanedData.countItems;
      delete cleanedData.countItems;
    }

    // Calcular total
    cleanedData.total = (cleanedData.subtotal || 0) + (cleanedData.tax || 0);

    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== REPORTE PDF ====================
  showReportModal: boolean = false;
  reportStartDate: string = '';
  reportEndDate: string = '';
  isGeneratingReport: boolean = false;

  openReportModal() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDay = new Date(prev.getFullYear(), prev.getMonth(), 1);
    const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
    this.reportStartDate = this.formatDateForInput(firstDay);
    this.reportEndDate = this.formatDateForInput(lastDay);
    this.showReportModal = true;
    document.body.classList.add('modal-open');
  }

  closeReportModal() {
    this.showReportModal = false;
    document.body.classList.remove('modal-open');
  }

  private formatDateForInput(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatCurrency(amount: number): string {
    return (amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async generateReport() {
    if (!this.reportStartDate || !this.reportEndDate) {
      alerts.basicAlert('Error', 'Por favor seleccione ambas fechas', 'error');
      return;
    }

    const [sy, sm, sd] = this.reportStartDate.split('-');
    const [ey, em, ed] = this.reportEndDate.split('-');
    const startDate = new Date(+sy, +sm - 1, +sd);
    const endDate = new Date(+ey, +em - 1, +ed);

    if (startDate > endDate) {
      alerts.basicAlert('Error', 'La fecha de inicio no puede ser mayor que la fecha de término', 'error');
      return;
    }

    // Obtener todos los retiros (sin filtro de cuenta/socio para el reporte)
    const allExpenses = await this.getAllStakeholderExpenses();

    const filtered = allExpenses.filter((item: any) => {
      if (!item.date) return false;
      const d = new Date(item.date);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return ds >= this.reportStartDate && ds <= this.reportEndDate;
    });

    if (filtered.length === 0) {
      alerts.basicAlert('Sin datos', 'No se encontraron retiros en el rango de fechas seleccionado', 'warning');
      return;
    }

    this.isGeneratingReport = true;

    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

      const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(this.idRoot));
      const companyName: string = rootResponse?.name || rootResponse?.nameCompany || 'Empresa';
      const logoBase64 = rootResponse?.picture
        ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture)
        : null;

      const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const startDateObj = new Date(+sy, +sm - 1, 1);
      const endDateObj = new Date(+ey, +em - 1, 1);
      let periodText = '';
      if (+sy === +ey && +sm === +em) {
        periodText = `MES DE ${meses[startDateObj.getMonth()]} ${sy}`;
      } else if (+sy === +ey) {
        periodText = `PERIODO DE ${meses[startDateObj.getMonth()]} A ${meses[endDateObj.getMonth()]} ${sy}`;
      } else {
        periodText = `PERIODO DE ${meses[startDateObj.getMonth()]} ${sy} A ${meses[endDateObj.getMonth()]} ${ey}`;
      }

      const tableBody: any[] = [[
        { text: 'FECHA', style: 'th', alignment: 'center' },
        { text: 'SOCIO', style: 'th', alignment: 'left' },
        { text: 'PROYECTO', style: 'th', alignment: 'left' },
        { text: 'DESCRIPCIÓN', style: 'th', alignment: 'left' },
        { text: 'SUBTOTAL', style: 'th', alignment: 'right' },
        { text: 'IMPUESTOS', style: 'th', alignment: 'right' },
        { text: 'TOTAL', style: 'th', alignment: 'right' },
        { text: 'MES', style: 'th', alignment: 'center' },
        { text: 'ESTATUS', style: 'th', alignment: 'center' },
      ]];

      let totalSubtotal = 0;
      let totalTax = 0;
      let totalGeneral = 0;

      // Agrupar por socio
      const groupedBySocio: { [key: string]: any[] } = {};
      filtered.forEach((item: any) => {
        const socio = item.stakeholderName || 'Sin asignar';
        if (!groupedBySocio[socio]) {
          groupedBySocio[socio] = [];
        }
        groupedBySocio[socio].push(item);
      });

      Object.keys(groupedBySocio).sort().forEach(socio => {
        let socioSubtotal = 0;
        let socioTax = 0;
        let socioTotal = 0;

        groupedBySocio[socio].forEach((item: any, idx: number) => {
          const project = this.projects.find(p => p.id === item.idProject);
          const subtotal = item.subtotal || 0;
          const tax = item.tax || 0;
          const total = subtotal + tax;

          socioSubtotal += subtotal;
          socioTax += tax;
          socioTotal += total;

          tableBody.push([
            { text: this.formatDate(item.date), style: 'td', alignment: 'center' },
            { text: item.stakeholderName || '', style: 'td', alignment: 'left' },
            { text: project?.name || '', style: 'td', alignment: 'left' },
            { text: item.description || '', style: 'td', alignment: 'left' },
            { text: `$${this.formatCurrency(subtotal)}`, style: 'td', alignment: 'right' },
            { text: `$${this.formatCurrency(tax)}`, style: 'td', alignment: 'right' },
            { text: `$${this.formatCurrency(total)}`, style: 'td', alignment: 'right', bold: true },
            { text: item.paymentMonth || '', style: 'td', alignment: 'center' },
            { text: item.status || '', style: 'td', alignment: 'center' },
          ]);
        });

        // Subtotal por socio
        tableBody.push([
          { text: `Subtotal ${socio}:`, colSpan: 4, style: 'subtotalLabel', alignment: 'right', bold: true, fillColor: '#e8f5e9' },
          {}, {}, {},
          { text: `$${this.formatCurrency(socioSubtotal)}`, style: 'subtotalValue', alignment: 'right', bold: true, fillColor: '#e8f5e9' },
          { text: `$${this.formatCurrency(socioTax)}`, style: 'subtotalValue', alignment: 'right', bold: true, fillColor: '#e8f5e9' },
          { text: `$${this.formatCurrency(socioTotal)}`, style: 'subtotalValue', alignment: 'right', bold: true, fillColor: '#e8f5e9', color: '#1a5276' },
          { text: '', fillColor: '#e8f5e9' },
          { text: '', fillColor: '#e8f5e9' },
        ]);

        totalSubtotal += socioSubtotal;
        totalTax += socioTax;
        totalGeneral += socioTotal;
      });

      // Total general
      tableBody.push([
        { text: 'TOTAL GENERAL:', colSpan: 4, style: 'totalLabel', alignment: 'right', bold: true, fillColor: '#1a5276', color: '#ffffff' },
        {}, {}, {},
        { text: `$${this.formatCurrency(totalSubtotal)}`, style: 'totalValue', alignment: 'right', bold: true, fillColor: '#1a5276', color: '#ffffff' },
        { text: `$${this.formatCurrency(totalTax)}`, style: 'totalValue', alignment: 'right', bold: true, fillColor: '#1a5276', color: '#ffffff' },
        { text: `$${this.formatCurrency(totalGeneral)}`, style: 'totalValue', alignment: 'right', bold: true, fillColor: '#1a5276', color: '#ffffff' },
        { text: '', fillColor: '#1a5276' },
        { text: '', fillColor: '#1a5276' },
      ]);

      const logoCell: any = logoBase64
        ? { image: logoBase64, width: 70, alignment: 'left' }
        : { text: companyName, bold: true, fontSize: 11, alignment: 'left' };

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'landscape',
        pageMargins: [20, 60, 20, 40],
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} / ${pageCount}`,
          alignment: 'center',
          fontSize: 7,
          margin: [0, 10, 0, 0]
        }),
        header: () => ({
          margin: [20, 8, 20, 0],
          table: {
            widths: ['20%', '*', '25%'],
            body: [[
              logoCell,
              {
                stack: [
                  { text: 'REPORTE DE RETIROS DE SOCIOS', style: 'reportTitle', alignment: 'center' },
                  { text: 'Sistema de Gestión de Calidad', fontSize: 8, alignment: 'center', color: '#555' },
                  { text: periodText, fontSize: 7, alignment: 'center', color: '#333', margin: [0, 2, 0, 0] },
                ]
              },
              {
                stack: [
                  { text: 'Referencia: RET-SOC-001', fontSize: 7, alignment: 'right' },
                  { text: 'Código: HCO-ADM-FO-020', fontSize: 7, alignment: 'right' },
                  { text: 'Rev.: 00', fontSize: 7, alignment: 'right' },
                ]
              }
            ]]
          },
          layout: 'noBorders'
        }),
        content: [{
          table: {
            headerRows: 1,
            widths: [55, 90, 80, '*', 65, 55, 65, 55, 55],
            body: tableBody
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
            vLineWidth: () => 0.3,
            hLineColor: () => '#aaa',
            vLineColor: () => '#ccc',
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a5276' : null,
          }
        }],
        styles: {
          reportTitle: { fontSize: 12, bold: true, color: '#1a5276' },
          th: { fontSize: 8, bold: true, color: '#ffffff', margin: [2, 4, 2, 4] },
          td: { fontSize: 7, color: '#222', margin: [2, 2, 2, 2] },
          subtotalLabel: { fontSize: 7, margin: [2, 2, 2, 2] },
          subtotalValue: { fontSize: 7, margin: [2, 2, 2, 2] },
          totalLabel: { fontSize: 8, margin: [2, 4, 2, 4] },
          totalValue: { fontSize: 8, margin: [2, 4, 2, 4] },
        }
      };

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`reporte-retiros-socios-${this.reportStartDate}-al-${this.reportEndDate}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }

      this.closeReportModal();
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Reporte de Retiros de Socios generado: ${this.reportStartDate} al ${this.reportEndDate}`,
        'Retiro Socios - Reporte',
        this.trackingService.getEmail()
      );

    } catch (error) {
      console.error('Error generando reporte:', error);
      alerts.basicAlert('Error', 'Error al generar el reporte PDF', 'error');
    } finally {
      this.isGeneratingReport = false;
    }
  }

  private async getAllStakeholderExpenses(): Promise<any[]> {
    return new Promise((resolve) => {
      this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot).subscribe({
        next: (data) => {
          const filtered = (data || []).filter((item: any) => item.type === 'RETIRO');
          // Agregar el nombre del socio decodificado
          const withNames = filtered.map((item: any) => ({
            ...item,
            stakeholderName: this.getStakeholderNameFromId(item.idCustomer)
          }));
          resolve(withNames);
        },
        error: () => resolve([])
      });
    });
  }

  // Métodos para cálculos de totales en el template
  getTotalSubtotal(): string {
    const total = this.expenses.reduce((sum, e) => sum + (e.subtotal || 0), 0);
    return total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  getTotalTax(): string {
    const total = this.expenses.reduce((sum, e) => sum + (e.tax || 0), 0);
    return total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  getGrandTotal(): string {
    const total = this.expenses.reduce((sum, e) => sum + (e.subtotal || 0) + (e.tax || 0), 0);
    return total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  // ==================== MÉTODOS PARA MASTER-DETAIL ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'concepts';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
    } else {
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

      if (node.expanded && node.data.detailType !== 'concepts') {
        node.setExpanded(false);
      }

      node.data.detailType = 'concepts';

      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  async toggleReportDetail(node: any) {
    console.log('🟢 toggleReportDetail llamado - ID:', node.data.id, 'isGenerating:', this.isGeneratingPdfReport);

    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report';

    if (isCurrentlyExpanded) {
      console.log('🟡 Colapsando reporte expandido');
      node.setExpanded(false);
      node.data.detailType = null;
      this.externalFilterActive = false;
      api.forEachNode((n: any) => {
        n.data.visible = true;
      });
      api.onFilterChanged();
      return;
    }

    if (this.isGeneratingPdfReport) {
      console.log('🔴 Ya se está generando un reporte, ignorando clic');
      alerts.basicAlert(
        'Procesando',
        'Ya se está generando un reporte. Por favor espere.',
        'warning'
      );
      return;
    }

    this.isGeneratingPdfReport = true;
    console.log('🟢 Iniciando generación de reporte');

    let progress = 0;
    alerts.showLoadingWithProgress(
      'Generando reporte...',
      'Por favor espere mientras se procesa el documento',
      progress
    );

    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) {
        alerts.updateLoadingProgress(
          'Generando reporte...',
          'Por favor espere mientras se procesa el documento',
          progress
        );
      }
    }, 100);

    try {
      this.externalFilterActive = true;
      api.forEachNode((n: any) => {
        n.data.visible = n.id === node.id ? true : false;
      });
      api.onFilterChanged();

      if (node.expanded && node.data.detailType !== 'report') {
        node.setExpanded(false);
      }

      node.data.detailType = 'report';

      await new Promise(resolve => setTimeout(resolve, 1000));
      node.setExpanded(true);

      clearInterval(progressInterval);
      alerts.updateLoadingProgress(
        'Reporte generado',
        'El documento se ha procesado correctamente',
        100
      );

      console.log('✅ Reporte generado exitosamente');

      setTimeout(() => {
        alerts.closeLoading();
        this.isGeneratingPdfReport = false;
        console.log('🔓 Lock liberado');
      }, 800);

    } catch (error) {
      clearInterval(progressInterval);
      alerts.closeLoading();
      this.isGeneratingPdfReport = false;
      console.log('🔴 Error generando reporte, lock liberado');
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al generar el reporte. Por favor, intente nuevamente.',
        'error'
      );
      console.error('Error generando reporte:', error);
    }
  }

  collapseCurrentRow(expenditureId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });
      this.externalFilterActive = false;
      this.gridApi.forEachNode((node) => {
        node.data.visible = true;
      });
      this.gridApi.onFilterChanged();
    }
  }

  // ==================== MÉTODOS PARA CONCEPTOS ====================

  updateExpenseCountItems(expenditureId: number, count: number) {
    console.log(`🔄 PADRE: updateExpenseCountItems llamado. ID: ${expenditureId}, Nuevo Count: ${count}`);
    if (this.gridApi) {
      let found = false;
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          found = true;
          const oldCount = node.data.countItems;
          console.log(`   Registro encontrado. ID: ${expenditureId}, Count anterior: ${oldCount}, Count nuevo: ${count}`);
          node.data.countItems = count;
          node.data.countitems = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countitems'],
            force: true
          });
        }
      });
      if (!found) {
        console.warn(`   ⚠️ No se encontró el registro con ID ${expenditureId} en el grid`);
      }
    } else {
      console.warn('   ⚠️ gridApi no está disponible');
    }
  }

  updateMasterTotalsRealTime(expenditureId: number, subtotal: number, tax: number, total: number) {
    console.log(`💰 PADRE: updateMasterTotalsRealTime. ID: ${expenditureId}, Subtotal: ${subtotal}, Tax: ${tax}, Total: ${total}`);
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === expenditureId) {
          node.data.subtotal = subtotal;
          node.data.tax = tax;
          node.data.total = total;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['subtotal', 'tax', 'total'],
            force: true
          });
        }
      });
    }
  }

  loadConceptsData(expenditureId: number, successCallback: any) {
    console.log('🟢 PADRE: Cargando conceptos desde servidor para ID:', expenditureId);
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(expenditureId).subscribe({
      next: (data: any) => {
        console.log(`✅ PADRE: Conceptos recibidos del servidor para ID ${expenditureId}:`, data?.length || 0);
        if (data && data.length > 0) {
          console.log('   Primer concepto:', data[0]);
        }
        successCallback(data);
      },
      error: (error) => {
        console.error('❌ PADRE: Error loading concepts para ID', expenditureId, error);
        successCallback([]);
      }
    });
  }

  async saveConceptsById(expenditureId: number, data: any) {
    console.log('💾 PADRE: saveConceptsById iniciado. ID:', expenditureId);
    console.log('💾 PADRE: Data recibida:', data);

    const conceptsData = data.concepts || data;
    const subtotal = data.subtotal || 0;
    const tax = data.tax || 0;
    const total = data.total || 0;

    const newConcepts = conceptsData.filter((row: any) => row.__isNew);
    const modifiedConcepts = conceptsData.filter((row: any) => row.__modified && !row.__isNew);

    console.log('💾 PADRE: Conceptos NUEVOS:', newConcepts.length);
    console.log('💾 PADRE: Conceptos MODIFICADOS:', modifiedConcepts.length);
    console.log('💾 PADRE: Total conceptos:', conceptsData.length);

    try {
      // Guardar conceptos nuevos
      for (const concept of newConcepts) {
        const cleaned = this.cleanConceptData(concept);
        await lastValueFrom(this.incomesAndExpensesService.addConceptFromIncomesAndExpenses(cleaned));
      }

      // Actualizar conceptos modificados
      for (const concept of modifiedConcepts) {
        const cleaned = this.cleanConceptData(concept);
        await lastValueFrom(this.incomesAndExpensesService.updateConceptFromIncomesAndExpenses(concept.id, cleaned));
      }

      // Actualizar el documento principal con los totales
      const mainDocumentResponse: any[] = await lastValueFrom(
        this.incomesAndExpensesService.getIncomeAndExpenseById(expenditureId)
      );

      const mainDocument = mainDocumentResponse[0];

      // Preservar idProject desde el grid: puede tener un valor no guardado aún en BD
      const rowNode = this.gridApi?.getRowNode(expenditureId.toString());
      const updatedDocument = {
        ...mainDocument,
        idProject: rowNode?.data?.idProject ?? mainDocument.idProject,
        subtotal: subtotal,
        tax: tax,
        total: total,
        countitems: conceptsData.length
      };

      await lastValueFrom(
        this.incomesAndExpensesService.updateIncomesAndExpenses(expenditureId, updatedDocument)
      );

      if (newConcepts.length > 0 || modifiedConcepts.length > 0) {
        alerts.basicAlert(
          'Conceptos guardados',
          'Se han guardado los conceptos correctamente.',
          'success'
        );
      }

      console.log('💾 PADRE: Actualizando maestro después de guardar. ID:', expenditureId);

      this.updateExpenseCountItems(expenditureId, conceptsData.length);

      this.updateMasterRowInGrid({
        id: expenditureId,
        subtotal: subtotal,
        tax: tax,
        total: total
      });

      console.log('✅ PADRE: Maestro actualizado con totales');

    } catch (error) {
      console.error('Error saving concepts:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los conceptos.',
        'error'
      );
    }
  }

  async deleteConceptRow(params: any, successCallback: () => void, newCount?: number) {
    const conceptId = params.data.id;
    const expenditureId = params.data.idIncorExp;

    if (params.data.__isNew) {
      if (params.api) {
        params.api.applyTransaction({ remove: [params.data] });
      }
      successCallback();
    } else {
      try {
        await lastValueFrom(this.incomesAndExpensesService.deleteConceptFromIncomesAndExpenses(conceptId));

        // Actualizar countItems en la base de datos
        if (expenditureId && typeof newCount === 'number') {
          const mainDocResponse: any[] = await lastValueFrom(
            this.incomesAndExpensesService.getIncomeAndExpenseById(expenditureId)
          );
          if (mainDocResponse && mainDocResponse[0]) {
            const mainDoc = mainDocResponse[0];
            const updatedDoc = {
              ...mainDoc,
              countitems: newCount
            };
            await lastValueFrom(
              this.incomesAndExpensesService.updateIncomesAndExpenses(expenditureId, updatedDoc)
            );
            console.log(`✅ countItems actualizado en BD: ${newCount}`);
          }
        }

        alerts.basicAlert('Concepto eliminado', 'El concepto se eliminó correctamente.', 'success');
        if (params.api) {
          params.api.applyTransaction({ remove: [params.data] });
        }
        successCallback();
      } catch (error) {
        console.error('Error deleting concept:', error);
        alerts.basicAlert('Error', 'Error al eliminar el concepto.', 'error');
      }
    }
  }

  private cleanConceptData(concept: any): any {
    const cleaned = { ...concept };
    delete cleaned.__isNew;
    delete cleaned.__modified;
    if (cleaned.id && cleaned.id.toString().startsWith('temp_')) {
      delete cleaned.id;
    }
    return cleaned;
  }

  private updateMasterRowInGrid(updatedData: { id: number; subtotal: number; tax: number; total: number }) {
    console.log('🔄 updateMasterRowInGrid iniciado con:', updatedData);

    if (!this.gridApi) {
      console.log('❌ gridApi no disponible');
      return;
    }

    if (!updatedData?.id) {
      console.log('❌ updatedData o id no válidos');
      return;
    }

    const rowNode = this.gridApi.getRowNode(updatedData.id.toString());

    if (rowNode) {
      const currentData = rowNode.data;
      currentData.subtotal = updatedData.subtotal;
      currentData.tax = updatedData.tax;
      currentData.total = updatedData.total;

      this.gridApi.applyTransaction({ update: [currentData] });

      setTimeout(() => {
        this.gridApi.refreshCells({
          rowNodes: [rowNode],
          columns: ['subtotal', 'tax', 'total'],
          force: true
        });
      }, 100);

      console.log(`✅ Fila maestra ${updatedData.id} actualizada con nuevos totales.`);
    } else {
      console.warn(`⚠️ No se encontró la fila ${updatedData.id} en el grid.`);
    }
  }
}
