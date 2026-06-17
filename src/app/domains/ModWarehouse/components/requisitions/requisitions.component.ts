import { Component, effect, HostListener, inject, ChangeDetectorRef} from '@angular/core';
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
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DeleteButtonCellRendererComponent } from './delete-button-cell-renderer.component';
import { PdfButtonCellRendererRequisitionsComponent } from './pdf-button-cell-renderer-requisitions.component';
import { DetallesRequisicionesComponent } from './detalles-requisiciones.component';
import { DetailCellRendererRequisitionReportComponent } from './detail-cell-renderer-requisition-report.component';

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
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './requisitions.component.html',
  styleUrl: './requisitions.component.scss',
})
export class RequisitionsComponent implements CanComponentDeactivate {
  // Inject of new way for Angular 18
  private requisitionsService = inject(OcAndReqsService);
  private readonly cdr = inject(ChangeDetectorRef);
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
  private prefixSetupService = inject(PrefixSetupService);

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
  private expandedRowId: string | null = null;
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
    detailRowHeight: 1400,
    isRowMaster: (dataItem: any) => true,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'report') {
        return {
          component: DetailCellRendererRequisitionReportComponent,
          params: {}
        };
      }
      // Por defecto, mostrar items
      return { component: DetallesRequisicionesComponent };
    },
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      if (params.data?.locked === true) {
        return 'locked-row';
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
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (!idBranch) { resolve(); return; }
      this.setupService.getWarehouseSetupByBranch(idBranch).subscribe({
        next: (data: any) => {
          this.projectOrBranch = data?.projectOrBranch;
          this.typeReference = this.projectOrBranch ? 'project' : 'branch';
          resolve();
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
        field: 'countItem',
        headerName: 'Items',
        width: 60,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data?.countItem || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f9fa', cursor: 'pointer' }
      },
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 50,
        cellRenderer: PdfButtonCellRendererRequisitionsComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportCascade(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Generar reporte PDF de la Requisición'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'branchName',
        headerName: 'Sucursal',
        editable: false,
        filter: true,
        width: 180,
        valueFormatter: (params) => {
          return params.value || this.signalsService.getBranchNameSelectedBySidebar()();
        }
      },
      {
        field: 'folio',
        headerName: 'Número Doc',
        editable: (params) => !params.data?.locked,
        filter: true,
        width: 150,
      },
      {
        field: 'dateCreate',
        headerName: 'Fecha Solicitud',
        editable: (params) => !params.data?.locked,
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
        editable: (params) => !params.data?.locked,
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
        editable: (params) => !params.data?.locked,
        width: 190,
      },
      {
        field: 'deliveryTime',
        headerName: 'Tiempo Entrega',
        editable: (params) => !params.data?.locked,
        filter: true,
        width: 200,
      },

      {
        field: 'priority',
        headerName: 'Prioridad',
        editable: (params) => !params.data?.locked,
        width: 160,
      },

      {
        field: 'close',
        headerName: 'Cerrado',
        editable: (params) => !params.data?.locked,
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
            detailType: null,
            detailData: []
          }));
        },
        (error) => console.error('Error fetching data:', error)
      );
  }

  obtenerProveedores() {
    this.providersService.getProviders(this.idRoot).subscribe(
      (data: any) => {
        this.proveedores = data;
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
    const folio = await this.prefixSetupService.getNextFolio(type, this.idReference, 'req');

    const newItem = {
      id: tempId,
      folio: folio || '',
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
  
    this.cdr.detectChanges();}

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
  
    this.cdr.detectChanges();}

  onDeleteButtonClick(node: any) {
    node.setSelected(true);
    this.masterSelectedRowData = node.data;
    this.deleteMasterEntry();
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

    // Verificar si está bloqueada (en proceso de cotización)
    if (selectedData.locked === true) {
      alerts.basicAlert(
        'Requisición bloqueada',
        'No se puede eliminar. Esta requisición está en proceso de cotización.',
        'warning'
      );
      return;
    }

    // Verificar si tiene items asociados
    if (selectedData.countrow > 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'No se puede eliminar, tiene items asociados. Elimine primero los items.',
        'error'
      );
      return;
    }

    // Si es una fila nueva (temporal), solo eliminar localmente
    if (id && id.toString().startsWith('temp_')) {
      this.masterRowData = this.masterRowData.filter(row => row.id !== id);
      this.newlyAddedMasterRows = this.newlyAddedMasterRows.filter(tempId => tempId !== id);
      this.masterGridApi.setGridOption('rowData', this.masterRowData);
      this.masterSelectedRowData = null;

      // Verificar si aún hay cambios sin guardar
      this.masterNotSavedChanges = this.masterRowData.some(row => row.__isNew || row.__modified);

      alerts.basicAlert(
        'Eliminar entrada',
        'Entrada eliminada satisfactoriamente.',
        'success'
      );
      return;
    }

    // Eliminar del servidor
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

          }
        }
      });
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
      return this.requisitionsService.addReqItem(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
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
  
    this.cdr.detectChanges();}

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
        // Contar los items activos para actualizar el campo pedimento
        const activeItemsCount = data.filter(item => item.active !== 0).length;

        // Actualizar el campo countItem en la requisición master usando PATCH
        await lastValueFrom(
          this.requisitionsService.setCountItem(requisitionId, activeItemsCount)
        );

        alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los items correctamente.',
          'success'
        );

        // Actualizar el contador en el master grid localmente
        const masterRowNode = this.masterGridApi?.getRowNode(requisitionId.toString());
        if (masterRowNode) {
          const updatedData = { ...masterRowNode.data, countItem: activeItemsCount };
          masterRowNode.setData(updatedData);
          this.masterGridApi.refreshCells({
            rowNodes: [masterRowNode],
            columns: ['countItem'],
            force: true
          });
        }

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
  
    this.cdr.detectChanges();}

  async deleteDetailRow(params: any, successCallback: () => void) {
    const requisitionId = params.data.idMovement;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      this.detailsNotSavedChanges = true;
      // El contador se actualiza desde el backend al guardar
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
  
    this.cdr.detectChanges();}

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
