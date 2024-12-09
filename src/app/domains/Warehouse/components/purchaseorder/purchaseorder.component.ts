import { Component, effect, HostListener, inject } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
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
  styleUrl: './purchaseorder.component.scss'
})
export class PurchaseOrderComponent {

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

  // Variables compartidas
  masterNotSavedChanges: boolean = false;
  detailsNotSavedChanges: boolean = false;
  id: string = null;
  idProject: number = null;
  private tempIdCounter: number = 0;
  idRequisition: number = null;
  private gridApi: GridApi;

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
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      this.idRequisition = this.signalsService.getIdRequisition()();

      if (this.idProject == null) {
        this.masterRowData = [];
        alerts.basicAlert('Requisiciones', 'Debe elegir un proyecto primero.', 'error');
      } else {
        this.obtenerDatos();
        this.obtenerRequisiciones();
      }

      if (this.idRequisition != null) {
        this.obtenerDetalles();
      }
    })
  }

  ngOnInit() {
    this.signalsService.deleteRequisitionData();
    this.obtenerDatos();
    this.obtenerDepartamentos();
    this.obtenerUbicaciones();
    this.obtenerMonedas();
    this.obtenerUsuarios();
    this.obtenerRequisiciones();
    this.obtenerProveedores();
    this.obtenerTipoPago();
    this.obtenerProductos();
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
  get colMaster(): ColDef[] {
    return [
      { field: 'folio', headerName: 'orden de compra', editable: true, filter: true, width: 150 },
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
        }
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
        }
      },
      {
        field: 'idReq', headerName: 'Requisición', editable: true, filter: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.requisiciones ? this.requisiciones.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.requisiciones ? this.requisiciones.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.folio}` : params.value;
        }
      },
      {
        field: 'idProvider', headerName: 'Proveedor', editable: true, filter: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.proveedores ? this.proveedores.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.proveedores ? this.proveedores.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.name}` : params.value;
        }
      },
      { field: 'delivery', headerName: 'Entrega', editable: true, filter: true, width: 150 },
      { field: 'deliveryTime', headerName: 'Tiempo de entrega', editable: true, filter: true, width: 150 },
      {
        field: 'idCurrency', headerName: 'Moneda', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.monedas ? this.monedas.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.monedas ? this.monedas.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'idPayment', headerName: 'Forma de pago', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.tipoPago ? this.tipoPago.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.tipoPago ? this.tipoPago.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      { field: 'discount', headerName: 'Descuento', editable: true, width: 150 },
      { field: 'ivaRetention', headerName: 'Retención IVA', editable: true, width: 150 },
      { field: 'conditions', headerName: 'Condición', editable: true, width: 150 },
      {
        field: 'comments', headerName: 'Comentario', editable: false, width: 150, cellEditor: 'agPopupTextCellEditor',
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
        }
      },
      {
        field: 'address', headerName: 'Dirección', editable: false, width: 150, cellEditor: 'agPopupTextCellEditor',
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
        }
      },
      {
        field: 'city', headerName: 'Ciudad', editable: false, width: 150, cellEditor: 'agPopupTextCellEditor',
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
        }
      },
      {
        field: 'phone', headerName: 'Teléfono', editable: false, width: 150, cellEditor: 'agPopupTextCellEditor',
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
        }
      },
      {
        field: 'idSolicit', headerName: 'Solicita', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.usuarios ? this.usuarios.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.usuarios ? this.usuarios.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.displayName}` : params.value;
        }
      },
      {
        field: 'idAuthorize', headerName: 'Autoriza', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.usuarios ? this.usuarios.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.usuarios ? this.usuarios.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.displayName}` : params.value;
        }
      },
    ]
  };

  // Column Definitions: Defines the columns to be displayed.
  get colDetails(): ColDef[] {
    return [
      {
        field: 'idSupplie', headerName: 'Producto', editable: true, flex: 3, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.productos ? this.productos.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.productos ? this.productos.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'quantity', headerName: 'Cantidad', editable: true, filter: true, flex: 1, cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        onCellValueChanged: (event: any) => this.updateTotal(event.data)
      },
      {
        field: 'price', headerName: 'Precio', editable: true, filter: true, flex: 1, cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        },
        onCellValueChanged: (event: any) => this.updateTotal(event.data)
      },
      {
        field: 'total', headerName: 'Total', editable: false, filter: true, flex: 1, cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        }
      },
      {
        field: 'comment', headerName: 'Comentarios', editable: false, filter: true, flex: 2, cellEditor: 'agPopupTextCellEditor',
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
        }
      },
    ]
  };

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    this.requisitionsService.getOcAndReqs(this.idProject, "OC").subscribe((data: any) => {
      this.masterRowData = data;
    },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerRequisiciones() {
    this.requisitionsService.getOcAndReqs(this.idProject, "REQUIS").subscribe((data: any) => {
      this.requisiciones = data;
      console.log(this.requisiciones);
    },
      (error) => console.error('Error fetching requisitions:', error)
    );
  }

  obtenerProveedores() {
    this.providersService.getProviders().subscribe((data: any) => {
      this.proveedores = data;
      console.log(this.proveedores);
    },
      (error) => console.error('Error fetching requisitions:', error)
    );
  }

  obtenerUsuarios() {
    this.usersService.getDataUsers().subscribe(
      (response: any) => {
        this.usuarios = response.data;
      },
      (error) => console.error('Error fetching users:', error)
    );
  }

  obtenerDepartamentos() {
    this.departmentsService.getDepartments().subscribe(
      (data: Provider[]) => {
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
    this.currencyService.getCurrencies().subscribe(
      (data: Catalog[]) => {
        this.monedas = data;
      },
      (error) => console.error('Error fetching currencies:', error)
    );
  }

  obtenerTipoPago() {
    this.currencyService.getPaymentTypes().subscribe(
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
        this.signalsService.setRequisitionName(this.masterSelectedRowData.folio);
        this.signalsService.setRequisitionSolicitant(this.masterSelectedRowData.solicit);
        this.signalsService.setRequisitionDate(this.masterSelectedRowData.dateCreate);
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
    this.masterRowData = this.masterRowData.map(row => 
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.gridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      // Mantener la selección si es necesario
      if (this.masterSelectedRowData && this.masterSelectedRowData.id === updatedData.id) {
        rowNode.setSelected(true);
      }
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
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
      address: '',
      city: '',
      phone: '',
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
    this.gridApi.setGridOption("rowData", this.masterRowData);
    
    // Asegurarnos de que la fila nueva esté seleccionada
    requestAnimationFrame(() => {
      const rowNode = this.gridApi.getRowNode(tempId);
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
    const selectedNodes = this.gridApi.getSelectedNodes();
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
    this.requisitionsService.deleteOcAndReq(id).pipe(
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
      .subscribe(
        () => {
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
        }
      );
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
    this.requisitionsService.getReqItems(this.idRequisition).subscribe((data: any) => {
      this.detailsRowData = data;
    });
  }

  obtenerProductos() {
    this.materialsService.getMaterials2Fields().subscribe(
      (data: Catalog[]) => {
        this.productos = data;
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
    const isValid = this.detailsRowData.every((item) => item.idSupplie && item.comment && item.dateuse);
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
    const selectedNodes = this.gridApi.getSelectedNodes();
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
    this.requisitionsService.deleteReqItem(id).pipe(
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
      .subscribe(
        () => {
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
        }
      );
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
    this.gridApi = params.api;
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

}
