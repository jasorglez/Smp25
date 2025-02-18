import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { ModalService } from 'app/services/modal.service';
import { SignalsService } from 'app/services/signals.service';

import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-employeesxloans',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.scss'
})
export class EmployeesxLoansComponent {
  autoGroupColumnDef: any;
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  public groupDefaultExpanded = 0;
 

  ngOnInit() {
    
  }

  constructor() {
     effect(() => {
       this.idEmployee = this.signalsService.getIdEmployee()();
       this.loadData();
      }
    );
  }

  loadData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return; // Or handle the case where the ID is not yet available.
    }
    console.log("Loading data for employee ID:", this.idEmployee); // Use console.log for debugging

    this.employeesxloansService.getLoansByEmployee(this.idEmployee, 'PRESTAMO').subscribe(
      (maestroRowData: any[]) => {
        if (!maestroRowData || maestroRowData.length === 0) {
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        } else {
          // Process the data here
          console.log("Loans data:", maestroRowData); // Log the data to the console
        }
      },
      (error) => {
        console.error("Error loading loans data:", error); // Handle errors
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error'); // Show an error message to the user
      }
    );
  }
  

  // Datos y columnas para el grid maestro
  
  maestroColumnDefs: ColDef[] = [
    
    { headerName: 'Prestamo', field: 'nombre' },
    { headerName: 'Fecha', field: 'date' },
    { headerName: 'Total', field: 'monto' },
    // Agrega más columnas según sea necesario
  ];

  // Datos y columnas para el grid detalle

  detalleColumnDefs: ColDef[] = [    
    { headerName: 'Fecha', field: 'date' },
    { headerName: 'Abono', field: 'total' },
    { headerName: 'Comentario', field: 'descripcion' },
    // Agrega más columnas según sea necesario
  ];

  // Referencias a los grids
  private maestroGridApi: any;
  private detalleGridApi: any;

  // Método para agregar una fila al grid maestro
  addRow(type: string) {
    if (type === 'maestro') {
      const newRow = { id: this.maestroRowData.length + 1, nombre: `Nombre ${this.maestroRowData.length + 1}` };
      this.maestroRowData = [...this.maestroRowData, newRow];
    }
  }

  // Método cuando el grid maestro está listo
  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
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
  
  get colMaster(): ColDef[] {
    return [
      {
        field: 'date',
        headerName: 'Fecha abono',
        editable: true,
        flex: 1,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString('es-MX'); // Formato dd/mm/yy automático
        }
      },
      {
        field: 'type',
        headerName: 'Tipo',
        editable: true,
        flex: 1,
      },
      
      {
        field: 'loan', headerName: 'Préstamo', enableRowGroup: true, editable: (params) => params.data.__isNew, flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return `$${params.value.toFixed(2)}`;
        }
      },

      {
        field: 'payment', headerName: 'Abono', editable: (params) => params.data.__isNew, flex: 1,
        cellDataType: 'number',
        cellEditorParams: {
          min: 0
        },
        valueFormatter: (params) => {
          return `$${params.value.toFixed(2)}` ;
        }
      },
      {
        field: 'total', headerName: 'Saldo', editable: false, flex: 1,
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
