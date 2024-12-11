import { Component, effect, HostListener, inject } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
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

interface Catalog {
  id: number;
  description: string;
}

interface Provider {
  id: number;
  name: string;
}

@Component({
  selector: 'app-inandout',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './inandout.component.html',
  styleUrl: './inandout.component.scss'
})
export class InAndOutComponent {

  // Inject of new way for Angular 18
  private inAndOutsService = inject(InandoutService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private receiptsService = inject(ReceiptsService);
  private materialsService = inject(MaterialsService);
  private ocService = inject(OcAndReqsService)

  // Variables compartidas
  masterNotSavedChanges: boolean = false;
  detailsNotSavedChanges: boolean = false;
  id: string = null;
  idProject: number = null;
  private tempIdCounter: number = 0;
  IdInAndOut: number = null;
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
      this.IdInAndOut = this.signalsService.getIdInAndOut()();

      if (this.idProject == null) {
        this.masterRowData = [];
        alerts.basicAlert('Requisiciones', 'Debe elegir un proyecto primero.', 'error');
      } else {
        this.obtenerDatos();
        this.obtenerRequisiciones();
      }

      if (this.IdInAndOut != null) {
        this.obtenerDetalles();
      }
    })
  }

  ngOnInit() {
    this.signalsService.deleteRequisitionData();
    this.obtenerDatos();
    this.obtenerRequisiciones();
    this.obtenerProductos();
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
  get colMaster(): ColDef[] {
    return [
      { field: 'folio', headerName: 'Número Documento', editable: true, filter: true, width: 150 },
      {
        field: 'date',
        headerName: 'Fecha Entrada',
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
        }
      },
      {
        field: 'idOc', headerName: 'Orden de compra', editable: true, filter: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.requisiciones ? this.requisiciones.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.requisiciones ? this.requisiciones.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.folio}` : params.value;
        }
      },
      { field: 'numBill', headerName: 'Número de factura', editable: true, filter: true, width: 150 },
      { field: 'deliverName', headerName: 'Entrega', editable: true, filter: true, width: 150 },
      {
        field: 'comment', headerName: 'Comentario', editable: false, width: 150, cellEditor: 'agPopupTextCellEditor',
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
      }
    ]
  };

  // Column Definitions: Defines the columns to be displayed.
  get colDetails(): ColDef[] {
    return [
      {
        field: 'idProduct', headerName: 'Producto', editable: true, flex: 3, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.productos ? this.productos.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.productos ? this.productos.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'quantity', 
        headerName: 'Cantidad', 
        editable: true, 
        filter: true, 
        flex: 1, 
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined ? `${params.value.toFixed(2)}` : '0.00';
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
        }
      },
      {
        field: 'pending', headerName: 'Pendiente', editable: false, filter: true, flex: 1, cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined ? `${params.value.toFixed(2)}` : '0.00';
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        editable: true,
        filter: true,
        flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined ? `${params.value.toFixed(2)}` : '0.00';
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
        }
      }
    ]
  };

  // ==================== MASTER METHODS ====================

  obtenerDatos() {
    this.inAndOutsService.getInAndOuts(this.idProject, "IN").subscribe((data: any) => {
      this.masterRowData = data;
    },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerRequisiciones() {
    this.ocService.getOcAndReqs(this.idProject, "OC").subscribe((data: any) => {
      this.requisiciones = data;
      console.log(this.requisiciones);
    },
      (error) => console.error('Error fetching requisitions:', error)
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
      date: new Date().toISOString(),
      deliveryDate: new Date().toISOString(),
      idOc: 0,
      numBill: '',
      deliverName: '',
      comment: '',
      type: 'IN',
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
    this.inAndOutsService.deleteInAndOut(id).pipe(
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

  createOC(IdInAndOut: number, action: string) {
    this.receiptsService.generateOC(IdInAndOut, action);
  }

 

  // ==================== DETAILS METHODS ====================

  obtenerDetalles() {
    this.inAndOutsService.getInAndOutItems(this.IdInAndOut).subscribe((data: any) => {
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
    const isValid = this.detailsRowData.every((item) => item.idProduct && item.quantity && item.total);
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
    this.inAndOutsService.deleteInAndOutItem(id).pipe(
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
