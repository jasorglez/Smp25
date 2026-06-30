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
import { PosService } from 'app/services/pos.service';
import { TrackingService } from 'app/services/tracking.service';


@Component({
  selector: 'app-customers-sales',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './customers-sales.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersSalesComponent {
  private trackingService = inject(TrackingService);


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
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  // Inject of new way for Angular 18
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private posService = inject(PosService);

  // Interceptar signals
  idClient = this.signalsService.getIdClient()();
  nameClient = this.signalsService.getNameClient()();

  // Column Definitions: Defines the columns to be displayed.

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
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
  
  get colMaster(): ColDef[] {
    return [
      { field: 'id', headerName: 'Número de nota', filter: true, width: 200 },
      { field: 'date', headerName: 'Fecha', filter: true, width: 200, 
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        } },
      { field: 'lector', headerName: '¿Lector?', filter: true, width: 200 },
      { field: 'credit', headerName: '¿Crédito?', filter: true, width: 200 },
      { field: 'amount', headerName: 'Total', filter: true, width: 200, valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN'
        }).format(params.value || 0);
      } },
    ]
  };

  obtenerDatos() {
    this.posService.getSalesXCustomer(this.idClient).subscribe((data: any) => {
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo customers sales', 'Admon', this.trackingService.getEmail());
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
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en customers sales', 'Admon', this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó customers sales', 'Admon', this.trackingService.getEmail());
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
          this.obtenerDatos();
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en customers sales', 'Admon', this.trackingService.getEmail());
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

}





