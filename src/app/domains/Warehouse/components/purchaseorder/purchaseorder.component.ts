import { Component, effect, HostListener, inject } from '@angular/core';
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
import { SignalsService } from 'app/services/signals.service';
import { ModalService } from 'app/services/modal.service';
import { ReceiptsService } from 'app/services/receipts.service';
import { UsersService } from 'app/services/users.service';
import { MaterialsService } from 'app/services/materials.service';
import { SetupService } from 'app/services/setup.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

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
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
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
  private setupService = inject(SetupService);

  // Variables compartidas

  masterNotSavedChanges: boolean = false;
  detailsNotSavedChanges: boolean = false;
  id: string = null;
  idBranch: number = null;
  idProject: number = null;
  idReference: number = null;
  private tempIdCounter: number = 0;
  idRequisition: number = null;
  private masterGridApi: GridApi;
  private detailsGridApi: GridApi;
  private gridApi: GridApi;
  idRoot: number = null;
  projectOrBranch: boolean = null; // True = Project, False = Branch
  typeReference: string = null; // project or branch

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
    rowClass: (params) => {
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

  getSetupData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setupService.getWarehouseSetup(this.idRoot).subscribe({
        next: (data: any) => {
          this.projectOrBranch = data[0].projectOrBranch;
          this.typeReference = this.projectOrBranch ? 'project' : 'branch';
          console.log('Referencia', this.typeReference);
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
    rowClass: (params) => {
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
        field: 'folio',
        headerName: 'Orden de compra',
        editable: true,
        filter: true,
        width: 150,
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
        cellEditorParams: {
          values: this.proveedores
            ? this.proveedores.map((item) => item.id)
            : [],
        },
        valueFormatter: (params) => {
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
        cellEditorParams: {
          values: this.monedas ? this.monedas.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
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
        cellEditorParams: {
          values: this.tipoPago ? this.tipoPago.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
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
    this.requisitionsService
      .getOcAndReqs(this.typeReference, this.idReference, 'OC')
      .subscribe(
        (data: any) => {
          this.masterRowData = data;
        },
        (error) => console.error('Error fetching data:', error)
      );
  }

  obtenerRequisiciones() {
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
    this.providersService.getProviders(this.idRoot).subscribe(
      (data: any) => {
        this.proveedores = data;
        console.log(this.proveedores);
      },
      (error) => console.error('Error fetching requisitions:', error)
    );
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
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      folio: '',
      typeReference: this.typeReference,
      idReference: this.idProject,
      dateCreate: new Date().toISOString(),
      idProvider: 0,
      idDepartament: 0,
      delivery: '',
      deliveryTime: '',
      dateSupply: '',
      idPayment: 0,
      idCurrency: 0,
      conditions: '',
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
      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];
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
    this.materialsService.getMaterials2Fields(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.productos = data;
        console.log(data);
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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}