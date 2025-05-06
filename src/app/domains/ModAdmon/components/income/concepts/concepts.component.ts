import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { tap, lastValueFrom, concat, toArray, catchError, EMPTY } from 'rxjs';
import { Icatalog } from 'app/interface/icatalog';
import { CatalogsService } from 'app/services/catalogs.service';

@Component({
  selector: 'app-concepts',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, MultiLineEditorComponent],
  templateUrl: './concepts.component.html',
  styleUrl: './concepts.component.scss'
})
export class ConceptsComponent {


  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private catalogsService = inject(CatalogsService);

  async ngOnInit() {
    this.idIncExp = this.signalsService.getIdIncomeAndExpense()();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.getMeasures();
    this.getData();
    await this.getBillingManagementInfo();
  }

  constructor() {
    effect(() => {
      this.idIncExp = this.signalsService.getIdIncomeAndExpense()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getData();
      this.getBillingManagementInfo();
    });
  }

  id: number;
  idRoot: number;
  ivaPercent: number;
  idIncExp: number;
  notSavedChanges: boolean = false;
  newlyAddedRows: string[] = [];
  rowData: any[] = [];
  selectedData: any = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  subtotal: number = 0;
  iva2: number = 0;
  total: number = 0;
  measures: Icatalog[] = [];

  // Para obtener el dato de la facturacion y el porcentaje
  async getBillingManagementInfo() {
    this.administrationService.getBillingManagementInfo(this.idRoot).subscribe(
      (data: any) => {
        this.ivaPercent = data[0]?.iIva;
      },
      (error) => {
        console.error('Error al obtener la información de gestión de facturación:', error);
      }
    );
  }

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

  components =
    {
      multiLineEditorComponent: MultiLineEditorComponent
    }

  get colMaster(): ColDef[] {
    return [
      { field: 'quantity', headerName: 'Cantidad', type: 'number', editable: true, flex: 2 },
      { field: 'description', headerName: 'Concepto', type: 'text', editable: true, flex: 4 },
      {
        field: 'unit', headerName: 'Unidad', type: 'text', editable: true, flex: 2,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.measures.map(measure => measure.description),
        }
      },
      {
        field: 'price',
        headerName: 'Precio',
        type: 'number',
        editable: true,
        flex: 2,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      {
        field: 'total',
        headerName: 'Subtotal',
        type: 'number',
        editable: false,
        flex: 2,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      { field: 'iva', headerName: '¿Aplica IVA?', type: 'boolean', editable: true, flex: 2 },
      {
        field: 'iva2',
        headerName: 'Valor IVA',
        type: 'number',
        hide: true,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
    ]
  }

  async getData() {
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(this.idIncExp).subscribe(
      (data: any) => {
        this.rowData = data;
        this.subtotal = this.calculateSubtotal();
        this.iva2 = this.calculateTotalIVA();
        this.total = this.subtotal + this.iva2;
      },
      (error) => {
        console.error('Error al obtener la información de gestión de facturación:', error);
      }
    );
  }

  async getMeasures() {
    this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe(
      (data: any) => {
        this.measures = data;
        console.log('Medidas:', this.measures);
      },
      (error) => {
        console.error('Error al obtener la información de gestión de facturación:', error);
      }
    )
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedData = selectedNodes[0].data;
    } else {
      this.selectedData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;

    if (['iva', 'quantity', 'price'].includes(event.colDef.field)) {
      const rowData = event.data;

      if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
        rowData.total = Number(rowData.quantity) * Number(rowData.price);
      }

      rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;

      this.gridApi.applyTransactionAsync({
        update: [rowData]
      });

      // Actualizar todos los totales
      this.subtotal = this.calculateSubtotal();
      this.iva2 = this.calculateTotalIVA();
      this.total = this.subtotal + this.iva2;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idIncorExp: this.idIncExp,
      description: '',
      quantity: 0,
      unit: '',
      price: 0,
      subtotal: 0,
      iva: false,
      iva2: 0,
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

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

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.description);
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
      return this.incomesAndExpensesService.addConceptFromIncomesAndExpenses(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.incomesAndExpensesService.updateConceptFromIncomesAndExpenses(row.id, cleanedData);
    });


    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      // Obtener documento principal (que viene en array)
      const mainDocumentResponse: any[] = await lastValueFrom(
        this.incomesAndExpensesService.getIncomeAndExpenseById(this.idIncExp)
      );

      // Tomar el primer elemento del array
      const mainDocument = mainDocumentResponse[0];

      // Crear copia actualizada
      const updatedDocument = {
        ...mainDocument,
        subtotal: this.subtotal,
        tax: this.iva2,
        total: this.total
      };

      console.log('Datos a actualizar:', {
        idDocumento: this.idIncExp,
        documentoOriginal: mainDocument,
        documentoActualizado: updatedDocument,
        cambios: {
          subtotal: `${mainDocument.subtotal} → ${this.subtotal}`,
          iva: `${mainDocument.tax} → ${this.iva2}`,
          total: `${mainDocument.total} → ${this.total}`
        }
      });

      // Enviar actualización (solo el objeto, no el array)
      await lastValueFrom(
        this.incomesAndExpensesService.updateIncomesAndExpenses(this.idIncExp, updatedDocument)
      );
      this.signalsService.triggerUpdateIncAndExp();
      // Forzar nuevo valor en la señal
      setTimeout(() => this.signalsService.triggerUpdateIncAndExp());
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.getData();

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
    this.incomesAndExpensesService.deleteConceptFromIncomesAndExpenses(id).pipe(
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
          this.getData();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
        }
      );
  }

  revert() {
    this.getData();
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

  private calculateSubtotal(): number {
    return this.rowData.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
  }

  private calculateTotalIVA(): number {
    return this.rowData.reduce((acc, row) => acc + (Number(row.iva2) || 0), 0);
  }

}
