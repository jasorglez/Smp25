import { Component, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { SignalsService } from 'app/services/signals.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-savings-registry',
  standalone: true,
  imports: [AgGridModule],
  templateUrl: './savings-registry.component.html',
  styleUrl: './savings-registry.component.scss',
})
export class SavingsRegistryComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: (params) => {
      // Permitir edición solo si la fila es nueva
      return params.data?.__isNew === true;
    },
  };

  maestroRowData: any[] = [];
  gridApi: any;
  idLoan: number = null;
  nameLoan: string = null;
  id: number;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  private maestroGridApi: GridApi;
  idBranch: number;

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.loadData();
    });
  }

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.loadData();
  }

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    /*rowClassRules: {
      "row-green": params => params.data?.remain != 0
    },*/
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onMaestroRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onMaestroRowSelected: (event) => {
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

  loadData() {
    this.employeesxloansService.getSavingsRegistry(this.idBranch).subscribe(
      (maestroRowData: any[]) => {
        this.maestroRowData = maestroRowData;
      },
      (error) => {
        console.error('Error loading loans data:', error);
      }
    );
  }

  get maestroColumnDefs(): ColDef[] {
    return [
      {
        headerName: 'Fecha',
        field: 'date',
        filter: 'agTextColumnFilter',
        valueGetter: (params) =>
          params.data.date ? new Date(params.data.date) : null,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            return `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
          }
          return '';
        },
        flex: 1
      },
    {
      headerName: 'Nombre',
      field: 'employeeName',
      flex: 2,
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Movimiento',
      field: 'name',
      flex: 2,
      filter: 'agTextColumnFilter'
    },
    
    {
      headerName: 'Abono',
      field: 'monto',
      filter: 'agTextColumnFilter',
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
      editable: false,
    },
    {
      headerName: 'Retirado',
      field: 'payments',
      filter: 'agTextColumnFilter',
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
      editable: false,
    },
    {
      headerName: 'Saldo restante',
      field: 'remain',
      filter: 'agTextColumnFilter',
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
      editable: false,
    },
  ]
  };

  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
  }
}
