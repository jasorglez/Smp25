import { Component, effect, HostListener, inject } from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
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
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererRequisitionItemsComponent } from './detail-cell-renderer-requisition-items.component';

interface Catalog {
  id: number;
  description: string;
}

interface Provider {
  id: number;
  name: string;
}

@Component({
  selector: 'app-requisitions',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, DetailCellRendererRequisitionItemsComponent],
  templateUrl: './requisitions.component.html',
  styleUrl: './requisitions.component.scss',
})
export class RequisitionsComponent implements CanComponentDeactivate {
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
  private lastProcessedRequisition: number = null;
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

      // Detectar si solo cambió la requisición seleccionada (no root, project o branch)
      const rootChanged = this.idRoot !== currentRoot;
      const projectChanged = this.idProject !== currentProject;
      const branchChanged = this.idBranch !== currentBranch;
      const requisitionChanged = this.lastProcessedRequisition !== currentRequisition;
      
      // Solo considerar que cambió la requisición si había una anteriormente o si ahora hay una
      const onlyRequisitionChanged = !rootChanged && !projectChanged && !branchChanged && 
                                   requisitionChanged && 
                                   (this.lastProcessedRequisition !== null || currentRequisition !== null);
      

      this.idRoot = currentRoot;
      this.idProject = currentProject;
      this.idBranch = currentBranch;
      this.idRequisition = currentRequisition;
      
      // Actualizar el estado procesado después de la lógica
      this.lastProcessedRequisition = currentRequisition;

      if (this.idRoot) {
        this.getSetupData().then(() => {
          this.idReference = this.projectOrBranch ? this.idProject : this.idBranch;
          
          // Solo cargar datos si tenemos la referencia apropiada Y no es solo cambio de requisición
          if (this.idReference && !onlyRequisitionChanged) {
            this.obtenerDepartamentos();
            this.obtenerDatos();
            this.obtenerUbicaciones();
            this.obtenerMonedas();
            this.obtenerUsuarios();
            this.obtenerProveedores();
            this.obtenerTipoPago();
            this.obtenerProductos();
          }
          
          // Cargar detalles independientemente si hay requisición
          if (this.idRequisition != null) {
            this.obtenerDetalles();
          }
        });
      }
    });
  }

  ngOnInit() {
    // El effect() del constructor ya maneja toda la carga de datos
    // Solo necesitamos inicializar algunos servicios básicos aquí
    this.signalsService.deleteRequisitionData();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges || this.detailsNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  nameRequisition = this.signalsService.getRequisitionName();

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererRequisitionItemsComponent,
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
      event.data.__modified = true;
      this.masterNotSavedChanges = true;
      setTimeout(() => {
        this.masterGridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    }
  };

  getSetupData(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setupService.getWarehouseSetup(this.idRoot).subscribe({
        next: (data: any) => {
          this.projectOrBranch = data[0].projectOrBranch;
          this.typeReference = this.projectOrBranch ? 'project' : 'branch';
          console.log(this.projectOrBranch);
          resolve(); // Resolvemos la promesa aquí
        },
        error: (err) => {
          if (err.status === 404) {
            console.error(err);
            alerts.basicAlert(
              'Requisiciones',
              'No se encontró la configuración de almacenes de la empresa.',
              'error'
            );
          }
          reject(err); // Rechazamos la promesa en caso de error
        },
      });
    });
  }

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
        field: 'folio',
        headerName: 'Número Doc',
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
        field: 'idDepartament',
        headerName: 'Departamento Solicita',
        editable: true,
        width: 190,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.departamentos
            ? this.departamentos.map((item) => item.id)
            : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.departamentos
            ? this.departamentos.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'solicit',
        headerName: 'Solicitante',
        editable: true,
        width: 190,
      },
      {
        field: 'deliveryTime',
        headerName: 'Tiempo Entrega',
        editable: true,
        filter: true,
        width: 200,
      },
 
      {
        field: 'priority',
        headerName: 'Prioridad',
        editable: true,
        width: 160,
      },

       {
        field: 'close',
        headerName: 'Cerrado',
        editable: true,
        width: 120,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
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
      },
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
      },
      {
        field: 'dateuse',
        headerName: 'Fecha de uso',
        editable: true,
        flex: 2,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
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
      .getOcAndReqs(this.typeReference, this.idReference, 'REQUIS')
      .subscribe(
        (data: any) => {
          this.masterRowData = data.map((item: any) => ({
            ...item,
            countrow: item.countrow || 0,
            detailType: null,
            detailData: []
          }));
          console.log(this.typeReference, this.idReference, this.masterRowData);
        },
        (error) => console.error('Error fetching data:', error)
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
      (data: Catalog[]) => {
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
        console.log('Monedas', this.monedas);
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
    console.log('✅ Master Grid Ready - productos length:', this.productos.length);

    // Configurar el context inicial
    this.updateDetailContext();
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
      idReference: this.idReference,
      dateCreate: new Date().toISOString(),
      idProveedor: 0,
      idDepartament: 0,
      delivery: 'A',
      deliveryTime: '',
      dateSupply: '',
      idPayment: 0,
      idCurrency: 0,
      conditions: '',
      IdAuthorize: 0,
      priority: '',
      solicit: this.signalsService.getDisplayName()(),
      type: 'REQUIS',
      comments: '',
      typeOc: 'INSUMOS',
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
      console.log('Master - Datos para agregar:', cleanedData);
      return this.requisitionsService.addOcAndReq(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Master - Datos para actualizar (ID:', row.id, '):', cleanedData);
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
        console.log('✅ Productos cargados:', this.productos.length);
        // Actualizar el context después de cargar productos
        this.updateDetailContext();
      },
      (error) => console.error('Error fetching materials:', error)
    );
  }

  updateDetailContext() {
    if (this.masterGridApi) {
      this.masterGridApi.setGridOption('detailCellRendererParams', {
        getDetailRowData: (params) => {
          params.successCallback(params.data.detailData);
        },
        context: {
          idRoot: this.idRoot,
          typeReference: this.typeReference,
          idReference: this.idReference,
          productos: this.productos,
          componentParent: this,
          gridApi: this.masterGridApi,
          ITEMS: {
            load: (requisitionId: number, callback: (data: any[]) => void) => {
              this.loadRequisitionItems(requisitionId, callback);
            },
            save: (requisitionId: number, data: any[]) => {
              this.saveRequisitionItemsById(requisitionId, data);
            },
            delete: (params: any, callback: () => void) => {
              this.deleteDetailRow(params, callback);
            },
            updateCount: (requisitionId: number, count: number) => {
              this.updateRequisitionItemsCount(requisitionId, count);
            }
          }
        }
      });
      console.log('✅ Context actualizado con productos');
    }
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
      type: 'REQUIS',
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
      console.log('Details - Datos para agregar:', cleanedData);
      return this.requisitionsService.addReqItem(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Details - Datos para actualizar (ID:', row.id, '):', cleanedData);
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

      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'items';

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);
        event.data.detailType = null;

        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida y resetear alturas
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            if (otherNode.expanded) {
              otherNode.setExpanded(false);
              otherNode.data.detailType = null;
            }
            otherNode.setRowHeight(0);
          } else {
            otherNode.setRowHeight(undefined);
          }
        });

        // Cambiar el tipo de detalle ANTES de expandir
        event.data.detailType = 'items';

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir el nodo
        node.setExpanded(true);
      }
    }
  }

  loadRequisitionItems(requisitionId: number, successCallback: any) {
    this.requisitionsService.getReqItems(requisitionId).subscribe({
      next: (data: any) => {
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading requisition items:', error);
        successCallback([]);
      }
    });
  }

  async saveRequisitionItemsById(requisitionId: number, data: any[]) {
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
        this.updateRequisitionItemsCount(requisitionId, data.length);

        // Limpiar los flags
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });
      }

    } catch (error) {
      console.error('Error saving requisition items:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los items.',
        'error'
      );
    }
  }

  async deleteDetailRow(params: any, successCallback: () => void) {
    const requisitionId = params.data.idMovement;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      this.detailsNotSavedChanges = true;
      // Update count in master grid
      const currentCount = params.api.getDisplayedRowCount();
      this.updateRequisitionItemsCount(requisitionId, currentCount - 1);
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

  updateRequisitionItemsCount(requisitionId: number, count: number) {
    if (this.masterGridApi) {
      this.masterGridApi.forEachNode((node) => {
        if (node.data && node.data.id === requisitionId) {
          node.data.countrow = count;
          this.masterGridApi.refreshCells({
            rowNodes: [node],
            columns: ['countrow'],
            force: true
          });
          console.log(`✅ Actualizado "Items" para requisición ${requisitionId}: ${count}`);
        }
      });
    }
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
    this.departamentos = [];
    this.productos = [];
    this.monedas = [];
    
    // Limpiar IDs
    this.idReference = null;
    this.idRequisition = null;
    this.lastProcessedRequisition = null;
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
    // Si existe dateCreate, copiar su valor a dateSupply
    if (cleanedData.dateCreate) {
      cleanedData.dateSupply = cleanedData.dateCreate;
    }
    return cleanedData;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}
