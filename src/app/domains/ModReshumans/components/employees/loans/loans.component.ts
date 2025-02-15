import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { ModalService } from 'app/services/modal.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-employeesxloans',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.scss'
})
export class EmployeesxLoansComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  ngOnInit() {
    this.idEmployee = this.signalsService.getIdEmployee()();
    this.getLoansByEmployee();
  }

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.getLoansByEmployee();
    }
  );
  }

  components = {
    multiLineEditor: MultiLineEditorComponent
  };

  id: number;
  idEmployee: number;
  rowData: any[] = [];
  newlyAddedRows: string[] = []; // IDs de filas recién añadidas
  notSavedChanges: boolean = false;

  // Variables de control del grid
  selectedRowData: any = null;  // Fila seleccionada actualmente
  tempIdCounter: number = 0;    // Contador para IDs temporales
  private gridApi: GridApi;     // API del grid
  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1
  };
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  getLoansByEmployee() {
    this.employeesxloansService.getLoansByEmployee(this.idEmployee).subscribe((data: any) => {
      this.rowData = data;
    },
      (error) => console.error('Error fetching data:', error)
    );
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

    // Calcular el total automáticamente
    if (event.data.loan !== undefined && event.data.payment !== undefined) {
      event.data.total = event.data.loan - event.data.payment;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  addRow() {
    // Verificar si ya hay una fila nueva
    if (this.rowData.some(row => row.__isNew)) {
      alerts.basicAlert(
        'Advertencia',
        'Ya hay una fila nueva. No se puede añadir otra.',
        'warning'
      );
      return; // Salir del método si ya hay una fila nueva
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idEmployee: this.idEmployee,
      date: '',
      loan: this.rowData.length > 0 ? this.rowData[this.rowData.length - 1].total : 0,
      payment: 0,
      total: 0,
      comments: '',
      active: true,
      __isNew: true,
    };

    // Actualizar el estado
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption("rowData", this.rowData);
  }

  async saveChanges() {
    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.addLoanData(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.updateLoanData(row.id, cleanedData);
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
      this.getLoansByEmployee(); // Refrescar los datos
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
    this.getLoansByEmployee(); // Refrescar los datos
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

  // Column Definitions: Defines the columns to be displayed.
  gridOptions = {
    headerHeight: 30,
    rowHeight: 30
  }
  
  get colMaster(): ColDef[] {
    return [
      {
        field: 'date', headerName: 'Fecha abono', editable: true, flex: 1,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'loan', headerName: 'Préstamo', editable: (params) => params.data.__isNew, flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        }
      },
      {
        field: 'payment', headerName: 'Abono', editable: (params) => params.data.__isNew, flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        }
      },
      {
        field: 'total', headerName: 'Total', editable: false, flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '';
        }
      },
      {
        field: 'comments', headerName: 'Comentarios', editable: false, flex: 2,
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
        }
      }
    ]
  };

}
