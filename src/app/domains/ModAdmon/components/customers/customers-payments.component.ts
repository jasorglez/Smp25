import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { CustomersService } from 'app/services/customers.service';


@Component({
  selector: 'app-customers-payments',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './customers-payments.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersPaymentsComponent {


  ngOnInit() {
    this.obtenerDatos();
  }

  constructor() {
    effect(() => {
      this.idClient = this.signalsService.getIdClient()();
      this.nameClient = this.signalsService.getNameClient()();
      this.obtenerDatos();
    }
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;

  detalleRowData: any[] = [];
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  branches: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';


  // Inject of new way for Angular 18
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);

  // Interceptar signals
  idClient = this.signalsService.getIdClient()();
  nameClient = this.signalsService.getNameClient()();

  // Column Definitions: Defines the columns to be displayed.

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 20,
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
    // Deseleccionar otras filas cuando se selecciona una nueva
    if (event.node.isSelected()) {
      this.gridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  },
};

private maestroGridApi: GridApi;
private detalleGridApi: GridApi;
detailNotSavedChanges: boolean = false;
  
  get colMaster(): ColDef[] {
    return [
      { field: 'numberNote', headerName: 'Número de nota', editable: true, filter: true, width: 200 },
      { field: 'date', headerName: 'Fecha', editable: true, filter: true, width: 200, 
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        } },
   
      { field: 'quantity', headerName: 'Cantidad', editable: true, filter: true, width: 200 },
      {
        field: 'total', headerName: 'Total', editable: true, filter: true, width: 200, cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        }
      }


    ]
  };
  
  onDetalleGridReady(params: GridReadyEvent) {
    this.detalleGridApi = params.api;
  }

  public detalleGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onDetalleRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onDetalleRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  detalleColumnDefs: ColDef[] = [
    {
      headerName: 'Fecha',
      field: 'date',
      valueGetter: (params) => params.data.date ? new Date(params.data.date) : null,
      cellEditor: 'agDateCellEditor',
      cellEditorParams: {
        min: new Date(2000, 0, 1),
        max: new Date(2050, 11, 31),
      },
      valueFormatter: (params) => {
        if (params.value) {
          const date = new Date(params.value);
          return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true
    },
    {
      headerName: 'Abono *',
      headerClass: 'required-header',
      field: 'total',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true
    },
    { 
      headerName: 'Comentario', 
      field: 'descripcion', 
      flex: 2,
      editable: (params) => params.data?.__isNew === true
    },
  ];

  obtenerDatos() {
    this.customersService.getClientCredits(this.idClient).subscribe((data: any) => {
      this.rowData = data;
    });
  }

  onSelectedRow(event: any) {
    console.log(event)
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    console.log(event)
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCustomer: this.idClient,
      numberNote: '',
      date: new Date().toISOString().split('T')[0],
      dateP: null,
      quantity: 0,
      total: 0,
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.detailNotSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.numberNote && item.date && item.dateP && item.quantity && item.total);
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
      return this.customersService.addClientCredit(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customersService.updateClientCredit(row.id, cleanedData);
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
    this.customersService.deleteClientCredit(id).pipe(
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

  onDetailCellValueChanged($event) {
    console.log('Dato cambiado:', $event.data);
    $event.data.__modified = true;
    this.detailNotSavedChanges = true;
  }

}





