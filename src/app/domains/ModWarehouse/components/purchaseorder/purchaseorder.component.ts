import { Component, effect, HostListener, inject } from '@angular/core';
import Swal from 'sweetalert2';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridChartsModule,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { hasPersistedMasterId } from 'app/helpers/master-detail-guard';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProvidersService } from 'app/services/providers.service';
import { DepartmentsService } from 'app/services/departments.service';
import { CurrencyService } from 'app/services/currency.service';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { ModalService } from 'app/services/modal.service';
import { ReceiptsService } from 'app/services/receipts.service';
import { UsersService } from 'app/services/users.service';
import { MaterialsService } from 'app/services/materials.service';
import { SetupService } from 'app/services/setup.service';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { NotificationsTelegramService } from 'app/services/notifications-telegram.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { restoreGridColumnWidths, saveGridColumnWidths } from 'app/helpers/grid-column-widths';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPurchaseOrderItemsComponent } from './detail-cell-renderer-purchase-order-items.component';
import { PdfButtonCellRendererPurchaseOrderComponent } from './pdf-button-cell-renderer-purchaseorder.component';
import { DetailCellRendererPurchaseOrderReportComponent } from './detail-cell-renderer-purchaseorder-report.component';

interface Catalog {
  id: number;
  description: string;
}

interface Provider {
  id: number;
  name: string;
}

@Component({
  selector: 'app-purchaseorder',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, DetailCellRendererPurchaseOrderItemsComponent, DetailCellRendererPurchaseOrderReportComponent],
  templateUrl: './purchaseorder.component.html',
  styleUrl: './purchaseorder.component.scss',
})
export class PurchaseOrderComponent implements CanComponentDeactivate {
  // Inject of new way for Angular 18
  private requisitionsService = inject(OcAndReqsService);
  private requisitionBalanceRequest = 0;
  private providersService = inject(ProvidersService);
  private catalogsService = inject(CatalogsService);
  private departmentsService = inject(DepartmentsService);
  private currencyService = inject(CurrencyService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private receiptsService = inject(ReceiptsService);
  private usersService = inject(UsersService);
  private materialsService = inject(MaterialsService);
  private customersService = inject(CustomersService);
  private setupService = inject(SetupService);
  private prefixSetupService = inject(PrefixSetupService);
  private notificationsService = inject(NotificationsTelegramService);
  private permitionsService = inject(PermitionsService);
  private trackingService = inject(TrackingService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private administrationService = inject(AdministrationService);
  private cuentasContablesService = inject(CuentasContablesService);

  // Variables compartidas

  masterNotSavedChanges: boolean = false;
  detailsNotSavedChanges: boolean = false;
  id: string = null;
  idBranch: number = null;
  idProject: number = null;
  idReference: number = null;
  private tempIdCounter: number = 0;
  idRequisition: number = null;
  private expandedRowId: string | null = null;
  private masterGridApi: GridApi;
  private _colMaster: ColDef[] = [];
  private detailsGridApi: GridApi;
  private gridApi: GridApi;
  idRoot: number = null;
  projectOrBranch: boolean = null; // True = Project, False = Branch
  typeReference: string = null; // project or branch
  activateOc: boolean = true; // True = OC enabled, False = disabled

  // Variables Master
  masterRowData: any[] = [];
  private isPurchaseOrdersLoaded = false;
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];

  // Catálogos Master
  requisiciones: any[] = [];
  almacenes: any[] = [];
  proveedores: any[] = [];
  departamentos: any[] = [];
  private defaultDepartmentId: number | null = null;
  ubicaciones: any[] = [];
  monedas: any[] = [];
  usuarios: any[] = [];
  tipoPago: any[] = [];
  private defaultsEnsured = false;
  private currenciesLoaded = false;
  private paymentsLoaded = false;

  // Variables Details
  detailsRowData: any[] = [];
  detailsSelectedRowData: any = null;
  newlyAddedDetailRows: string[] = [];

  // Catálogos Details
  productos: any[] = [];
  gastosAceptanOc: any[] = [];

  // Configuración Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentProject = this.signalsService.getProjectSelectedBySidebar()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();
      const currentRequisition = this.signalsService.getIdRequisition()();

      // Si cambió el root, limpiar datos
      if (this.idRoot !== currentRoot) {
        this.clearAllData();
      }

      this.idRoot = currentRoot;
      this.idProject = currentProject;
      this.idBranch = currentBranch;
      this.idRequisition = currentRequisition;

      if (this.idRoot) {
        this.getSetupData().then(() => {
          this.idReference = this.projectOrBranch ? this.idProject : this.idBranch;
          
          // Solo cargar datos si tenemos la referencia apropiada
          if (this.idReference) {
            this.obtenerDatos();
            this.obtenerRequisiciones();
            this.obtenerProductos();
            this.obtenerAlmacenes();
            this.obtenerGastosAceptanOc();
            if (this.idRequisition != null) {
              this.obtenerDetalles();
            }
          }
        });
      }
    });
  }

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    this.signalsService.deleteRequisitionData();
    this.idProject = this.signalsService.getProjectSelectedBySidebar()();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idRequisition = this.signalsService.getIdRequisition()();

    this.getSetupData().then(() => {
      this.idReference = this.projectOrBranch ? this.idProject : this.idBranch;
      this.obtenerDatos();
      this.obtenerDepartamentos();
      this.obtenerUbicaciones();
      this.obtenerMonedas();
      this.obtenerUsuarios();
      this.obtenerRequisiciones();
      this.obtenerProveedores();
      this.obtenerTipoPago();
      this.obtenerProductos();
      this.obtenerGastosAceptanOc();
    });
  }

  obtenerAlmacenes(): void {
    const email = this.trackingService.getEmail();
    if (!email) return;
    this.permitionsService.getPermisionswarehousexEmail(email).subscribe({
      next: (data: any) => {
        this.almacenes = (Array.isArray(data) ? data : []).map((warehouse: any) => ({ id: warehouse.idAlmacen ?? warehouse.idWarehouse ?? warehouse.id, name: warehouse.nombreAlmacen ?? warehouse.nameWarehouse ?? warehouse.name ?? warehouse.description })).filter((warehouse: any) => warehouse.id != null);
        this.masterGridApi?.refreshCells({ force: true });
      },
      error: () => { this.almacenes = []; }
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges || this.detailsNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    animateRows: false,
    masterDetail: true,
    detailRowHeight: 1400,
    isRowMaster: (dataItem: any) => true,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'report') {
        return {
          component: DetailCellRendererPurchaseOrderReportComponent,
          params: {
            proveedores: this.proveedores,
            usuarios: this.usuarios,
            productos: this.productos
          }
        };
      }
      // Por defecto, mostrar items
      return { component: DetailCellRendererPurchaseOrderItemsComponent };
    },
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      if (params.data?.__isNew) {
        return 'new-row-highlight';
      }
      if (params.data?.__modified) {
        return 'modified-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      if (event.column?.getColId() === 'authorizationAction') return;
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Corregir usando el api del evento y verificando existencia
      if (event.node.isSelected() && event.api) {
        event.api.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellValueChanged: (event: any) => {
      if (event.colDef?.field === 'idAuthorize' && Number(event.newValue) > 0) {
        const authorizer = (this.usuarios || []).find((user: any) => Number(user.id) === Number(event.newValue));
        alerts.basicAlert(
          'Autorizador seleccionado',
          `${authorizer?.displayName || 'El usuario seleccionado'} quedó asignado. Guarda los cambios para aplicar la autorización.`,
          'success'
        );
      }
      if (event.colDef.field === 'idReq') {
        const requisicion = this.requisiciones.find((r: any) => Number(r.id) === Number(event.data.idReq));
        if (requisicion) {
          event.data.idWarehouse = requisicion.idWarehouse || null;
          // La importación se realiza después de guardar la OC y contar con su id real.
          event.data.__pendingRequisitionItemImport = requisicion.id;
        }
      }
      event.data.__modified = true;
      this.masterNotSavedChanges = true;
      setTimeout(() => {
        this.masterGridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    },
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < editableColumns.length - 1) {
          requestAnimationFrame(() => {
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          });
        }
        params.event.preventDefault();
      }
    }
  };

  getSetupData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setupService.getWarehouseSetup(this.idRoot).subscribe({
        next: (data: any) => {
          this.projectOrBranch = data[0].projectOrBranch;
          this.typeReference = this.projectOrBranch ? 'project' : 'branch';
          this.activateOc = data[0].activateOc !== false; // Default to true if not set or null
          console.log('Referencia', this.typeReference, 'activateOc', this.activateOc);
          resolve();
        },
        error: (err) => {
          if (err.status === 404) {
            console.error(err);
            alerts.basicAlert(
              'Orden de Compra',
              'No se encontró la configuración de almacenes de la empresa.',
              'error'
            );
          }
          reject(err);
        },
      });
    });
  }

  nameRequisition = this.signalsService.getRequisitionName();

  // Column Definitions: Defines the columns to be displayed.
  public masterGridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Corregir usando el api del evento y verificando existencia
      if (event.node.isSelected() && event.api) {
        event.api.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    if (this._colMaster.length) return this._colMaster;
    this._colMaster = [
      {
        field: 'countrow',
        headerName: 'Items',
        width: 60,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data?.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 50, pinned: 'right', lockPinned: true, suppressMovable: true,
        cellRenderer: PdfButtonCellRendererPurchaseOrderComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportCascade(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Generar reporte PDF de la Orden de Compra'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'folio',
        headerName: 'Orden de compra',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        filter: true,
        width: 150,
        cellStyle: (params) => {
          if (params.api.getEditingCells()?.some(cell => 
            cell.rowIndex === params.node.rowIndex && 
            cell.column.getColId() === params.column.getColId()
          )) {
            return { backgroundColor: '#fff3cd' };
          }
          return {};
        }
      },
      {
        field: 'dateCreate',
        headerName: 'Fecha Solicitud',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
      },
      {
        field: 'dateSupply',
        headerName: 'Fecha envío',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
      },
      {
        field: 'idReq',
        headerName: 'Requisición',
        editable: (params) => this.isPurchaseOrdersLoaded && this.canEditAuthorizedRow(params.data),
        filter: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => ({
          values: this.getAvailableRequisitionIds(params.data)
        }),
        valueFormatter: (params) => {
          const foundItem = this.requisiciones
            ? this.requisiciones.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.folio}` : params.value;
        },
      },
      {
        field: 'idWarehouse', headerName: 'Almacén destino', width: 190,
        editable: (params) => !params.data?.idRequisition && this.canEditAuthorizedRow(params.data),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.almacenes.map((warehouse: any) => warehouse.id) }),
        valueFormatter: (params) => this.almacenes.find((warehouse: any) => Number(warehouse.id) === Number(params.value))?.name || ''
      },
      {
        field: 'idDepartament', headerName: 'Departamento solicita', width: 190, editable: (params) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: [...(this.departamentos ?? []).map((item: any) => item.id), '__ADD_NEW__'] }),
        valueFormatter: (params) => params.value === '__ADD_NEW__' ? '＋ Agregar nuevo...' :
          (this.departamentos ?? []).find((item: any) => Number(item.id) === Number(params.value))?.description || '',
      },
      {
        field: 'idProvider',
        headerName: 'Proveedor',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        filter: true,
        width: 300,
        minWidth: 240,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...(this.proveedores ? this.proveedores.map((item) => item.id) : []), '__ADD_NEW__'],
        }),
        valueFormatter: (params) => {
          if (params.value === '__ADD_NEW__') return '+ Agregar Nuevo';
          const foundItem = this.proveedores ? this.proveedores.find((item) => item.id === params.value) : null;
          return foundItem ? `${foundItem.name}` : params.value;
        },
      },     
      {
        field: 'idIncorExp',
        headerName: 'Gasto destino',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 270,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: [...this.gastosAceptanOc.map((item: any) => item.id), '__ADD_NEW__'] }),
        valueFormatter: (params) => {
          if (params.value === '__ADD_NEW__') return '＋ Crear gasto destino';
          const gasto = this.gastosAceptanOc.find((item: any) => Number(item.id) === Number(params.value));
          return gasto ? `${gasto.numberDocument || `Gasto ${gasto.id}`} - ${gasto.description || ''}` : '';
        }
      },
      {
        field: 'idCurrency',
        headerName: 'Moneda',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...(this.monedas ? this.monedas.map((item) => item.id) : []), '__ADD_NEW__'],
        }),
        valueFormatter: (params) => {
          if (params.value === '__ADD_NEW__') return '+ Agregar Nuevo';
          const foundItem = this.monedas ? this.monedas.find((item) => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'idPayment',
        headerName: 'Forma de pago',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...(this.tipoPago ? this.tipoPago.map((item) => item.id) : []), '__ADD_NEW__'],
        }),
        valueFormatter: (params) => {
          if (params.value === '__ADD_NEW__') return '+ Agregar Nuevo';
          const foundItem = this.tipoPago
            ? this.tipoPago.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'discount',
        headerName: 'Descuento',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
      },
      {
        field: 'iva',
        headerName: 'IVA',
        editable: false,
        width: 110,
        type: 'numericColumn',
      },
      {
        field: 'ivaRetention',
        headerName: 'Retención',
        editable: false,
        width: 150,
        type: 'numericColumn',
      },
       {
        field: 'delivery',
        headerName: 'Entrega',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        filter: true,
        width: 150,
      },
      {
        field: 'deliveryTime',
        headerName: 'Tipo',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        filter: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [
            'Materiales',
            'Indirecto',
            'Proyecto',
            'Preliminar',
            'Personal',
            'Equipos',
            'Herramientas',
            'Directos',
          ],
        },
      },
      {
        field: 'conditions',
        headerName: 'Condición',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
      },     
      {
        field: 'idSolicit',
        headerName: 'Solicita',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.usuarios ? this.usuarios.map((item) => item.id) : [],
        }),
        valueFormatter: (params) => {
          const foundItem = this.usuarios
            ? this.usuarios.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.displayName}` : params.value;
        },
      },
      {
        field: 'idAuthorize',
        headerName: 'Autoriza',
        editable: (params) => this.canEditAuthorizedRow(params.data),
        width: 150,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.usersService.filterUsersCanAuthorizeProcesses(this.usuarios).map((item) => item.id),
          valueListMaxHeight: 240,
          formatValue: (value: any) => this.usuarios.find(item => Number(item.id) === Number(value))?.displayName || '',
        }),
        valueFormatter: (params) => {
          const foundItem = this.usuarios
            ? this.usuarios.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.displayName}` : (Number(params.value) > 0 ? params.value : '');
        },
      },
      {
        headerName: 'Abrir',
        colId: 'authorizationAction',
        width: 64,
        editable: false,
        cellRenderer: (params: ICellRendererParams) => {
          if (Number(params.data?.idAuthorize) <= 0) {
            return '<span class="text-success" title="Sin autorización; documento editable" aria-label="Documento editable"><i class="bi bi-unlock-fill"></i></span>';
          }
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-sm btn-outline-danger py-0 px-2';
          button.title = 'Quitar autorización y abrir edición';
          button.setAttribute('aria-label', 'Quitar autorización y abrir edición');
          button.innerHTML = '<i class="bi bi-lock-fill"></i>';
          button.addEventListener('click', (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            void this.onMasterCellClicked(params);
          });
          return button;
        },
      },
       {
        field: 'comments',
        headerName: 'Comentario',
        editable: false,
        width: 150,
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
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        },
      }
    /*  {
        field: 'address',
        headerName: 'Dirección',
        editable: false,
        width: 150,
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
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        },
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: false,
        width: 150,
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
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        },
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: false,
        width: 150,
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
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        },
      },*/
      
    ];
    return this._colMaster;
  }

  // Column Definitions: Defines the columns to be displayed.
  get colDetails(): ColDef[] {
    return [
      {
        field: 'idSupplie',
        headerName: 'Producto',
        editable: true,
        flex: 3,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.productos ? this.productos.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.productos
            ? this.productos.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: true,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0,
        },
        onCellValueChanged: (event: any) => this.updateTotal(event.data),
      },
      {
        field: 'price',
        headerName: 'Precio',
        editable: true,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0,
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        },
        onCellValueChanged: (event: any) => this.updateTotal(event.data),
      },
      {
        field: 'total',
        headerName: 'Total',
        editable: false,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0,
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        },
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        editable: false,
        filter: true,
        flex: 2,
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
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        },
      },
    ];
  }

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    // Si los datos master ya están cargados, no recargar
    if (this.masterRowData && this.masterRowData.length > 0) {
      console.log('⚠️ Datos master ya cargados, no se vuelven a cargar');
      return;
    }

    this.requisitionsService
      .getOcAndReqs(this.typeReference, this.idReference, 'OC')
      .subscribe(
        (data: any) => {
          this.masterRowData = data.map((item: any) => ({
            ...item,
            countrow: item.countrow || 0,
            detailType: null,
            detailData: []
          }));
          this.isPurchaseOrdersLoaded = true;
          void this.refreshRequisitionBalances();
        },
        (error) => console.error('Error fetching data:', error)
      );
  }

  obtenerGastosAceptanOc(): void {
    if (!this.idRoot) return;
    this.incomesAndExpensesService.getIncomesAndExpenses(this.idRoot).subscribe({
      next: (data: any) => {
        const rows = Array.isArray(data) ? data : [];
        this.gastosAceptanOc = rows.filter((row: any) =>
          String(row.type || '').toUpperCase() === 'GASTO' && row.acceptsOc === true && row.active !== false
        );
        this.masterGridApi?.refreshCells({ columns: ['idIncorExp'], force: true });
      },
      error: (error) => {
        console.error('No fue posible cargar los gastos que aceptan OC:', error);
        this.gastosAceptanOc = [];
      }
    });
  }

  private async createExpenseDestinationForOrder(node: any): Promise<void> {
    const order = node?.data;
    if (!order || !this.idRoot) return;

    try {
      const [accountsResponse, expenseTypesResponse]: any[] = await Promise.all([
        lastValueFrom(this.administrationService.getAccountBanks(this.idRoot)),
        lastValueFrom(this.cuentasContablesService.getByNivel(this.idRoot, 2))
      ]);
      const accounts = Array.isArray(accountsResponse) ? accountsResponse : [];
      const expenseTypes = Array.isArray(expenseTypesResponse)
        ? expenseTypesResponse.filter((item: any) => item.activo !== false)
        : [];

      if (!accounts.length || !expenseTypes.length) {
        alerts.basicAlert(
          'No se puede crear el gasto',
          !accounts.length
            ? 'La empresa no tiene cuentas bancarias activas para registrar el gasto.'
            : 'La empresa no tiene tipos de gasto configurados en su catálogo contable.',
          'warning'
        );
        return;
      }

      const escapeHtml = (value: any) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char] as string));
      const accountOptions = accounts.map((account: any) => {
        const label = account.description || account.name || account.accountName || account.maskex || `Cuenta ${account.id}`;
        return `<option value="${Number(account.id)}">${escapeHtml(label)}</option>`;
      }).join('');
      const typeOptions = expenseTypes.map((item: any) => {
        const label = [item.codigo, item.nombre || item.description].filter(Boolean).join(' - ') || `Tipo ${item.id}`;
        return `<option value="${Number(item.id)}">${escapeHtml(label)}</option>`;
      }).join('');
      const providerName = this.proveedores.find((item: any) => Number(item.id) === Number(order.idProvider))?.name || '';
      const description = `OC ${order.folio || ''}${providerName ? ` - ${providerName}` : ''}`.trim();
      const result = await Swal.fire({
        title: 'Crear gasto destino',
        html: `<div class="text-start">
          <label for="oc-expense-account" class="form-label">Cuenta bancaria</label>
          <select id="oc-expense-account" class="form-select mb-3"><option value="">Seleccione una cuenta</option>${accountOptions}</select>
          <label for="oc-expense-type" class="form-label">Tipo de gasto</label>
          <select id="oc-expense-type" class="form-select mb-3"><option value="">Seleccione un tipo</option>${typeOptions}</select>
          <label for="oc-expense-description" class="form-label">Descripción</label>
          <input id="oc-expense-description" class="form-control" value="${escapeHtml(description)}" maxlength="250">
          <small class="text-muted d-block mt-2">El gasto quedará ligado a esta OC y habilitado para recibir sus partidas.</small>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'Crear y seleccionar',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
          const popup = Swal.getPopup();
          const idAccount = Number((popup?.querySelector('#oc-expense-account') as HTMLSelectElement)?.value);
          const idExpend = Number((popup?.querySelector('#oc-expense-type') as HTMLSelectElement)?.value);
          const expenseDescription = (popup?.querySelector('#oc-expense-description') as HTMLInputElement)?.value?.trim();
          if (!idAccount || !idExpend || !expenseDescription) {
            Swal.showValidationMessage('Selecciona la cuenta y el tipo de gasto, y captura una descripción.');
            return false;
          }
          return { idAccount, idExpend, description: expenseDescription };
        }
      });
      if (!result.isConfirmed || !result.value) return;

      const now = new Date();
      const expenseData: any = {
        type: 'GASTO',
        idBusinnes: this.idRoot,
        idBranch: this.projectOrBranch ? 0 : Number(this.idReference || 0),
        idProject: this.projectOrBranch ? Number(this.idReference || 0) : null,
        idAccount: result.value.idAccount,
        idExpend: result.value.idExpend,
        idCustomer: 0,
        numberDocument: `OC-${order.folio || now.getTime()}`,
        description: result.value.description,
        date: order.dateCreate || now.toISOString(),
        subtotal: 0,
        tax: 0,
        total: 0,
        countitems: 0,
        acceptsOc: true,
        moneda: 'MXN',
        tipoCambio: null,
        uuid: 'NA',
        status: 'Pendiente',
        active: true,
        createdBy: this.trackingService.getEmail() || 'Sistema',
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString()
      };
      const response: any = await lastValueFrom(this.incomesAndExpensesService.addIncomesAndExpenses(expenseData));
      const expenseId = Number(response?.id ?? response?.data?.id ?? response?.result?.id ?? response);
      if (!Number.isFinite(expenseId) || expenseId <= 0) {
        throw new Error('El servicio no devolvió el identificador del gasto creado.');
      }

      this.gastosAceptanOc = [...this.gastosAceptanOc, { ...expenseData, id: expenseId }];
      const updatedData = { ...node.data, idIncorExp: expenseId, __modified: true };
      node.setData(updatedData);
      this.masterRowData = this.masterRowData.map((row: any) => String(row.id) === String(updatedData.id) ? updatedData : row);
      if (this.masterSelectedRowData?.id === updatedData.id) this.masterSelectedRowData = updatedData;
      this.masterNotSavedChanges = true;
      this.masterGridApi?.refreshCells({ rowNodes: [node], columns: ['idIncorExp'], force: true });
      alerts.basicAlert('Gasto creado', 'El gasto destino quedó seleccionado. Guarda la OC para conservar el vínculo.', 'success');
    } catch (error: any) {
      console.error('No fue posible crear el gasto destino de la OC:', error);
      alerts.basicAlert('Error al crear el gasto', error?.message || 'No se pudo crear el gasto destino.', 'error');
    }
  }

  obtenerRequisiciones() {
    // Si las requisiciones ya están cargadas, no recargar
    if (this.requisiciones && this.requisiciones.length > 0) {
      console.log('⚠️ Requisiciones ya cargadas, no se vuelven a cargar');
      return;
    }

    this.requisitionsService
      .getOcAndReqs(this.typeReference, this.idReference, 'REQUIS')
      .subscribe(
        (data: any) => {
          this.requisiciones = Array.isArray(data) ? data : [];
          void this.refreshRequisitionBalances();
        },
        (error) => console.error('Error fetching requisitions:', error)
      );
  }

  private getAvailableRequisitionIds(currentPurchaseOrder: any): number[] {
    return (this.requisiciones || [])
      .filter((requisition: any) =>
        Number(requisition.id) === Number(currentPurchaseOrder?.idReq) ||
        (requisition.remainingItems || []).some((item: any) => Number(item.remainingQuantity) > 0)
      )
      .map((requisition: any) => Number(requisition.id));
  }

  private async refreshRequisitionBalances(): Promise<void> {
    const requestId = ++this.requisitionBalanceRequest;
    const requisitions = Array.isArray(this.requisiciones) ? this.requisiciones : [];
    const orders = (this.masterRowData || []).filter((order: any) =>
      order.active !== false && Number(order.active) !== 0 && Number(order.idReq) > 0
    );
    if (!requisitions.length) return;

    try {
      const requisitionItems = await Promise.all(requisitions.map((req: any) =>
        lastValueFrom(this.requisitionsService.getReqItems(Number(req.id)))
      ));
      const purchaseOrderItems = await Promise.all(orders.map((order: any) =>
        lastValueFrom(this.requisitionsService.getReqItems(Number(order.id)))
      ));
      if (requestId !== this.requisitionBalanceRequest) return;
      const purchasedByReq = new Map<number, Map<string, number>>();

      orders.forEach((order: any, index: number) => {
        const reqId = Number(order.idReq);
        let totals = purchasedByReq.get(reqId);
        if (!totals) purchasedByReq.set(reqId, totals = new Map<string, number>());
        (Array.isArray(purchaseOrderItems[index]) ? purchaseOrderItems[index] : [])
          .filter((item: any) => item.active !== false && Number(item.active) !== 0)
          .forEach((item: any) => {
            const key = this.requisitionMaterialBrandKey(item);
            if (!key) return;
            totals!.set(key, (totals!.get(key) || 0) + Math.max(0, Number(item.quantity) || 0));
          });
      });

      this.requisiciones = requisitions.map((requisition: any, index: number) => {
        const requestedByMaterial = new Map<string, { item: any; quantity: number }>();
        (Array.isArray(requisitionItems[index]) ? requisitionItems[index] : [])
          .filter((item: any) => item.active !== false && Number(item.active) !== 0)
          .forEach((item: any) => {
            const key = this.requisitionMaterialBrandKey(item);
            if (!key) return;
            const current = requestedByMaterial.get(key);
            if (current) current.quantity += Math.max(0, Number(item.quantity) || 0);
            else requestedByMaterial.set(key, { item, quantity: Math.max(0, Number(item.quantity) || 0) });
          });
        const purchased = purchasedByReq.get(Number(requisition.id)) || new Map<string, number>();
        const remainingItems = Array.from(requestedByMaterial.entries())
          .map(([key, value]) => ({
            ...value.item,
            remainingQuantity: Math.max(0, value.quantity - (purchased.get(key) || 0))
          }))
          .filter((item: any) => item.remainingQuantity > 0);
        return { ...requisition, remainingItems };
      });
      this.masterGridApi?.refreshCells({ columns: ['idReq'], force: true });
    } catch (error) {
      if (requestId !== this.requisitionBalanceRequest) return;
      console.error('No fue posible calcular las cantidades pendientes de requisiciones:', error);
      this.requisiciones = requisitions.map((requisition: any) => ({ ...requisition, remainingItems: [] }));
    }
  }

  private requisitionMaterialBrandKey(item: any): string {
    const materialId = Number(item?.idSupplie || item?.idProduct || 0);
    if (!materialId) return '';
    const brand = item?.idBrand != null
      ? `id:${Number(item.idBrand)}`
      : `name:${String(item?.brandName || item?.brand || '').trim().toLocaleUpperCase()}`;
    return `${materialId}|${brand}`;
  }

  obtenerProveedores() {
    if (this.proveedores && this.proveedores.length > 0) {
      console.log('⚠️ Proveedores ya cargados, no se vuelven a cargar');
      return;
    }
    this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        this.proveedores = arr.map((p: any) => ({ id: p.id, name: p.company || p.nameContact || p.namecontact || p.name || '' }));
        console.log('✅ Proveedores cargados:', this.proveedores.length);
        this.updateDetailContext();
      },
      error: (err) => console.error('Error fetching providers:', err),
    });
  }

  obtenerUsuarios() {
    this.usersService.getDataUsers(this.idRoot).subscribe(
      (response: any) => {
        this.usuarios = response.data;
      },
      (error) => console.error('Error fetching users:', error)
    );
  }

  obtenerDepartamentos() {
    this.departmentsService.getDepartments(this.idRoot).subscribe(
      (response: any) => {
        this.departamentos = response?.data ?? response ?? [];
        this.defaultDepartmentId ??= this.departamentos.reduce((latest: number, item: any) => Math.max(latest, Number(item.id) || 0), 0) || null;
        console.log(this.departamentos);
      },
      (error) => console.error('Error fetching departments:', error)
    );
  }

  private async openAddDepartmentDialog(): Promise<number | null> {
    const result = await alerts.inputAlert('Nuevo departamento', 'Escribe el nombre del departamento para esta empresa.', 'text', '', {
      confirmButtonText: 'Agregar', inputAttributes: { maxlength: 80 }
    });
    const description = result.value?.trim();
    if (!result.isConfirmed || !description) return null;
    try {
      const response: any = await lastValueFrom(this.departmentsService.createDepartment(this.idRoot, description));
      const created = response?.data ?? response;
      const id = Number(created?.id ?? created?.Id);
      if (!id) {
        alerts.basicAlert('Departamento', response?.message || 'No se pudo crear el departamento.', 'error');
        return null;
      }
      this.departamentos = [...(this.departamentos ?? []).filter(item => Number(item.id) !== id), {
        ...created,
        id,
        description: created.description ?? created.Description ?? description,
      }];
      this.defaultDepartmentId = id;
      alerts.basicAlert('Departamento agregado', `${created.description ?? created.Description ?? description} quedó seleccionado y disponible para las próximas OC.`, 'success');
      return id;
    } catch (error) {
      console.error('Error al crear departamento:', error);
      alerts.basicAlert('Departamento', 'No se pudo crear el departamento.', 'error');
      return null;
    }
  }

  obtenerUbicaciones() {
    this.catalogsService.getLocations().subscribe(
      (data: Catalog[]) => {
        this.ubicaciones = data;
      },
      (error) => console.error('Error fetching locations:', error)
    );
  }

  obtenerMonedas() {
    this.currencyService.getCurrencies(this.idRoot).subscribe({
      next: async (data: any) => {
        this.monedas = Array.isArray(data) ? data : [];
        const monedaMx = this.monedas.find((item: any) => String(item.description || '').trim().toUpperCase() === 'MX');
        const monedaMxn = this.monedas.find((item: any) => String(item.description || '').trim().toUpperCase() === 'MXN');
        if (monedaMx && !monedaMxn) {
          try {
            await lastValueFrom(this.catalogsService.updateCatalog(monedaMx.id, { ...monedaMx, description: 'MXN' }));
            monedaMx.description = 'MXN';
          } catch (error) {
            console.error('No fue posible corregir MX a MXN:', error);
          }
        }
        this.currenciesLoaded = true;
        this.ensurePurchaseOrderDefaults();
      },
      error: () => { this.monedas = []; },
    });
  }

  obtenerTipoPago() {
    this.currencyService.getPaymentTypes(this.idRoot).subscribe({
      next: (data: any) => {
        this.tipoPago = Array.isArray(data) ? data : [];
        this.paymentsLoaded = true;
        this.ensurePurchaseOrderDefaults();
      },
      error: () => { this.tipoPago = []; },
    });
  }

  private async ensurePurchaseOrderDefaults(): Promise<void> {
    if (this.defaultsEnsured || !this.idRoot || !this.currenciesLoaded || !this.paymentsLoaded) return;
    const mx = this.monedas.find((item: any) => String(item.description || '').trim().toUpperCase() === 'MXN');
    const transfer = this.tipoPago.find((item: any) => String(item.description || '').trim().toUpperCase() === 'TRANSFERENCIA');
    if (mx && transfer) {
      this.defaultsEnsured = true;
      return;
    }
    try {
      if (!mx) {
        await lastValueFrom(this.catalogsService.addCatalog({ description: 'MXN', type: 'Currency', idCompany: this.idRoot, active: 1, vigente: true }));
      }
      if (!transfer) {
        await lastValueFrom(this.catalogsService.addCatalog({ description: 'TRANSFERENCIA', type: 'TYPECURRENCY', idCompany: this.idRoot, active: 1, vigente: true }));
      }
      this.defaultsEnsured = true;
      this.obtenerMonedas();
      this.obtenerTipoPago();
    } catch (error) {
      console.warn('No fue posible crear los catálogos predeterminados de OC', error);
    }
  }

  private async getTransferPaymentDefault(): Promise<any | null> {
    const isTransfer = (item: any) =>
      String(item?.description ?? item?.Description ?? '').trim().toUpperCase() === 'TRANSFERENCIA';

    let transfer = this.tipoPago.find(isTransfer);
    if (transfer) return transfer;

    try {
      const created: any = await lastValueFrom(
        this.catalogsService.addCatalog({
          description: 'TRANSFERENCIA',
          type: 'TYPECURRENCY',
          idCompany: this.idRoot,
          active: 1,
          vigente: true,
        })
      );
      const saved = created?.data ?? created;
      transfer = {
        id: saved?.id ?? saved?.Id,
        description: saved?.description ?? saved?.Description ?? 'TRANSFERENCIA',
      };
      if (transfer.id != null) this.tipoPago = [...this.tipoPago, transfer];
    } catch (error) {
      console.error('No fue posible preparar TRANSFERENCIA como forma de pago predeterminada.', error);
    }

    return transfer?.id != null ? transfer : null;
  }

  async openAddProveedorDialog(): Promise<number | null> {
    const result = await Swal.fire({
      html: `
        <section class="oc-provider-dialog">
          <header class="oc-provider-dialog__header">
            <span class="oc-provider-dialog__icon"><i class="bi bi-building-add"></i></span>
            <div>
              <h2>Nuevo proveedor</h2>
              <p>Alta rápida para usarlo de inmediato en esta orden de compra.</p>
            </div>
          </header>
          <div class="oc-provider-dialog__body">
            <label class="oc-provider-dialog__label" for="prov-name">Nombre o razón social <span>*</span></label>
            <input id="prov-name" class="oc-provider-dialog__input" placeholder="Ej. Constructora del Sureste">
            <small>Es el nombre que se mostrará en el campo Proveedor de la OC.</small>

            <label class="oc-provider-dialog__label mt-3" for="prov-rfc">RFC <em>opcional</em></label>
            <input id="prov-rfc" class="oc-provider-dialog__input" placeholder="Ej. COS010101AB1" maxlength="20">
          </div>
        </section>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-check-lg me-1"></i> Agregar proveedor',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      focusConfirm: false,
      width: 460,
      padding: 0,
      buttonsStyling: false,
      customClass: {
        popup: 'oc-provider-dialog-popup',
        htmlContainer: 'oc-provider-dialog-container',
        actions: 'oc-provider-dialog-actions',
        confirmButton: 'oc-provider-dialog-confirm',
        cancelButton: 'oc-provider-dialog-cancel',
      },
      didOpen: () => { document.getElementById('prov-name')?.focus(); },
      preConfirm: (): { name: string; rfc: string } | null => {
        const name = (document.getElementById('prov-name') as HTMLInputElement).value.trim();
        const rfc  = (document.getElementById('prov-rfc')  as HTMLInputElement).value.trim();
        if (!name) { Swal.showValidationMessage('El nombre es requerido'); return null; }
        const duplicate = this.proveedores.some((provider: any) =>
          String(provider.name || '').trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicate) {
          Swal.showValidationMessage('No puedo agregarlo: ya existe un proveedor con ese nombre.');
          return null;
        }
        return { name, rfc };
      },
    });
    if (!result.isConfirmed || !result.value) return null;
    try {
      const created: any = await lastValueFrom(
        this.customersService.addCustomer({
          idRoot:      this.idRoot,
          namecontact: result.value.name,
          nameContact: result.value.name,
          company:     result.value.name,
          position:    'GERENCIA',
          phone:       '',
          rfc:         result.value.rfc || 'SIN RFC',
          city:        '',
          state:       '',
          country:     '',
          email:       '',
          address:     '',
          type:        'PROVIDERS',
          active:      true,
          vigente:     true,
        })
      );
      await new Promise<void>((resolve) =>
        this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
          next: (data: any) => {
            const arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
            this.proveedores = arr.map((p: any) => ({ id: p.id, name: p.company || p.nameContact || p.namecontact || p.name || '' }));
            resolve();
          },
          error: () => resolve(),
        })
      );
      this.updateDetailContext();
      return created?.id ?? created?.data?.id ?? null;
    } catch {
      alerts.basicAlert('Error', 'No se pudo agregar el proveedor.', 'error');
      return null;
    }
  }

  async openAddMonedaDialog(): Promise<number | null> {
    const result = await Swal.fire({
      title: 'Nueva Moneda',
      html: `<input id="moneda-desc" class="swal2-input" placeholder="Ej: USD, EUR, MXN">`,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      focusConfirm: false,
      didOpen: () => { document.getElementById('moneda-desc')?.focus(); },
      preConfirm: (): string | null => {
        const val = (document.getElementById('moneda-desc') as HTMLInputElement).value.trim();
        if (!val) { Swal.showValidationMessage('La descripción es requerida'); return null; }
        return val;
      },
    });
    if (!result.isConfirmed || !result.value) return null;
    try {
      const created: any = await lastValueFrom(
        this.catalogsService.addCatalog({ description: result.value, type: 'Currency', idCompany: this.idRoot, active: 1, vigente: true })
      );
      await new Promise<void>((resolve) =>
        this.currencyService.getCurrencies(this.idRoot).subscribe({
          next: (data: any) => { this.monedas = Array.isArray(data) ? data : []; resolve(); },
          error: () => resolve(),
        })
      );
      return created?.id ?? null;
    } catch {
      alerts.basicAlert('Error', 'No se pudo agregar la moneda.', 'error');
      return null;
    }
  }

  async openAddTipoPagoDialog(): Promise<number | null> {
    const result = await Swal.fire({
      title: 'Nueva Forma de Pago',
      html: `<input id="pago-desc" class="swal2-input" placeholder="Ej: Transferencia, Cheque, Efectivo">`,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      focusConfirm: false,
      didOpen: () => { document.getElementById('pago-desc')?.focus(); },
      preConfirm: (): string | null => {
        const val = (document.getElementById('pago-desc') as HTMLInputElement).value.trim();
        if (!val) { Swal.showValidationMessage('La descripción es requerida'); return null; }
        return val;
      },
    });
    if (!result.isConfirmed || !result.value) return null;
    try {
      const created: any = await lastValueFrom(
        this.catalogsService.addCatalog({ description: result.value, type: 'TYPECURRENCY', idCompany: this.idRoot, active: 1, vigente: true })
      );
      await new Promise<void>((resolve) =>
        this.currencyService.getPaymentTypes(this.idRoot).subscribe({
          next: (data: any) => { this.tipoPago = Array.isArray(data) ? data : []; resolve(); },
          error: () => resolve(),
        })
      );
      return created?.id ?? null;
    } catch {
      alerts.basicAlert('Error', 'No se pudo agregar la forma de pago.', 'error');
      return null;
    }
  }

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      // Crear una copia profunda del dato seleccionado
      this.masterSelectedRowData = { ...selectedNodes[0].data };
      this.detailsNotSavedChanges = false;

      // Solo actualizar las señales si no es una fila nueva
      if (!this.newlyAddedMasterRows.includes(this.masterSelectedRowData.id)) {
        this.signalsService.setIdRequisition(this.masterSelectedRowData.id);
        this.signalsService.setRequisitionName(
          this.masterSelectedRowData.folio
        );
        this.signalsService.setRequisitionSolicitant(
          this.masterSelectedRowData.solicit
        );
        this.signalsService.setRequisitionDate(
          this.masterSelectedRowData.dateCreate
        );
        this.idRequisition = this.signalsService.getIdRequisition()();
      }
    } else {
      this.masterSelectedRowData = null;
    }
  }

  onMasterCellEditingStopped(event: any) {
    const colId = event.column.getColId();
    if (event.newValue === '__ADD_NEW__') {
      const node = event.node;
      node.data[colId] = event.oldValue ?? null;
      this.masterGridApi?.refreshCells({ rowNodes: [node], force: true });
      const dialogMap: Record<string, () => Promise<number | null>> = {
        idProvider: () => this.openAddProveedorDialog(),
        idCurrency: () => this.openAddMonedaDialog(),
        idPayment:  () => this.openAddTipoPagoDialog(),
        idDepartament: () => this.openAddDepartmentDialog(),
      };
      const openDialog = dialogMap[colId];
      if (openDialog) {
        openDialog().then(newId => {
          if (newId) {
            const updatedData = { ...node.data, [colId]: Number(newId), __modified: true };
            node.setData(updatedData);
            this.masterRowData = this.masterRowData.map(row => row.id === updatedData.id ? updatedData : row);
            if (this.masterSelectedRowData?.id === updatedData.id) this.masterSelectedRowData = updatedData;
            this.masterNotSavedChanges = true;
            this.masterGridApi?.refreshCells({ rowNodes: [node], columns: [colId], force: true });
          }
        });
      }
    }
  }

  onMasterCellValueChanged(event: any) {
    if (event.newValue === '__ADD_NEW__') {
      event.node.setData({ ...event.data, idIncorExp: event.oldValue ?? null });
      void this.createExpenseDestinationForOrder(event.node);
      return;
    }
    const updatedData = { ...event.data };

    if (event.colDef.field === 'idReq') {
      const requisitionId = Number(updatedData.idReq);
      const availableRequisition = (this.requisiciones || []).find((item: any) => Number(item.id) === requisitionId);
      const hasRemainingQuantity = (availableRequisition?.remainingItems || [])
        .some((item: any) => Number(item.remainingQuantity) > 0);
      if (requisitionId > 0 && !hasRemainingQuantity && Number(event.oldValue) !== requisitionId) {
        updatedData.idReq = event.oldValue ?? null;
        delete updatedData.__pendingRequisitionItemImport;
        event.node.setData(updatedData);
        this.masterRowData = this.masterRowData.map((row: any) => String(row.id) === String(updatedData.id) ? updatedData : row);
        this.masterGridApi?.refreshCells({ rowNodes: [event.node], columns: ['idReq'], force: true });
        alerts.basicAlert('Requisición completa', 'Esta requisición ya no tiene cantidades pendientes por comprar.', 'warning');
        return;
      }
      if (requisitionId > 0) {
        updatedData.__pendingRequisitionItemImport = requisitionId;
      } else {
        delete updatedData.__pendingRequisitionItemImport;
      }
    }

    // Preservar el estado temporal y la selección
    if (this.newlyAddedMasterRows.includes(updatedData.id)) {
      updatedData.__isNew = true;
    }

    updatedData.__modified = true;
    this.masterNotSavedChanges = true;

    // Actualizar el array de datos
    this.masterRowData = this.masterRowData.map((row) =>
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.masterGridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      this.masterGridApi?.refreshCells({ rowNodes: [rowNode], force: true });
      // Mantener la selección si es necesario
      if (
        this.masterSelectedRowData &&
        this.masterSelectedRowData.id === updatedData.id
      ) {
        rowNode.setSelected(true);
      }
    }
  }

  canEditAuthorizedRow(row: any): boolean {
    return !Number(row?.idAuthorize);
  }

  async onMasterCellClicked(event: any): Promise<void> {
    if (event?.column?.getColId() !== 'authorizationAction' && event?.colDef?.colId !== 'authorizationAction') return;
    const row = event.data;
    if (!Number(row?.idAuthorize)) return;
    if (Number(row.idAuthorize) !== Number(this.trackingService.getId())) {
      alerts.basicAlert('Autorización asignada', 'Solo la persona asignada para autorizar puede quitar esta autorización.', 'warning');
      return;
    }
    const confirmation = await alerts.confirmAlert('Quitar autorización', 'La orden de compra volverá a quedar editable. ¿Deseas continuar?', 'warning', 'Sí, quitar');
    if (!confirmation.isConfirmed) return;
    try {
      await lastValueFrom(this.requisitionsService.updateOcAndReq(row.id, this.cleanDataForServer({ ...row, idAuthorize: 0 })));
      const updated = { ...row, idAuthorize: 0, __modified: false };
      event.node.setData(updated);
      this.masterRowData = this.masterRowData.map(item => Number(item.id) === Number(row.id) ? updated : item);
      this.masterGridApi?.refreshCells({ rowNodes: [event.node], force: true });
      alerts.basicAlert('Autorización retirada', 'La orden de compra volvió a quedar editable.', 'success');
    } catch (error) {
      alerts.basicAlert('No se pudo quitar', 'No fue posible retirar la autorización de la orden de compra.', 'error');
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.masterGridApi = params.api;
    restoreGridColumnWidths(this.masterGridApi, 'shopping:purchaseorder:master', this.trackingService.getEmail());
    console.log('✅ Master Grid Ready - productos length:', this.productos.length, 'proveedores length:', this.proveedores.length);

    // Configurar el context inicial
    this.updateDetailContext();
  }

  onMasterGridCellKeyDown(event: any): void {
    const keyEvent: KeyboardEvent = event?.event || event;
    if (keyEvent?.key !== 'F10') return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    if (keyEvent.repeat) return;
    event.api?.stopEditing();
    void this.saveMasterChanges();
  }

  onMasterColumnResized(event: any): void {
    saveGridColumnWidths(this.masterGridApi, 'shopping:purchaseorder:master', this.trackingService.getEmail(), event);
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  private getLastSavedExpenseDestinationId(): number | null {
    const validExpenseIds = new Set((this.gastosAceptanOc || []).map((gasto: any) => Number(gasto.id)));
    const lastSavedOrder = (this.masterRowData || [])
      .filter((order: any) => !order.__isNew && Number(order.id) > 0 && validExpenseIds.has(Number(order.idIncorExp)))
      .sort((a: any, b: any) => {
        const dateDifference = new Date(b.dateCreate || 0).getTime() - new Date(a.dateCreate || 0).getTime();
        return dateDifference || Number(b.id) - Number(a.id);
      })[0];

    if (lastSavedOrder) return Number(lastSavedOrder.idIncorExp);
    return this.gastosAceptanOc.length === 1 ? Number(this.gastosAceptanOc[0].id) : null;
  }

  private getLastSavedWarehouseDestinationId(): number | null {
    const availableWarehouseIds = new Set((this.almacenes || []).map((warehouse: any) => Number(warehouse.id)));
    const lastSavedOrder = (this.masterRowData || [])
      .filter((order: any) => !order.__isNew && Number(order.id) > 0 && availableWarehouseIds.has(Number(order.idWarehouse)))
      .sort((a: any, b: any) => {
        const dateDifference = new Date(b.dateCreate || 0).getTime() - new Date(a.dateCreate || 0).getTime();
        return dateDifference || Number(b.id) - Number(a.id);
      })[0];

    if (lastSavedOrder) return Number(lastSavedOrder.idWarehouse);
    return this.almacenes.length === 1 ? Number(this.almacenes[0].id) : null;
  }

  async addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const shippingDate = new Date();
    shippingDate.setDate(shippingDate.getDate() + 2);

    // Generar folio automáticamente desde PrefixSetup
    const type: 'project' | 'branch' = this.projectOrBranch ? 'project' : 'branch';
    const folio = await this.prefixSetupService.getNextFolio(type, this.idReference, 'oc');
    const defaultCurrency = this.monedas.find((item: any) => String(item.description || '').trim().toUpperCase() === 'MXN');
    const defaultPayment = await this.getTransferPaymentDefault();

    const newItem = {
      id: tempId,
      folio: folio || '',
      idRoot: this.idRoot,
      typeReference: this.typeReference,
      idReference: this.idReference,
      dateCreate: new Date().toISOString(),
      idProvider: 0,
      idIncorExp: this.getLastSavedExpenseDestinationId(),
      idWarehouse: this.getLastSavedWarehouseDestinationId(),
      idDepartament: this.defaultDepartmentId ?? (Number(this.departamentos[0]?.id) || 0),
      delivery: '1 dia',
      deliveryTime: 'Materiales',
      dateSupply: shippingDate.toISOString(),
      idPayment: defaultPayment?.id ?? 0,
      idCurrency: defaultCurrency?.id ?? 0,
      conditions: 'Ninguna',
      IdAuthorize: 0,
      priority: '',
      solicit: this.signalsService.getDisplayName()(),
      type: 'OC',
      comments: '',
      typeOc: 'INSUMOS',
      idSolicit: 0,
      idRequisition: 0,
      address: 'NA',
      city: 'NA',
      phone: 'NA',
      ivaRetention: 0,
      iva: 0,
      discount: 0,
      active: true,
      __isNew: true,
    };

    // Actualizar el estado
    this.masterRowData = [newItem, ...this.masterRowData];
    this.newlyAddedMasterRows.push(tempId);
    this.masterNotSavedChanges = true;

    // Forzar la actualización de la cuadrícula y seleccionar la nueva fila
    this.masterGridApi.setGridOption('rowData', this.masterRowData);

    // Asegurarnos de que la fila nueva esté seleccionada
    requestAnimationFrame(() => {
      const rowNode = this.masterGridApi.getRowNode(tempId);
      if (rowNode) {
        rowNode.setSelected(true);
        this.masterSelectedRowData = newItem;
      }
    });
  }

  async saveMasterChanges() {
    const isValid = this.masterRowData.every((item) => item.folio);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.masterRowData.filter((row) => row.__isNew);
    const modifiedRows = this.masterRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.requisitionsService.addOcAndReq(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.requisitionsService.updateOcAndReq(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      const savedRows = [...newRows, ...modifiedRows];
      let importedItems = 0;
      const importErrors: string[] = [];

      for (let index = 0; index < savedRows.length; index++) {
        const row = savedRows[index];
        const requisitionId = Number(row.__pendingRequisitionItemImport || 0);
        if (!requisitionId) continue;

        const response: any = responses[index];
        const purchaseOrderId = Number(response?.id ?? response?.data?.id ?? row.id);
        if (!purchaseOrderId || String(purchaseOrderId).startsWith('temp_')) {
          importErrors.push(`No se obtuvo el id de la OC ${row.folio || ''}.`);
          continue;
        }

        try {
          importedItems += await this.importRequisitionItemsToPurchaseOrder(purchaseOrderId, requisitionId);
        } catch (error) {
          console.error(`Error importando requisición ${requisitionId} a OC ${purchaseOrderId}:`, error);
          importErrors.push(`No se pudieron importar las partidas de la requisición ${requisitionId}.`);
        }
      }

      alerts.basicAlert(
        'Datos actualizados',
        importErrors.length
          ? `La OC se guardó, pero ${importErrors.join(' ')}`
          : importedItems > 0
            ? `La OC se guardó con ${importedItems} partida(s) importada(s) de la requisición.`
            : 'Se han actualizado los datos correctamente.',
        importErrors.length ? 'warning' : 'success'
      );

      // Enviar notificación Telegram para OCs nuevas
      if (newRows.length > 0) {
        for (const response of responses.slice(0, newRows.length)) {
          const savedOc = response as any;
          if (savedOc?.id && savedOc?.folio && savedOc?.idAuthorize) {
            this.sendAuthorizationNotification(savedOc.id, savedOc.folio, savedOc.idAuthorize);
          }
        }
      }

      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];
      this.masterRowData = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  private sendAuthorizationNotification(documentId: number, folio: string, idAuthorize: number) {
    this.notificationsService.sendNotification({
      documentType: 'OC',
      documentId: documentId,
      folio: `Orden de Compra ${folio}`,
      description: `Se ha creado la OC ${folio} y requiere autorización`,
      idSolicit: this.signalsService.getIdUSer()(),
      idAuthorize: idAuthorize
    }).subscribe({
      next: (res) => {
        if (res.success) {
          console.log('Notificación enviada:', res);
        } else {
          console.warn('Notificación no enviada:', res.error);
          const msg = res.error?.includes('Telegram ID')
            ? 'El autorizador no tiene configurado su Telegram ID. La notificación no fue enviada.'
            : res.error || 'No se pudo enviar la notificación.';
          alerts.basicAlert('Notificación', msg, 'warning');
        }
      },
      error: (err) => {
        console.error('Error enviando notificación:', err);
        const errorMsg = err.error?.error || 'Error al enviar la notificación.';
        const msg = errorMsg.includes('Telegram ID')
          ? 'El autorizador no tiene configurado su Telegram ID. La notificación no fue enviada.'
          : errorMsg;
        alerts.basicAlert('Notificación', msg, 'warning');
      }
    });
  }

  async deleteMasterEntry() {
    const selectedNodes = this.masterGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    if (Number(selectedData.countrow || 0) > 0) {
      alerts.basicAlert('No se puede eliminar', 'La Orden de compra contiene partidas. Elimina primero sus partidas.', 'warning');
      return;
    }
    if (Number(selectedData.idAuthorize) > 0) {
      alerts.basicAlert('Orden autorizada', 'Quita la autorización desde la fila antes de eliminar la orden de compra.', 'warning');
      return;
    }
    const confirmation = await alerts.confirmAlert(
      'Eliminar orden de compra',
      `¿Deseas eliminar la OC "${selectedData.folio || id}"? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!confirmation.isConfirmed) return;

    selectedData.active = 0;
    this.requisitionsService
      .deleteOcAndReq(id)
      .pipe(
        catchError((error) => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Error al eliminar la entrada.',
            'error'
          );
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.obtenerDatos();

        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.masterNotSavedChanges = false;
        this.masterSelectedRowData = null;
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.masterNotSavedChanges = false;
  }

  createOC(idRequisition: number, action: string) {
    this.receiptsService.generateOC(idRequisition, action);
  }

  // ==================== DETAILS METHODS ====================

  obtenerDetalles() {
    this.requisitionsService
      .getReqItems(this.idRequisition)
      .subscribe((data: any) => {
        this.detailsRowData = data;
      });
  }

  obtenerProductos() {
    // Si los productos ya están cargados, no recargar
    if (this.productos && this.productos.length > 0) {
      console.log('⚠️ Productos ya cargados, no se vuelven a cargar');
      return;
    }

    this.materialsService.getMaterials2Fields(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.productos = data;
        console.log('✅ Productos cargados:', this.productos.length);
        // Actualizar el context después de cargar productos
        this.updateDetailContext();
      },
      (error) => console.error('Error fetching materials:', error)
    );
  }

  updateTotal(data: any) {
    if (data.quantity && data.price) {
      data.total = data.quantity * data.price;
    } else {
      data.total = 0;
    }
  }

  updateDetailContext() {
    if (this.masterGridApi) {
      // Verificar si hay algún nodo expandido
      let hasExpandedNode = false;
      this.masterGridApi.forEachNode((node: any) => {
        if (node.expanded) {
          hasExpandedNode = true;
        }
      });

      // Si hay un nodo expandido, no actualizar el context porque AG Grid colapsará el nodo
      if (hasExpandedNode) {
        console.log('⚠️ Hay un nodo expandido, NO se actualiza el context para evitar colapso');
        return;
      }

      this.masterGridApi.setGridOption('detailCellRendererParams', {
        getDetailRowData: (params) => {
          params.successCallback(params.data.detailData);
        },
        context: {
          idRoot: this.idRoot,
          typeReference: this.typeReference,
          idReference: this.idReference,
          productos: this.productos,
          proveedores: this.proveedores,
          materialsService: this.materialsService,
          componentParent: this,
          gridApi: this.masterGridApi,
          ITEMS: {
            load: (purchaseOrderId: number, callback: (data: any[]) => void) => {
              this.loadPurchaseOrderItems(purchaseOrderId, callback);
            },
            save: (purchaseOrderId: number, data: any[]) => {
              return this.savePurchaseOrderItemsById(purchaseOrderId, data);
            },
            delete: (params: any, callback: () => void) => {
              this.deleteDetailRow(params, callback);
            },
            updateCount: (purchaseOrderId: number, count: number) => {
              this.updatePurchaseOrderItemsCount(purchaseOrderId, count);
            }
          }
        }
      });
      console.log('✅ Context actualizado con productos y proveedores');
    }
  }

  addDetailsRow() {
    if (!hasPersistedMasterId(this.idRequisition)) {
      alerts.basicAlert('Guarda primero la orden de compra', 'Guarda el maestro de la OC antes de agregar sus partidas.', 'warning');
      return;
    }
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idMovement: this.idRequisition,
      idSupplie: 0,
      quantity: 0,
      price: 0,
      total: 0,
      type: 'OC',
      comment: 'Ninguno.',
      dateuse: new Date().toISOString(),
      active: true,
      __isNew: true,
    };

    this.detailsRowData = [newItem, ...this.detailsRowData];
    this.newlyAddedDetailRows.push(tempId);
    this.detailsNotSavedChanges = true;
  }

  async saveDetailsChanges() {
    if (!hasPersistedMasterId(this.idRequisition)) {
      alerts.basicAlert('Guarda primero la orden de compra', 'Guarda el maestro de la OC antes de guardar sus partidas.', 'warning');
      return;
    }
    const isValid = this.detailsRowData.every(
      (item) => item.idSupplie && item.comment && item.dateuse
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.detailsRowData.filter((row) => row.__isNew);
    const modifiedRows = this.detailsRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.requisitionsService.addReqItem(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.requisitionsService.updateReqItem(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.detailsNotSavedChanges = false;
      this.newlyAddedDetailRows = [];
      this.obtenerDetalles(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteDetailsEntry() {
    const selectedNodes = this.detailsGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    const confirmation = await alerts.confirmAlert(
      'Eliminar partida',
      '¿Está seguro de eliminar el registro seleccionado?',
      'warning',
      'Sí, eliminar'
    );
    if (!confirmation.isConfirmed) return;
    selectedData.active = 0;
    this.requisitionsService
      .deleteReqItem(id)
      .pipe(
        catchError((error) => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Error al eliminar la entrada.',
            'error'
          );
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.obtenerDetalles();

        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.detailsNotSavedChanges = false;
        this.detailsSelectedRowData = null;
      });
  }

  revertDetailsData() {
    this.obtenerDetalles();
    this.detailsNotSavedChanges = false;
  }

  onDetailsSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.detailsSelectedRowData = selectedNodes[0].data;
    } else {
      this.detailsSelectedRowData = null;
    }
  }

  onDetailsCellValueChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.detailsSelectedRowData = selectedNodes[0].data;
      event.data.__modified = true;
      this.detailsNotSavedChanges = true;
    } else {
      this.detailsSelectedRowData = null;
    }
  }

  onDetailsGridReady(params: GridReadyEvent) {
    this.detailsGridApi = params.api;
  }

  onDetailsRowSelected(event: any) {
    this.id = event.data.id;
  }

  // ==================== UTILITY METHODS ====================

  private clearAllData() {
    // Limpiar datos master
    this.masterRowData = [];
    this.isPurchaseOrdersLoaded = false;
    this.masterSelectedRowData = null;
    this.newlyAddedMasterRows = [];
    this.masterNotSavedChanges = false;

    // Limpiar datos details
    this.detailsRowData = [];
    this.detailsSelectedRowData = null;
    this.newlyAddedDetailRows = [];
    this.detailsNotSavedChanges = false;

    // Limpiar catálogos
    this.requisiciones = [];
    this.proveedores = [];
    this.departamentos = [];
    this.monedas = [];
    this.usuarios = [];
    this.tipoPago = [];
    this.productos = [];
    
    // Limpiar IDs
    this.idReference = null;
    this.idRequisition = null;
    this.projectOrBranch = null;
    this.typeReference = null;
    this.activateOc = true;
  }

  /**
   * Copia las partidas de una requisición recién vinculada a la OC guardada.
   * Solo se invoca desde la marca temporal creada al cambiar el campo idReq,
   * por lo que guardar nuevamente la misma OC no duplica sus partidas.
   */
  private async importRequisitionItemsToPurchaseOrder(purchaseOrderId: number, requisitionId: number): Promise<number> {
    const requisition = (this.requisiciones || []).find((item: any) => Number(item.id) === Number(requisitionId));
    const activeItems = Array.isArray(requisition?.remainingItems) ? requisition.remainingItems : [];

    for (const requisitionItem of activeItems) {
      const quantity = Number(requisitionItem.remainingQuantity) || 0;
      if (quantity <= 0) continue;
      const price = Number(requisitionItem.price) || 0;
      const requestedQuantity = Number(requisitionItem.quantity) || 0;
      const balanceRatio = requestedQuantity > 0 ? quantity / requestedQuantity : 0;
      const iva = (Number(requisitionItem.iva) || 0) * balanceRatio;
      const retention = (Number(requisitionItem.retention) || 0) * balanceRatio;
      const total = (quantity * price) + iva - retention;
      const purchaseOrderItem = {
        idMovement: purchaseOrderId,
        idSupplie: Number(requisitionItem.idSupplie) || 0,
        idBrand: requisitionItem.idBrand || null,
        brandName: requisitionItem.brandName || null,
        idProvider: Number(requisitionItem.idProvider) || 0,
        quantity,
        price,
        costoMN: Number(requisitionItem.costoMN) || 0,
        ventaMN: Number(requisitionItem.ventaMN) || 0,
        iva,
        retention,
        total,
        type: 'OC',
        comment: requisitionItem.comment || 'NINGUNO.',
        dateuse: requisitionItem.dateuse || new Date().toISOString(),
        active: true,
      };

      await lastValueFrom(this.requisitionsService.addReqItem(purchaseOrderItem));
    }

    this.updatePurchaseOrderItemsCount(purchaseOrderId, activeItems.length);
    await this.refreshRequisitionBalances();
    return activeItems.length;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    if (cleanedData.idWarehouse !== null && cleanedData.idWarehouse !== undefined && cleanedData.idWarehouse !== '') {
      cleanedData.idWarehouse = Number(cleanedData.idWarehouse);
    }
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.__pendingRequisitionItemImport;
    delete cleanedData.appliesIva;
    delete cleanedData.subtotal;
    // La API conserva el importe de IVA existente; la tasa se infiere de ese
    // importe al recargar para no requerir una columna adicional.
    delete cleanedData.ivaRate;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== MASTER-DETAIL CASCADE METHODS ====================

  toggleCascade(node: any) {
    if (Number(node?.data?.idAuthorize) > 0) {
      alerts.basicAlert('Orden autorizada', 'Quita la autorización desde la fila para modificar sus partidas.', 'warning');
      return;
    }
    const event = {
      node: node,
      api: this.masterGridApi,
      data: node.data,
      column: { getColId: () => 'countrow' }
    };
    this.onCellClickedCascade(event);
  }

  onCellClickedCascade(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'countrow';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;

      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'items' && this.expandedRowId === node.id;

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);
        event.data.detailType = null;
        this.expandedRowId = null;

        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida y resetear alturas
        if (this.expandedRowId) {
          api.forEachNode((otherNode: any) => {
            if (otherNode.id === this.expandedRowId) {
              otherNode.setExpanded(false);
              otherNode.data.detailType = null;
              otherNode.data.isExpanded = false;
            }
          });
        }

        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          } else {
            otherNode.setRowHeight(undefined);
          }
        });

        // Cambiar el tipo de detalle ANTES de expandir
        event.data.detailType = 'items';

        // Guardar el ID de la fila expandida
        this.expandedRowId = node.id;
        event.data.isExpanded = true;

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir el nodo
        node.setExpanded(true);
      }
    }
  }

  toggleReportCascade(node: any) {
    node.setSelected(true);

    // Verificar si ya está expandido con reporte
    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'report' &&
      this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y restaurar todas las filas
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;

      // Restaurar alturas de todas las filas
      this.masterGridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.masterGridApi.onRowHeightChanged();
      this.masterGridApi.redrawRows();
    } else {
      // Colapsar cualquier otra fila expandida
      if (this.expandedRowId) {
        this.masterGridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      // Ocultar todas las demás filas (altura 0)
      this.masterGridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Establecer el tipo de detalle como reporte
      node.data.detailType = 'report';

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;

      // Aplicar los cambios de altura
      this.masterGridApi.onRowHeightChanged();
      this.masterGridApi.redrawRows();

      // Expandir con el detalle del reporte
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  collapseReportDetail() {
    if (this.expandedRowId && this.masterGridApi) {
      this.masterGridApi.forEachNode((node: any) => {
        if (node.id === this.expandedRowId) {
          node.setExpanded(false);
          node.data.isExpanded = false;
          node.data.detailType = null;
        }
        node.setRowHeight(undefined);
      });
      this.expandedRowId = null;
      this.masterGridApi.onRowHeightChanged();
      this.masterGridApi.redrawRows();
    }
  }

  loadPurchaseOrderItems(purchaseOrderId: number, successCallback: any) {
    this.requisitionsService.getReqItems(purchaseOrderId).subscribe({
      next: (data: any) => {
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading purchase order items:', error);
        successCallback([]);
      }
    });
  }

  async savePurchaseOrderItemsById(purchaseOrderId: any, data: any[]): Promise<boolean> {
    let purchaseOrder = this.masterRowData.find((row: any) => String(row.id) === String(purchaseOrderId));
    if (!hasPersistedMasterId(purchaseOrderId, purchaseOrder?.__isNew)) {
      if (!purchaseOrder?.idIncorExp) {
        alerts.basicAlert('Gasto destino', 'Selecciona el gasto que acepta esta OC antes de guardar sus partidas.', 'warning');
        return false;
      }
      if (!purchaseOrder?.folio) {
        alerts.basicAlert('Folio requerido', 'Captura el número de la orden de compra antes de guardar sus partidas.', 'warning');
        return false;
      }
      try {
        const response: any = await lastValueFrom(this.requisitionsService.addOcAndReq(this.cleanDataForServer(purchaseOrder)));
        const savedId = Number(response?.id ?? response?.data?.id ?? response?.idMovement ?? 0);
        if (!savedId) throw new Error('El servidor no devolvió el identificador de la orden de compra.');
        purchaseOrder.id = savedId;
        delete purchaseOrder.__isNew;
        delete purchaseOrder.__modified;
        data.forEach((item: any) => item.idMovement = savedId);
        this.masterNotSavedChanges = this.masterRowData.some((row: any) => row.__isNew || row.__modified);
        this.masterGridApi?.refreshCells({ force: true });
        purchaseOrderId = savedId;
      } catch (error) {
        console.error('Error guardando la OC antes de sus partidas:', error);
        alerts.basicAlert('No se pudo guardar la OC', 'Revisa los datos del maestro e inténtalo de nuevo.', 'error');
        return false;
      }
    }
    purchaseOrder = this.masterRowData.find((row: any) => String(row.id) === String(purchaseOrderId));
    const newItems = data.filter((row: any) => row.__isNew);
    const modifiedItems = data.filter((row: any) => row.__modified && !row.__isNew);

    if (!purchaseOrder?.idIncorExp) {
      alerts.basicAlert('Gasto destino', 'Seleccione el gasto que acepta esta OC antes de guardar sus partidas.', 'warning');
      return false;
    }

    try {
      for (const item of newItems) {
        const cleaned = this.cleanDataForServer(item);
        const saved: any = await lastValueFrom(this.requisitionsService.addReqItem(cleaned));
        const savedId = Number(saved?.id ?? saved?.data?.id ?? 0);
        if (!savedId) throw new Error('La partida de OC no devolvió su identificador.');
        item.id = savedId;
      }

      for (const item of modifiedItems) {
        const cleaned = this.cleanDataForServer(item);
        await lastValueFrom(this.requisitionsService.updateReqItem(item.id, cleaned));
      }

      await this.syncPurchaseOrderTaxes(purchaseOrderId, data);
      await this.syncExpenseDetailsFromPurchaseOrder(purchaseOrderId, data);

      if (newItems.length > 0 || modifiedItems.length > 0) {
        alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los items correctamente.',
          'success'
        );

        // Actualizar el contador de items localmente
        this.updatePurchaseOrderItemsCount(purchaseOrderId, data.length);

        // Limpiar los flags
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });
        await this.refreshRequisitionBalances();
      } else {
        alerts.basicAlert('Partidas vinculadas', 'Las partidas existentes se guardaron en el detalle del gasto seleccionado.', 'success');
      }
      return true;

    } catch (error) {
      console.error('Error saving purchase order items:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los items.',
        'error'
      );
      return false;
    }
  }

  private async syncExpenseDetailsFromPurchaseOrder(purchaseOrderId: number, items: any[]): Promise<void> {
    const oc = this.masterRowData.find((row: any) => Number(row.id) === Number(purchaseOrderId));
    const expenseId = Number(oc?.idIncorExp || 0);
    if (!oc || !expenseId) return;
    try {
      const existingResponse: any = await lastValueFrom(this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(expenseId));
      const existing = Array.isArray(existingResponse) ? existingResponse : [];
      // La cuenta contable se captura en el detalle del Gasto. Para una
      // partida nueva de OC reutilizamos la última cuenta válida del mismo
      // gasto; una cuenta que el usuario ya corrigió nunca se sobrescribe.
      let lastAccountId = Number(
        [...existing]
          .sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0))
          .find((row: any) => Number(row.idContribuyente || 0) > 0)
          ?.idContribuyente || 0
      );
      for (const item of items) {
        const reference = `OC:${purchaseOrderId}:ITEM:${item.id}`;
        const material = this.productos.find((product: any) => Number(product.id) === Number(item.idSupplie));
        const existingConcept = existing.find((row: any) =>
          Number(row.idOcItem) === Number(item.id) || row.numeroIdentificacion === reference
        );
        const idContribuyente = Number(existingConcept?.idContribuyente || 0) || lastAccountId;
        const concept = {
          idIncorExp: expenseId,
          idOcItem: Number(item.id),
          typeExpense: 'PROVEEDORES',
          idExpense: Number(oc.idProvider) || 0,
          idContribuyente,
          // El gasto conserva la fecha capturada en la partida de la OC.
          // Solo las partidas antiguas sin fecha usan la del encabezado.
          dateExpend: item.dateuse || oc.dateCreate || new Date().toISOString(),
          description: material?.description || `Material ${item.idSupplie}`,
          quantity: Number(item.quantity) || 0,
          unit: material?.measure || '',
          price: Number(item.price) || 0,
          iva: Number(item.iva) > 0,
          iva2: Number(item.iva) || 0,
          aplicaIsr: Number(item.retention) > 0,
          isr: Number(item.retention) || 0,
          numeroIdentificacion: reference,
          comment: `OC ${oc.folio || purchaseOrderId}`,
          active: true,
          graficar: true
        };
        if (existingConcept?.id) {
          await lastValueFrom(this.incomesAndExpensesService.updateConceptFromIncomesAndExpenses(existingConcept.id, { ...existingConcept, ...concept, id: existingConcept.id }));
        } else {
          await lastValueFrom(this.incomesAndExpensesService.addConceptFromIncomesAndExpenses(concept));
        }
        if (idContribuyente) lastAccountId = idContribuyente;
      }
      const allConceptsResponse: any = await lastValueFrom(this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(expenseId));
      const allConcepts = Array.isArray(allConceptsResponse) ? allConceptsResponse : [];
      const subtotal = allConcepts.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);
      const iva = allConcepts.reduce((sum: number, item: any) => sum + (Number(item.iva2) || 0), 0);
      const retention = allConcepts.reduce((sum: number, item: any) => sum + (Number(item.isr) || 0), 0);
      await lastValueFrom(this.incomesAndExpensesService.updateTotal(expenseId, {
        subtotal,
        tax: iva,
        total: subtotal + iva - retention,
        modifiedBy: this.trackingService.getEmail()
      }));
    } catch (error) {
      console.error('No fue posible guardar las partidas de OC en el gasto seleccionado:', error);
      throw error;
    }
  }

  async deleteDetailRow(params: any, successCallback: () => void) {
    const purchaseOrderId = params.data.idMovement;
    const detailId = params.data.id;

    const confirmation = await alerts.confirmAlert(
      'Eliminar partida',
      '¿Está seguro de eliminar el registro seleccionado?',
      'warning',
      'Sí, eliminar'
    );
    if (!confirmation.isConfirmed) return;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      this.detailsNotSavedChanges = true;
      // Update count in master grid
      const currentCount = params.api.getDisplayedRowCount();
      this.updatePurchaseOrderItemsCount(purchaseOrderId, currentCount - 1);
      successCallback();
    } else {
      try {
        await lastValueFrom(this.requisitionsService.deleteReqItem(detailId));
        alerts.basicAlert('Item eliminado', 'El item se eliminó correctamente.', 'success');
        successCallback();
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el item.',
          'error'
        );
      }
    }
  }

  updatePurchaseOrderItemsCount(purchaseOrderId: number, count: number) {
    if (this.masterGridApi) {
      this.masterGridApi.forEachNode((node) => {
        if (node.data && node.data.id === purchaseOrderId) {
          node.data.countrow = count;
          this.masterGridApi.refreshCells({
            rowNodes: [node],
            columns: ['countrow'],
            force: true
          });
          console.log(`✅ Actualizado "Items" para orden de compra ${purchaseOrderId}: ${count}`);
        }
      });
    }
  }

  private async syncPurchaseOrderTaxes(purchaseOrderId: number, items: any[]): Promise<void> {
    const purchaseOrder = this.masterRowData.find((row: any) => Number(row.id) === Number(purchaseOrderId));
    if (!purchaseOrder) return;

    purchaseOrder.iva = items.reduce((total: number, item: any) => total + (Number(item.iva) || 0), 0);
    purchaseOrder.ivaRetention = items.reduce((total: number, item: any) => total + (Number(item.retention) || 0), 0);
    delete purchaseOrder.isrRetention;

    await lastValueFrom(
      this.requisitionsService.updateOcAndReq(purchaseOrderId, this.cleanDataForServer(purchaseOrder))
    );

    this.masterGridApi?.refreshCells({
      columns: ['iva', 'ivaRetention'],
      force: true
    });
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}
