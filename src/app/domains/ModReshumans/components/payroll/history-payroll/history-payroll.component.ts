import { Component, effect, inject, signal } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { HistoryPayrollService } from 'app/services/history-payroll.service';
import {
  HistoryPayrollResponse,
  PayrollEmployee,
} from '../../../../../interface/history-payroll.interface';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { BranchsService } from 'app/services/branchs.service';

import { DomainsModule } from 'app/domains/domainsmodule';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShowEmployeesTableComponent } from './employees-table/employees-table.component';

@Component({
  selector: 'app-history-payroll',
  standalone: true,
  imports: [
    AgGridModule,
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule,
    ShowEmployeesTableComponent,
  ],
  templateUrl: './history-payroll.component.html',
})
export class HistoryPayrollComponent {
  //MIO
  private historyPayrollService = inject(HistoryPayrollService);

  //

  private signalsService = inject(SignalsService);

  private branchesService = inject(BranchsService);

  // private authService = inject(AuthService);

  // private administrationService = inject(AdministrationService);

  private idBranch: number = 0;

  private idRoot: number = 0;

  public gridHeight = signal('80vh');

  public showPayrollDetailTab = signal(false);

  public rowData: HistoryPayrollResponse[];

  public employeeData = signal<PayrollEmployee[]>([]);

  public components: { [p: string]: any };

  public idEmployee = signal<number | null>(null);

  public showLoansTab: any;

  public showSavingsTab: any;

  // Referencia al grid API
  private gridApi: GridApi;

  private branchs = signal([]);

  private mostrarGridDetalle = signal<boolean>(false);

  private datosDetalle = signal<Array<{ detalleId: number; info: string }>>([]);

  private aggregatingRecord = signal(false);

  private selectedRowData = signal(null);

  public notSavedChanges = signal(false);

  // Datos para la tabla
  // Estado de carga
  public isLoading = signal(false);

  private id = signal('');

  public rowSelection: 'single' | 'multiple' = 'single';

  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.rowData = [];

      this.obtenerDatos();
      this.obtenerBranchs();
    });
  }

  // MIO
  obtenerDatos() {
    // console.log('id branch en obtener datos: ', this.idBranch);

    if (this.idBranch === null || this.idBranch > 0) {
      return this.getHistoryPayrollByBranch(this.idBranch);
    }

    return this.getHistoryPayrollWithoutBranch();
  }

  getHistoryPayrollWithoutBranch() {
    this.historyPayrollService.getALlHistoryPayroll().subscribe(
      (data) => {
        this.rowData = data;
        this.isLoading.set(false);
        // console.log('Datos extraidos de history-payroll', data);
      },
      (error) => {
        this.rowData = [];
      }
    );
  }

  getHistoryPayrollByBranch(idBranch: number) {
    this.historyPayrollService.getHistoryPayrollsByBranch(idBranch).subscribe(
      (data) => {
        this.rowData = data;
        this.isLoading.set(false);
        // console.log('Datos extraidos de history-payroll', data);
      },
      (error) => {
        this.rowData = [];
      }
    );
  }

  get colMaster(): ColDef[] {
    return [
      {
        field: 'payrollId',
        headerName: 'Id Nomina',
        width: 170,
        cellEditor: 'agSelectCellEditor',
      },
      // {
      //   field: 'idBranch',
      //   headerName: 'Sucursal',
      //   width: 170,
      //   cellEditor: 'agSelectCellEditor',
      // },
      {
        field: 'company',
        headerName: 'Compañia',
        width: 200,
      },
      {
        field: 'period',
        headerName: 'Periodo',
        width: 260,
      },
      {
        field: 'startDate',
        headerName: 'Fecha de inicio',
        width: 140,
      },

      {
        field: 'endDate',
        headerName: 'Fecha final',
        width: 160,
      },
      {
        field: 'fiscalYear',
        headerName: 'Año fiscal',
        width: 160,
      },
      // {
      //   field: 'createdAt',
      //   headerName: 'Creado',
      //   width: 100,
      // },
      {
        field: 'active',
        headerName: 'Vigente',
        width: 130,
        editable: false,
        // onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
      },
    ];
  }

  onCellValueChanged(event: any) {
    if (
      event.data.endDate &&
      event.data.startDate &&
      event.data.endDate <= event.data.startDate
    ) {
      alerts.basicAlert(
        'Error',
        'La fecha de fin no puede ser menor o igual a la fecha de inicio.',
        'error'
      );
      event.data.endDate = '';
      event.data.startDate = '';
      return;
    }
    event.data.__modified = true;
    this.notSavedChanges.set(true);
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
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };

  activatePayrollDetailTab() {
    this.showPayrollDetailTab.set(true);
    this.adjustGridSize();
  }

  adjustGridSize() {
    this.gridHeight.set('20vh'); // Adjust as needed
  }

  mostrarDetalle(params: any) {
    this.mostrarGridDetalle.set(true);
    this.datosDetalle.set([
      { detalleId: 1, info: `Detalle de ${params.data.nombre}` },
      { detalleId: 2, info: `Más info de ${params.data.nombre}` },
    ]);
  }

  cerrarDetalle() {
    this.mostrarGridDetalle.set(false);
  }

  resetGridSize() {
    this.gridHeight.set('80vh'); // Reset to default height
    this.showPayrollDetailTab.set(false); // Ocultar la pestaña de detalle
    if (this.gridApi) {
      this.gridApi.setFilterModel(null); // Limpiar filtros
      this.gridApi.onFilterChanged(); // Aplicar cambios
    }
  }

  onCellDoubleClicked(event: CellDoubleClickedEvent): void {
    //alert("Holaaaaaaaaaaaaa");
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada

    const selectedId = selectedRowData.id; // Obtener el ID del registro
    this.signalsService.setNormalPayrollId(selectedId);

    if (colId === 'NomDigital') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    if (this.aggregatingRecord) this.activatePayrollDetailTab();

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData.set(selectedRowData);
  }

  onSelectionChanged(event: any) {
    // console.log('onSelectionChanged', event);
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  // Definición de columnas para AG Grid
  columnDefs: ColDef[] = [
    {
      field: 'payrollId',
      headerName: 'Id Payroll',
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      field: 'idBranch',
      headerName: 'ID Branch',
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      field: 'company',
      headerName: 'Compañia',
      sortable: true,
      filter: true,
      width: 90,
    },
    {
      field: 'period',
      headerName: 'Periodo',
      sortable: true,
      filter: true,
    },
    {
      field: 'startDate',
      headerName: 'Fecha de inicio',
      sortable: true,
      filter: true,
    },
    {
      field: 'endDate',
      headerName: 'Fecha Final',
      sortable: true,
      filter: true,
    },
    {
      field: 'fiscalYear',
      headerName: 'Año Fiscal',
      sortable: true,
      filter: true,
    },
    {
      field: 'createdAt',
      headerName: 'Creado',
      sortable: true,
      filter: true,
    },
    {
      field: 'active',
      headerName: 'Activo',
      sortable: true,
      filter: true,
    },
  ];

  // Configuración por defecto para todas las columnas
  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
    filter: true,
  };

  // Evento cuando el grid está listo
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    // Ajustar columnas al tamaño óptimo
    // this.gridApi.sizeColumnsToFit();
  }

  // Método para refrescar los datos
  refreshData(): void {
    this.aggregatingRecord.set(false);
    this.obtenerDatos();
    this.resetGridSize();
  }

  onSelectedRow(event: any) {
    // console.log('onSelectedRow', event);
    this.employeeData.set(event.data.payrollEmployees);
    this.id.set(event.data.id);
  }

  // ESTA SI ME SIRVE
  deleteEntry() {
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
    console.log('Datos de la nomina a eliminar:', selectedData);

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar nómina',
        '¿Está seguro que desea eliminar esta nómina?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          // this.payrollService.deletePayroll(id).pipe(
          //     catchError((error) => {
          //       alerts.basicAlert(
          //         'Eliminar nómina',
          //         'Error al eliminar la nómina.',
          //         'error'
          //       );
          //       console.error(error);
          //       return EMPTY;
          //     })
          //   )
          //   .subscribe(() => {
          //     alerts.basicAlert(
          //       'Nómina eliminada',
          //       'La nómina se eliminó correctamente',
          //       'success'
          //     );
          //     this.loadPayrollHistory();
          //     this.notSavedChanges.set(false);
          //     this.selectedRowData.set(null);
          //   });
        }
      });
  }

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs.set(data);
        // console.log('this.branchs ', this.branchs);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
}
