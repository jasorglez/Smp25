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
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { tap, lastValueFrom, concat, toArray, catchError, EMPTY } from 'rxjs';
import { Icatalog } from 'app/interface/icatalog';
import { CatalogsService } from 'app/services/catalogs.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-conceptsincome',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './conceptsincome.component.html',
  styleUrl: './conceptsincome.component.scss'
})
export class ConceptsincomeComponent {

    private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private catalogsService = inject(CatalogsService);
  private route = inject(ActivatedRoute);

 ngOnInit() {
  console.log('Concepts Component Initializing');
  this.idIncExp = this.signalsService.getIdIncomeAndExpense()();
  this.idRoot = this.signalsService.getRootSelectedBySidebar()();
  console.log('Initial values - idIncExp:', this.idIncExp, 'idRoot:', this.idRoot);

  this.getMeasures();
  this.loadSATCatalogs();

  if (this.idIncExp) {
    console.log('Initial load with idIncExp:', this.idIncExp);
    this.getData();
    this.getBillingManagementInfo().then(() => {
      console.log('Billing info loaded');
    });
  }

  this.route.data.subscribe((data) => {
    console.log('Route data changed:', data);
    this.showform = data['showform'];
    if (this.gridApi) {
      console.log('Updating grid columns');
      this.gridApi.updateGridOptions({ columnDefs: this.colMaster });
    }
  });
}


 constructor() {
  // Añadir binding de métodos
  this.onSelectedRow = this.onSelectedRow.bind(this);
  this.onSelectionChanged = this.onSelectionChanged.bind(this);
  this.onCellValueChanged = this.onCellValueChanged.bind(this);
  this.onGridReady = this.onGridReady.bind(this);
  effect(() => {
    const newId = this.signalsService.getIdIncomeAndExpense()();
    console.log('Signal changed - new idIncExp:', newId);
    
    this.idIncExp = newId;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    
    this.getMeasures();
    
    if (this.idIncExp) {
      console.log('Loading data for idIncExp:', this.idIncExp);
      this.getData();
    } else {
      // Clear data when no income/expense is selected
      this.rowData = [];
      this.subtotal = 0;
      this.iva2 = 0;
      this.total = 0;
    }
  }, { allowSignalWrites: true });
}

  showform : string = '';
  id: number;
  idRoot: number;
  ivaPercent: number = 0;
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

  // SAT Catalogs for new columns
  objetosImpuesto: any[] = [];
  productosServiciosSAT: any[] = [];

  // Para obtener el dato de la facturacion y el porcentaje
  async getBillingManagementInfo() {
    if (!this.idRoot) return;
    
    this.administrationService.getBillingManagementInfo(this.idRoot).subscribe(
      (data: any) => {
        this.ivaPercent = data && data[0]?.iIva ? data[0].iIva : 0;
      },
      (error) => {
        console.error('Error al obtener la información de gestión de facturación:', error);
        this.ivaPercent = 0;
      }
    );
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
        headerHeight: 30,
        rowHeight: 30,
        getRowClass: (params) => {
          if (params.node.isSelected()) {
            return 'selected-row';
          }
          return '';
        },
        onRowClicked: (event) => {
          event.node.setSelected(true);
        },
        onRowSelected: (event) => {
          if (event.node.isSelected() && this.gridApi) {
            this.gridApi.forEachNode((node) => {
              if (node.id !== event.node.id) {
                node.setSelected(false);
              }
            });
          }
        },
        // Asegurar que los callbacks estén correctamente referenciados
        onSelectionChanged: (event) => this.onSelectionChanged(event),
        onCellValueChanged: (event) => this.onCellValueChanged(event),
        onGridReady: (event) => this.onGridReady(event)
};


  components =
    {
      multiLineEditorComponent: MultiLineEditorComponent,
      searchableSelect: SearchableSelectComponent
    }

    get colMaster(): ColDef[] {
      const columns: ColDef[] = [
        {
          field: 'dateExpend', 
          headerName: 'Fecha',  
          type: 'date', 
          editable: true,   
          flex: 3,
          valueFormatter: (params) => {
            if (!params.value) return '';
            const date = new Date(params.value);
            return date.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit'
            });
          }
        },
     
        { field: 'quantity', headerName: 'Cantidad', type: 'number', editable: true, flex: 3 },
        
        // Conditional columns
           { field: 'description', headerName: 'Concepto', type: 'text', editable: true, hide: this.showform === 'EXPEND', flex: 4 },
          {
            field: 'unit', 
            headerName: 'Unidad', 
            type: 'text', 
            editable: true, 
            flex: 4,hide: this.showform === 'EXPEND', 
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: this.measures.map(measure => measure.description),
            }
          },

        {
          field: 'claveUnidad',
          headerName: 'Clave Unidad',
          editable: true,
          flex: 3,
          cellEditor: 'searchableSelect',
          cellEditorParams: {
            searchFunction: (searchText: string) => {
              return this.administrationService.getUnitsSATSearch(searchText);
            },
            displayField: 'texto',
            valueField: 'idClavesUnidades',
            placeholder: 'Buscar unidad...'
          },
          valueFormatter: (params) => {
            if (!params.value) return '';
            // For display, we might need to store the text separately or fetch it
            return params.value; // This will show the idClavesUnidades
          }
        },

        {
          field: 'objetoImp',
          headerName: 'Objeto Impuesto',
          editable: true,
          flex: 3,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: (params) => ({
            values: this.objetosImpuesto.map(obj => obj.objeto)
          }),
          valueFormatter: (params) => {
            if (!params.value) return '';
            const found = this.objetosImpuesto.find(obj => obj.objeto === params.value);
            return found ? `${found.objeto} - ${found.descripcion}` : params.value;
          }
        },

        {
          field: 'claveProdServ',
          headerName: 'Producto/Servicio',
          editable: true,
          flex: 4,
          cellEditor: 'searchableSelect',
          cellEditorParams: {
            searchFunction: (searchText: string) => {
              return this.administrationService.getProductsAndServicesSAT(searchText);
            },
            displayField: 'texto',
            valueField: 'idProductosServicios',
            placeholder: 'Buscar producto o servicio...'
          },
          valueFormatter: (params) => {
            if (!params.value) return '';
            // For display, we might need to store the text separately or fetch it
            return params.value; // This will show the idProductosServicios
          }
        },

        {
          field: 'price',
          headerName: 'Precio',
          type: 'number',
          editable: true,
          flex: 4,
          valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
        },
        {
          field: 'total',
          headerName: 'Subtotal',
          type: 'number',
          editable: false,
          flex: 4,
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
        { field: 'comment', headerName: 'Comentario', type: 'text', editable: true, flex: 4, cellEditor: 'multiLineEditorComponent' }
      ];
    
      return columns;
    }


  async getData() {
    if (!this.idIncExp) {
      this.rowData = [];
      this.subtotal = 0;
      this.iva2 = 0;
      this.total = 0;
      return;
    }
    
   // console.log('ID en concepts:', this.idIncExp);
    this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(this.idIncExp).subscribe(
      (data: any) => {
        this.rowData = data || [];
        this.subtotal = this.calculateSubtotal();
        this.iva2 = this.calculateTotalIVA();
        this.total = this.subtotal + this.iva2;
      },
      (error) => {
        console.error('Error al obtener conceptos:', error);
        this.rowData = [];
        this.subtotal = 0;
        this.iva2 = 0;
        this.total = 0;
      }
    );
  }

  async getMeasures() {
    if (!this.idRoot) {
      this.measures = [];
      return;
    }

    this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe(
      (data: any) => {
        this.measures = data || [];
        console.log('Medidas:', this.measures);
      },
      (error) => {
        console.error('Error al obtener medidas:', error);
        this.measures = [];
      }
    )
  }

  async loadSATCatalogs() {
    // Load SAT catalogs for the new columns (only objetosImpuesto since units are loaded dynamically)
    this.administrationService.getObjetosImpuesto().subscribe({
      next: (data: any[]) => {
        this.objetosImpuesto = data || [];
        console.log('Objetos Impuesto loaded:', this.objetosImpuesto.length);
      },
      error: (err) => {
        console.error('Error loading Objetos Impuesto:', err);
        this.objetosImpuesto = [];
      }
    });
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

  onCellValueChanged = (event: any) => {
  event.data.__modified = true;
  this.notSavedChanges = true;

  if (['iva', 'quantity', 'price'].includes(event.colDef.field)) {
    const rowData = event.data;

    if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
      rowData.total = Number(rowData.quantity || 0) * Number(rowData.price || 0);
    }

    rowData.iva2 = rowData.iva ? rowData.total * (this.ivaPercent / 100) : 0;

    // Verificar que gridApi existe antes de usarlo
    if (this.gridApi) {
      this.gridApi.applyTransactionAsync({
        update: [rowData]
      });
    }

    // Recalcular totales de forma segura
    this.recalculateTotals();
  }
}


    private recalculateTotals() {
      try {
        this.subtotal = this.calculateSubtotal();
        this.iva2 = this.calculateTotalIVA();
        this.total = this.subtotal + this.iva2;
      } catch (error) {
        console.error('Error recalculando totales:', error);
        // Valores por defecto en caso de error
        this.subtotal = 0;
        this.iva2 = 0;
        this.total = 0;
      }
    }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.updateGridOptions({ columnDefs: this.colMaster }); 
  }

  addRow() {
    if (!this.idIncExp) {
      alerts.basicAlert(
        'Añadir concepto',
        'Debe seleccionar un registro de gasto para añadir conceptos.',
        'warning'
      );
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idIncorExp: this.idIncExp,
      typeExpense: 'NA',
      idExpense: 0,
      dateExpend: new Date(),
      description: '',
      quantity: 1,
      unit: '',
      claveUnidad: '',
      objetoImp: '02', // Default to "Sí objeto de impuesto"
      claveProdServ: '',
      price: 0,
      total: 0,
      iva: false,
      iva2: 0,
      comment: '',
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
    if (!this.idIncExp) {
      alerts.basicAlert(
        'Guardar cambios',
        'No hay un registro de gasto seleccionado.',
        'warning'
      );
      return;
    }

    const isValid = this.rowData.every((item) => item.quantity);
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
    if (!this.idIncExp) {
      alerts.basicAlert(
        'Eliminar entrada',
        'No hay un registro de gasto seleccionado.',
        'warning'
      );
      return;
    }

    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
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


