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
  private detailsGridApi: GridApi;
  private gridApi: GridApi;
  idRoot: number = null;
  projectOrBranch: boolean = null; // True = Project, False = Branch
  typeReference: string = null; // project or branch
  activateOc: boolean = true; // True = OC enabled, False = disabled

  // Variables Master
  masterRowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];

  // Catálogos Master
  requisiciones: any[] = [];
  proveedores: any[] = [];
  departamentos: any[] = [];
  ubicaciones: any[] = [];
  monedas: any[] = [];
  usuarios: any[] = [];
  tipoPago: any[] = [];

  // Variables Details
  detailsRowData: any[] = [];
  detailsSelectedRowData: any = null;
  newlyAddedDetailRows: string[] = [];

  // Catálogos Details
  productos: any[] = [];

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
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 1400,
    isRowMaster: (dataItem: any) => true,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'report') {
        return {
          component: DetailCellRendererPurchaseOrderReportComponent,
          params: {}
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
      if (event.newValue === '__ADD_NEW__') return;
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
    return [
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
        width: 50,
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
        editable: true,
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
        editable: true,
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
        editable: true,
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
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.requisiciones
            ? this.requisiciones.map((item) => item.id)
            : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.requisiciones
            ? this.requisiciones.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.folio}` : params.value;
        },
      },
      {
        field: 'idProvider',
        headerName: 'Proveedor',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...(this.proveedores ? this.proveedores.map((item) => item.id) : []), '__ADD_NEW__'],
        }),
        valueFormatter: (params) => {
          if (params.value === '__ADD_NEW__') return '+ Agregar Nuevo';
          const foundItem = this.proveedores
            ? this.proveedores.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.name}` : params.value;
        },
      },     
      {
        field: 'idCurrency',
        headerName: 'Moneda',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...(this.monedas ? this.monedas.map((item) => item.id) : []), '__ADD_NEW__'],
        }),
        valueFormatter: (params) => {
          if (params.value === '__ADD_NEW__') return '+ Agregar Nuevo';
          const foundItem = this.monedas
            ? this.monedas.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'idPayment',
        headerName: 'Forma de pago',
        editable: true,
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
        editable: true,
        width: 150,
      },
      {
        field: 'ivaRetention',
        headerName: 'Retención IVA',
        editable: true,
        width: 150,
      },
       {
        field: 'delivery',
        headerName: 'Entrega',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'deliveryTime',
        headerName: 'Tiempo de entrega',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'conditions',
        headerName: 'Condición',
        editable: true,
        width: 150,
      },     
      {
        field: 'idSolicit',
        headerName: 'Solicita',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.usuarios ? this.usuarios.map((item) => item.id) : [],
        },
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
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.usuarios ? this.usuarios.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.usuarios
            ? this.usuarios.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.displayName}` : params.value;
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
        },
        (error) => console.error('Error fetching data:', error)
      );
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
          this.requisiciones = data;
          console.log(this.requisiciones);
        },
        (error) => console.error('Error fetching requisitions:', error)
      );
  }

  obtenerProveedores() {
    if (this.proveedores && this.proveedores.length > 0) {
      console.log('⚠️ Proveedores ya cargados, no se vuelven a cargar');
      return;
    }
    this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : [];
        this.proveedores = arr.map((p: any) => ({ id: p.id, name: p.company || p.namecontact || '' }));
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
      (data: Provider[]) => {
        this.departamentos = data;
        console.log(this.departamentos);
      },
      (error) => console.error('Error fetching departments:', error)
    );
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
    this.currencyService.getCurrencies(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.monedas = data;
      },
      (error) => console.error('Error fetching currencies:', error)
    );
  }

  obtenerTipoPago() {
    this.currencyService.getPaymentTypes(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.tipoPago = data;
      },
      (error) => console.error('Error fetching payment types:', error)
    );
  }

  private async handleSentinel(colId: string): Promise<number | null> {
    if (colId === 'idProvider')      return this.openAddProveedorDialog();
    if (colId === 'idCurrency')      return this.openAddMonedaDialog();
    if (colId === 'idPayment')       return this.openAddTipoPagoDialog();
    return null;
  }

  async openAddProveedorDialog(): Promise<number | null> {
    const result = await Swal.fire({
      title: 'Nuevo Proveedor',
      html: `
        <input id="prov-name" class="swal2-input" placeholder="Nombre / Empresa">
        <input id="prov-rfc"  class="swal2-input" placeholder="RFC (opcional)">
      `,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      focusConfirm: false,
      preConfirm: (): { name: string; rfc: string } | null => {
        const name = (document.getElementById('prov-name') as HTMLInputElement).value.trim();
        const rfc  = (document.getElementById('prov-rfc')  as HTMLInputElement).value.trim();
        if (!name) { Swal.showValidationMessage('El nombre es requerido'); return null; }
        return { name, rfc };
      },
    });
    if (!result.isConfirmed || !result.value) return null;
    try {
      const created: any = await lastValueFrom(
        this.customersService.addCustomer({
          namecontact: result.value.name,
          company:     result.value.name,
          rfc:         result.value.rfc || 'SIN RFC',
          id_root:     this.idRoot,
          type:        'PROVIDERS',
          active:      true,
          vigente:     true,
        })
      );
      await new Promise<void>((resolve) =>
        this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
          next: (data: any) => {
            const arr = Array.isArray(data) ? data : [];
            this.proveedores = arr.map((p: any) => ({ id: p.id, name: p.company || p.namecontact || '' }));
            resolve();
          },
          error: () => resolve(),
        })
      );
      this.updateDetailContext();
      return created?.id ?? null;
    } catch {
      alerts.basicAlert('Error', 'No se pudo agregar el proveedor.', 'error');
      return null;
    }
  }

  async openAddMonedaDialog(): Promise<number | null> {
    const result = await Swal.fire({
      title: 'Nueva Moneda',
      input: 'text',
      inputLabel: 'Descripción (ej. USD, EUR, MXN)',
      inputPlaceholder: 'Descripción de la moneda',
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      inputValidator: (value) => (!value?.trim() ? 'La descripción es requerida' : null),
    });
    if (!result.isConfirmed || !result.value) return null;
    try {
      const created: any = await lastValueFrom(
        this.catalogsService.addCatalog({ description: result.value.trim(), type: 'Currency', idCompany: this.idRoot })
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
      input: 'text',
      inputLabel: 'Descripción',
      inputPlaceholder: 'Ej: Transferencia, Cheque, Efectivo',
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      inputValidator: (value) => (!value?.trim() ? 'La descripción es requerida' : null),
    });
    if (!result.isConfirmed || !result.value) return null;
    try {
      const created: any = await lastValueFrom(
        this.catalogsService.addCatalog({ description: result.value.trim(), type: 'TYPECURRENCY', idCompany: this.idRoot })
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

  onMasterCellValueChanged(event: any) {
    const colId = event.column.getColId();
    if (event.newValue === '__ADD_NEW__') {
      const node = event.node;
      node.data[colId] = event.oldValue ?? null;
      this.masterGridApi?.refreshCells({ rowNodes: [node], force: true });
      setTimeout(() => {
        this.handleSentinel(colId).then(newId => {
          if (newId) {
            node.data[colId] = newId;
            node.data.__modified = true;
            this.masterNotSavedChanges = true;
            this.masterGridApi?.refreshCells({ rowNodes: [node], force: true });
          }
        });
      }, 150);
      return;
    }

    const updatedData = { ...event.data };

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
      // Mantener la selección si es necesario
      if (
        this.masterSelectedRowData &&
        this.masterSelectedRowData.id === updatedData.id
      ) {
        rowNode.setSelected(true);
      }
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.masterGridApi = params.api;
    console.log('✅ Master Grid Ready - productos length:', this.productos.length, 'proveedores length:', this.proveedores.length);

    // Configurar el context inicial
    this.updateDetailContext();
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  async addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;

    // Generar folio automáticamente desde PrefixSetup
    const type: 'project' | 'branch' = this.projectOrBranch ? 'project' : 'branch';
    const folio = await this.prefixSetupService.getNextFolio(type, this.idReference, 'oc');

    const newItem = {
      id: tempId,
      folio: folio || '',
      typeReference: this.typeReference,
      idReference: this.idProject,
      dateCreate: new Date().toISOString(),
      idProvider: 0,
      idDepartament: 0,
      delivery: '1 dia',
      deliveryTime: '1',
      dateSupply: '',
      idPayment: 0,
      idCurrency: 0,
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
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
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

  deleteMasterEntry() {
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
          componentParent: this,
          gridApi: this.masterGridApi,
          ITEMS: {
            load: (purchaseOrderId: number, callback: (data: any[]) => void) => {
              this.loadPurchaseOrderItems(purchaseOrderId, callback);
            },
            save: (purchaseOrderId: number, data: any[]) => {
              this.savePurchaseOrderItemsById(purchaseOrderId, data);
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

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== MASTER-DETAIL CASCADE METHODS ====================

  toggleCascade(node: any) {
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

  async savePurchaseOrderItemsById(purchaseOrderId: number, data: any[]) {
    const newItems = data.filter((row: any) => row.__isNew);
    const modifiedItems = data.filter((row: any) => row.__modified && !row.__isNew);

    try {
      for (const item of newItems) {
        const cleaned = this.cleanDataForServer(item);
        await lastValueFrom(this.requisitionsService.addReqItem(cleaned));
      }

      for (const item of modifiedItems) {
        const cleaned = this.cleanDataForServer(item);
        await lastValueFrom(this.requisitionsService.updateReqItem(item.id, cleaned));
      }

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
      }

    } catch (error) {
      console.error('Error saving purchase order items:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los items.',
        'error'
      );
    }
  }

  async deleteDetailRow(params: any, successCallback: () => void) {
    const purchaseOrderId = params.data.idMovement;
    const detailId = params.data.id;

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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}
