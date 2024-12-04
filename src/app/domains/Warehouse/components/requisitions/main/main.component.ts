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
import { ReqInfoComponent } from "../req-info/req-info.component";

interface Catalog {
  id: number;
  description: string;
}

interface Provider {
  id: number;
  name: string;
}

@Component({
  selector: 'app-requisitions-main',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, ReqInfoComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class RequisitionsMainComponent {
    // Inject of new way for Angular 18
    private requisitionsService = inject(OcAndReqsService);
    private providersService = inject(ProvidersService);
    private catalogsService = inject(CatalogsService);
    private departmentsService = inject(DepartmentsService);
    private currencyService = inject(CurrencyService);
    private signalsService = inject(SignalsService);
    private modalServiceTable = inject(ModalService);
    private receiptsService = inject(ReceiptsService);

  constructor() {
    effect(() => {
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      if (this.idProject == null) {
        this.rowData = [];
        alerts.basicAlert('Requisiciones', 'Debe elegir un proyecto primero.', 'error');
      }
      else {
        this.obtenerDatos();
      }
    })
  }


  ngOnInit() {
    this.obtenerDatos();
    this.obtenerDepartamentos();
    this.obtenerUbicaciones();
    this.obtenerMonedas();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  familias: any;
  departamentos: any;
  ubicaciones: any;
  monedas: any;
  id: string = null;
  idProject: number = null;
  private tempIdCounter: number = 0;
  idRequisition: number = null;

  private gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };
  
  // Column Definitions: Defines the columns to be displayed.
  get colMaster(): ColDef[] {
    return [
      { field: 'folio', headerName: 'Número Doc', editable: true, filter: true, width: 150 },
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
        field: 'idDepartament', headerName: 'Departamento', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.departamentos ? this.departamentos.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.departamentos ? this.departamentos.find(item => item.id === params.value) : null;
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
        field: 'idCurrency', headerName: 'Moneda', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.monedas ? this.monedas.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.monedas ? this.monedas.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      { field: 'conditions', headerName: 'Condición', editable: true, width: 150 },
      { field: 'priority', headerName: 'Prioridad', editable: true, width: 150 },
      { field: 'solicit', headerName: 'Solicita', editable: true, width: 150 },
      { field: 'comments', headerName: 'Comentario', editable: false, width: 150, cellEditor: 'agPopupTextCellEditor',
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
        } },
    ]
  };

  obtenerDatos() {
    this.requisitionsService.getOcAndReqs(this.idProject, "REQUIS").subscribe((data: any) => {
      this.rowData = data;
    });
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

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.signalsService.setIdRequisition(this.selectedRowData.id);
      this.signalsService.setRequisitionName(this.selectedRowData.folio);
      this.signalsService.setRequisitionSolicitant(this.selectedRowData.solicit);
      this.signalsService.setRequisitionDate(this.selectedRowData.dateCreate);
      this.idRequisition = this.signalsService.getIdRequisition()();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;

    if (event.data.idMedida) {
      event.data.idMedida = Number(event.data.idMedida);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      folio: '',
      idProject: this.idProject,
      dateCreate: new Date().toISOString(),
      idProveedor: 0,
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
      type: 'REQUIS',
      comments: '',
      typeOc: 'INSUMOS',
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.folio);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
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
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
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

  async deleteEntry() {
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
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
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

  
  createOC(idRequisition: number, action: string)  {
    this.receiptsService.generateOC(idRequisition, action);
  }


}
