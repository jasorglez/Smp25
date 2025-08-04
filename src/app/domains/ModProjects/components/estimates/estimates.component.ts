import { Component, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstimatesService } from 'app/services/estimates.service';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { GeneratorsComponent } from './generators.component';
import { PdfEstimatesService } from 'app/services/pdf-estimates.service';

@Component({
  selector: 'app-estimates',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, GeneratorsComponent],
  templateUrl: './estimates.component.html'
})
export class EstimatesComponent {

  private estimatesService = inject(EstimatesService);
  private signalsService = inject(SignalsService);
  private pdfEstimatesService = inject(PdfEstimatesService);

  constructor() {
    effect(() => {
      this.contract = this.signalsService.getContractSelectedBySidebar()();
      this.obtenerDatos();
    });
  }

  ngOnInit() {
    this.obtenerDatos();
  }

  components = {
    autocompleteEditor: AutocompleteEditorComponent
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
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private contract = this.signalsService.getContractSelectedBySidebar()();
  
  // Propiedades para el comportamiento del toggle
  gridHeight: string = '500px';
  showGeneratorsTab: boolean = false;
  isOpen: boolean = false;

  obtenerDatos() {
    this.estimatesService
      .getEstimates(this.contract)
      .subscribe((data: any) => {
        this.rowData = data;
        console.log(data);
      }, (error) => {
        console.error(error); // Manejo de error
        this.rowData = []; // Retornar un array vacío en caso de error
      });
  }


  // 1. Modificar gridOptions para el comportamiento deseado
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
  suppressClickEdit: true, // Fuerza doble click para editar
  rowClass: (params) => params.node.isSelected() ? 'selected-row' : '',
  
  onRowClicked: (event) => {
    // Selección con un click
    event.node.setSelected(true);
    
    // Mostrar generadores (sin marcar cambios)
    this.selectedRowData = event.data;
    this.id = event.data.id;
    
    // Filtrado para mostrar solo la fila seleccionada
    this.gridApi.setFilterModel({
      id: { type: 'equals', filter: this.id }
    });
    this.gridApi.onFilterChanged();
    
    // Activar generadores
    this.activateGeneratorsTab();
  },

  onRowSelected: (event) => {
    // Deseleccionar otras filas
    if (event.node.isSelected()) {
      this.gridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  }
};


  get columnDefs(): ColDef[] {
    return [
      {
        field: 'number',
        headerName: 'Estimación',
        editable: true,
        flex: 1.4
      },

      {
        field: 'typeMoney',
        headerName: 'Tipo Moneda',
        editable: true,
        flex: 1.6,      
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['MX', 'USD'],
        }

      },

      {
        field: 'dateStart',
        headerName: 'Fecha inicial',
        editable: true,
        flex: 1.5,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'dateEnd',
        headerName: 'Fecha final',
        editable: true,
        flex: 1.4,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'dias',
        headerName: 'Días',
        editable: false,
        flex: 1
      },
      {
        field: 'amountMX',
        headerName: 'MXN',
        cellDataType: 'number',
        editable: true,
        flex: 1.3,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'amountDLL',
        headerName: 'DLL',
        cellDataType: 'number',
        editable: true,
        flex: 1,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
        }
      },
      {
        field: 'acumulateMX',
        headerName: 'Acumulado MXN',
        cellDataType: 'number',
        editable: false,
        flex: 1.9,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'acumulateDLL',
        headerName: 'Acumulado DLL',
        cellDataType: 'number',
        editable: false,
        flex: 1.8,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
        }
      },
      {
        field: 'type',
        headerName: 'Tipo',
        editable: true,
        flex: 1.3,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['NORMAL', 'ADICIONAL', 'EXTRAORDIN'],
        }
      },
      {
        field: 'authorizeUser',
        headerName: 'Autoriza',
        editable: false,
        flex: 1.6
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        editable: true,
        flex: 2
      }
    ];
  }

  onSelectedRow(event: any) {
    console.log(event)
    this.id = event.data.id;
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
      number: '',
      idContract: this.contract,
      typeMoney: 'MX',
      dateStart: '',
      dateEnd: '',
      amountMX: 0,
      amountDLL: 0,
      acumulateMX: 0,
      acumulateDLL: 0,
      type: '',
      authorizeUser: localStorage.getItem('mail'),
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
    const firstEditableCol = this.columnDefs.find(col => col.editable);
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
    const isValid = this.rowData.every((item) => item.number);
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
      console.log('Datos limpiados para el servidor:', cleanedData);
      // Asignar el ID temporal al campo idEstimacion
      return this.estimatesService.addEstimate(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.estimatesService.updateEstimate(row.id, cleanedData);
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
    this.estimatesService.deleteEstimate(id).pipe(
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



  async activateGeneratorsTab() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.showGeneratorsTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '250px'; // Reducir tamaño del grid
  }

  resetGridSize() {
    this.gridHeight = '500px'; // Restaurar tamaño original
    this.showGeneratorsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  generateSamplePdf() {
    const sampleData = this.pdfEstimatesService.createSampleEstimate();
    this.pdfEstimatesService.generateEstimatePdf(sampleData);
  }

  downloadSamplePdf() {
    const sampleData = this.pdfEstimatesService.createSampleEstimate();
    this.pdfEstimatesService.downloadEstimatePdf(sampleData, 'Estimacion_Plaza_Corala_13R.pdf');
  }

}
