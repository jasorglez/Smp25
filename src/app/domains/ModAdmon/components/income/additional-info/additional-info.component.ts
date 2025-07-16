import { Component, effect, inject } from '@angular/core';
import { MultiLineEditorComponent } from "../../../../../shared/multi-line/multi-line-editor.component";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, concat, toArray } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';
import { Icatalog } from 'app/interface/icatalog';

@Component({
  selector: 'app-additional-info',
  standalone: true,
  imports: [AgGridModule, MultiLineEditorComponent, CommonModule, FormsModule],
  templateUrl: './additional-info.component.html',
  styleUrl: './additional-info.component.scss'
})
export class AdditionalInfoComponent {

  private administrationService = inject(AdministrationService);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);

  ngOnInit() {
    this.idInAndExp = this.signalsService.getIdIncomeAndExpense()();
    this.getAdditionalInfo();
  }

  constructor() {
     // Añadir binding de métodos
    this.onCellValueChanged = this.onCellValueChanged.bind(this);
    this.onGridReady = this.onGridReady.bind(this);

    effect(() => {
      this.idRoot     = this.signalsService.getRootSelectedBySidebar()();
      this.idInAndExp = this.signalsService.getIdIncomeAndExpense()();
      this.notSavedChanges = false;
      this.getAdditionalInfo();
      this.getPaymentTypes();
      this.getCurrencies();
    });
  }

  idRoot: number ;
  rowData: any[] = [];
  idInAndExp: number;
  newData: boolean;
  notSavedChanges: boolean;
  private gridApi: GridApi;
  paymentTypesList: Icatalog[] = [];
  currencies: Icatalog[] = [];

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
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

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  components = {
    multiLineEditor: MultiLineEditorComponent
  };

  async getAdditionalInfo() {
    this.administrationService.getAdditionalInfo(this.idInAndExp).subscribe
      (
        (data) => {
          this.rowData = data;
          this.newData = false;
        },
        (error) => {
          if (error.status === 404) {
            this.rowData = [];
            this.newData = true;
            this.addRow();
          }
          console.error(error);
        }
      )
  }

  async getPaymentTypes() {
    this.catalogsService.getCatalogs(this.idRoot,"PAY").subscribe(
      (data) => {
        this.paymentTypesList = data;
        console.log(this.paymentTypesList);
      },
      (error) => {
        if (error.status === 404) {
          this.paymentTypesList = [];
        }
        console.error(error);
      }
    )
  }

  async getCurrencies() {
    this.catalogsService.getCatalogs(this.idRoot,"CURRENCY").subscribe(
      (data) => {
        this.currencies = data;
        console.log(data);
      },
      (error) => {
        if (error.status === 404) {
          this.currencies = [];
        }
        console.error(error);
      })
  }

  addRow() {
    const newRow = {
      idIncorexp: this.idInAndExp,
      orderNumber: 'S/O',
      idTypepay: 0,
      quote: '',
      idConditionspay: 0,
      purchaseOrder: 'S/OC',
      idTypemoney: 0,
      numberEntry: 'S/ENT',
      folioFiscal: 'SIN FOLIO',
      active: true,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.newData = true;
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.idIncorexp === this.idInAndExp && row.__isNew);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colMaster.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey, // Editar la primera columna editable
        });
      }
    }, 50); // Un pequeño retraso de 50ms
  }

 onGridReady = (params: GridReadyEvent) => {
  this.gridApi = params.api;
  
  // Actualizar columnas si es necesario
  if ( this.colMaster) {
    params.api.updateGridOptions({ columnDefs: this.colMaster });
  }
  
  console.log('Grid ready:', params.api);
}

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);

    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.orderNumber);
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
      return this.administrationService.addAdditionalInfo(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateAdditionalInfo(this.idInAndExp, cleanedData);
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
      this.getAdditionalInfo(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revert() {
    this.getAdditionalInfo();
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

  get colMaster(): ColDef[] {
    return [
      { field: 'orderNumber', headerName: 'Número de orden', sortable: true, filter: true, editable: true, flex: 1 },
      {
        field: 'idTypepay', headerName: 'Tipo de pago', sortable: true, filter: true, editable: true, flex: 1, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.paymentTypesList.map(user => user.id)
        },
        valueFormatter: (params) => {
          const foundPaymentType = this.paymentTypesList
            ? this.paymentTypesList.find((user) => user.id === params.value)
            : null;
          return foundPaymentType ? `${foundPaymentType.description}` : params.value;
        },
      },
      { field: 'quote', headerName: 'Cotización', sortable: true, filter: true, editable: true, flex: 1 },
      { field: 'idConditionspay', headerName: 'Condiciones de pago', sortable: true, filter: true, editable: true, flex: 1 },
      { field: 'purchaseOrder', headerName: 'Orden de compra', sortable: true, filter: true, editable: true, flex: 1 },
      {
        field: 'idTypemoney', headerName: 'Tipo de moneda', sortable: true, filter: true, editable: true, flex: 1, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.currencies.map(user => user.id)
        },
        valueFormatter: (params) => {
          const currencyList = this.currencies
            ? this.currencies.find((user) => user.id === params.value)
            : null;
          return currencyList ? `${currencyList.description}` : params.value;
        },
      },
      { field: 'numberEntry', headerName: 'Número de entrada', sortable: true, filter: true, editable: true, flex: 1 },
      { field: 'folioFiscal', headerName: 'Folio fiscal', sortable: true, filter: true, editable: true, flex: 1 },
    ];
  }

}
