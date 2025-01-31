import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import {
  catchError,
  concat,
  EMPTY,
  lastValueFrom,
  toArray,
  forkJoin,
} from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { ModalService } from 'app/services/modal.service';
import { ReceiptsService } from 'app/services/receipts.service';
import { MaterialsService } from 'app/services/materials.service';
import { InandoutService } from 'app/services/inandout.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';

interface Catalog {
  id: number;
  description: string;
}

@Component({
  selector: 'app-outings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    SearchableSelectComponent,
  ],
  templateUrl: './outings.component.html',
  styleUrl: './outings.component.scss',
})
export class OutingsComponent implements OnInit {
  // Inject services
  private inAndOutsService = inject(InandoutService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private receiptsService = inject(ReceiptsService);
  private materialsService = inject(MaterialsService);
  private ocService = inject(OcAndReqsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private warehousesService = inject(WarehousesService);
  private catalogsService = inject(CatalogsService);

  // Shared variables
  masterNotSavedChanges: boolean = false;
  detailsNotSavedChanges: boolean = false;
  id: string = null;
  idProject: number = null;
  idWarehouse: number = null;
  private tempIdCounter: number = 0;
  IdInAndOut: number = null;
  private masterGridApi: GridApi;
  private detailsGridApi: GridApi;
  idRoot: number = null;

  // Master variables
  masterRowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];

  // Master catalogs
  requisiciones: any[] = [];
  tipoEntrada: any;

  // Details variables
  detailsRowData: any[] = [];
  detailsSelectedRowData: any = null;
  newlyAddedDetailRows: string[] = [];

  // Details catalogs
  productos: any[] = [];

  // Grid configuration
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  // Warehouses with permissions
  warehousesWithPermissions: any[] = [];

  readonly type = 'OUT';

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      this.IdInAndOut = this.signalsService.getIdInAndOut()();

      // Solo llamar a obtenerAlmacenesPorUsuario si idWarehouse es null
      if (!this.idWarehouse) {
        this.obtenerAlmacenesPorUsuario().then(() => {
          // Si hay almacenes con permisos, seleccionar el primero
          if (this.warehousesWithPermissions.length > 0) {
            this.idWarehouse = this.warehousesWithPermissions[0].id;
          }
        });
      }

      if (this.idProject == null) {
        this.masterRowData = [];
        alerts.basicAlert('Salidas',
          'Debe elegir un proyecto primero.',
          'error'
        );
      } else {
        this.obtenerDatos();
        this.obtenerRequisiciones();
      }

      if (this.IdInAndOut != null) {
        this.obtenerDetalles();
      }
    });
  }

  ngOnInit() {
    this.signalsService.deleteInAndOutData();
    this.obtenerDatos();
    this.obtenerRequisiciones();
    this.obtenerProductos();
    this.obtenerAlmacenesPorUsuario();
    this.obtenerTiposEntrada();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges || this.detailsNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  nameInAndOut = this.signalsService.getInAndOutName();

  // Column Definitions: Defines the columns to be displayed.
  components = {
    searchableSelectComponent: SearchableSelectComponent,
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'folio',
        headerName: 'Número Documento',
        editable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'date',
        headerName: 'Fecha Entrada',
        editable: true,
        flex: 1,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
      },
      {
        field: 'deliveryDate',
        headerName: 'Fecha Entrega',
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
        field: 'idOc',
        headerName: 'Requisición',
        editable: true,
        filter: true,
        flex: 1,
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
        field: 'idType',
        headerName: 'Tipo de entrada',
        editable: true,
        filter: true,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.tipoEntrada
            ? this.tipoEntrada.map((item) => item.id)
            : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.tipoEntrada
            ? this.tipoEntrada.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'numBill',
        headerName: 'Número de factura',
        editable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'deliverName',
        headerName: 'Entrega',
        editable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: false,
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

  // Column Definitions: Defines the columns to be displayed.
  get colDetails(): ColDef[] {
    return [
      {
        field: 'idProduct',
        headerName: 'Producto',
        editable: true,
        flex: 3,
        cellEditor: 'searchableSelectComponent',
        cellEditorParams: {
          options: this.productos,
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
        headerName:
          'Cantidad a entregar',
        editable: true,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0,
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined
            ? `${params.value.toFixed(2)}`
            : '0.00';
        },
        valueSetter: (params) => {
          const newValue = Number(params.newValue);
          const total = params.data.total || 0;

          if (newValue > total) {
            alerts.basicAlert(
              'Error',
              'La cantidad recibida no puede ser mayor que el total',
              'error'
            );
            return false;
          }

          params.data.quantity = newValue;
          this.updatePending(params.data);
          return true;
        },
      },
      {
        field: 'pending',
        headerName: 'Restante',
        editable: false,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0,
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined
            ? `${params.value.toFixed(2)}`
            : '0.00';
        },
      },
      {
        field: 'total',
        headerName: 'Total inicial',
        editable: true,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0,
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined
            ? `${params.value.toFixed(2)}`
            : '0.00';
        },
        valueSetter: (params) => {
          const newTotal = Number(params.newValue);
          const quantity = params.data.quantity || 0;

          if (quantity > newTotal) {
            params.data.quantity = newTotal;
          }

          params.data.total = newTotal;
          this.updatePending(params.data);
          return true;
        },
      },
    ];
  }

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    this.inAndOutsService
      .getInAndOuts(this.idProject, this.idWarehouse, this.type)
      .subscribe(
        (data: any) => {
          this.masterRowData = data;
        },
        (error) => console.error('Error fetching data:', error)
      );
  }

  obtenerRequisiciones() {
    this.ocService
      .getOcAndReqs(this.idProject, 'REQUIS')
      .subscribe(
        (data: any) => {
          this.requisiciones = data;
          console.log(this.requisiciones);
        },
        (error) => console.error('Error fetching requisitions:', error)
      );
  }

  obtenerTiposEntrada() {
    this.catalogsService.getDataTypes().subscribe(
      (data: any) => {
        this.tipoEntrada = data;
        console.log(this.tipoEntrada);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  onWarehouseChange(event: any) {
    this.idWarehouse = Number(event.target.value);
    this.obtenerDatos(); // Recargar los datos con el nuevo almacén seleccionado
  }

  async obtenerAlmacenesPorUsuario() {
    try {
      const [permissions, warehouses] = await lastValueFrom(
        forkJoin([
          this.usersxpermissionsService.getUserxPermissionByEmail(
            'warehouse',
            localStorage.getItem('mail')
          ),
          this.warehousesService.getSimpleWarehouses(
            Number(localStorage.getItem('company'))
          ),
        ])
      );

      this.warehousesWithPermissions = warehouses.filter((warehouse) =>
        permissions.some(
          (permission) => permission.idPermission === warehouse.id
        )
      );
      return this.warehousesWithPermissions;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.masterSelectedRowData = { ...selectedNodes[0].data };
      this.detailsNotSavedChanges = false;

      // Mantener el idWarehouse actual si existe
      if (selectedNodes[0].data.idWarehouse) {
        this.idWarehouse = selectedNodes[0].data.idWarehouse;
      }

      if (!this.newlyAddedMasterRows.includes(this.masterSelectedRowData.id)) {
        this.signalsService.setIdInAndOut(this.masterSelectedRowData.id);
        this.signalsService.setInAndOutName(this.masterSelectedRowData.folio);
        this.IdInAndOut = this.signalsService.getIdInAndOut()();
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
      idProject: this.idProject,
      idWarehouse: this.idWarehouse,
      idType: 0,
      date: new Date().toISOString(),
      deliveryDate: new Date().toISOString(),
      idOc: 0,
      numBill: '',
      deliverName: '',
      comment: '',
      type: this.type,
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
      return this.inAndOutsService.addInAndOut(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.inAndOutsService.updateInAndOut(row.id, cleanedData);
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
    this.inAndOutsService
      .deleteInAndOut(id)
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

  createInOutReceipt(IdInAndOut: number, action: string) {
    this.receiptsService.generateInOut(IdInAndOut, action);
  }

  // ==================== DETAILS METHODS ====================

  obtenerDetalles() {
    this.inAndOutsService
      .getInAndOutItems(this.IdInAndOut)
      .subscribe((data: any) => {
        this.detailsRowData = data;
      });
  }

  obtenerProductos() {
    this.materialsService.getMaterials2Fields(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.productos = data;
      },
      (error) => console.error('Error fetching materials:', error)
    );
  }

  updatePending(data: any) {
    if (data.quantity && data.total) {
      data.pending = data.total - data.quantity;
    } else {
      data.pending = 0;
    }
  }

  addDetailsRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idInandout: this.IdInAndOut,
      idProduct: 0,
      quantity: 0,
      pending: 0,
      total: 0,
      active: true,
      __isNew: true,
    };

    this.detailsRowData = [newItem, ...this.detailsRowData];
    this.newlyAddedDetailRows.push(tempId);
    this.detailsNotSavedChanges = true;
  }

  async saveDetailsChanges() {
    const isValid = this.detailsRowData.every(
      (item) => item.idProduct && item.quantity && item.total
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
      console.log(cleanedData);
      return this.inAndOutsService.addInAndOutItem(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.inAndOutsService.updateInAndOutItem(row.id, cleanedData);
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
    this.inAndOutsService
      .deleteInAndOutItem(id)
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

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  get componentTitle(): string {
    return 'Salidas';
  }
}