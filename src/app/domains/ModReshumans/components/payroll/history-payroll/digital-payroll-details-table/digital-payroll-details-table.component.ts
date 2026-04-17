import { Component, input, output, signal , effect, inject } from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import {
  HistoryPayrollResponse,
  PayrollEmployee,
} from 'app/interface/history-payroll.interface';

import { AgGridModule } from 'ag-grid-angular';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';
import { FormsModule } from '@angular/forms';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { IdBlockPeriodsService } from 'app/services/IdBlockPeriods.service';

@Component({
  selector: 'digital-payroll-details-table',
  standalone: true,
  imports: [AgGridModule, RouterModule, DomainsModule, FormsModule],
  templateUrl: './digital-payroll-details-table.component.html',
})
export class DigitalPayrollDetailsTableComponent {
  gridHeight = input.required<string>();

  public showPayrollDetailTab = output<boolean>();

  public rowData = input.required<HistoryPayrollResponse[]>();

  private signalsService = inject(SignalsService);

  private branchesService = inject(BranchsService);

  private idBlockPeriodsService = inject(IdBlockPeriodsService);

  public employeeData = output<PayrollEmployee[]>();

  public components: { [p: string]: any };

  // Referencia al grid API
  private gridApi: GridApi;

  private mostrarGridDetalle = signal<boolean>(false);

  private datosDetalle = signal<Array<{ detalleId: number; info: string }>>([]);

  private aggregatingRecord = signal(false);

  private selectedRowData = signal(null);

  public notSavedChanges = signal(false);

  private branchs = signal([]);

  private id = signal('');

  private idRoot: number = 0;

  public rowSelection: 'single' | 'multiple' = 'single';

  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  
  blockPeriods: any[] = [];
  private idBranch: number = 0;

  get colMaster(): ColDef[] {
    return [
     /*  {
        field: 'payrollId',
        headerName: 'Id Nomina',
        width: 170,
        cellEditor: 'agSelectCellEditor',
      }, */
      // {
      //   field: 'idBranch',
      //   headerName: 'Sucursal',
      //   width: 170,
      //   cellEditor: 'agSelectCellEditor',
      // },
      /*{
        field: 'company',
        headerName: 'Compañia',
        filter: true,
        width: 200,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
      },*/
      {
        field: 'idBranch',
        headerName: 'Sucursal',
        width: 170,
        cellEditor: 'agSelectCellEditor',
        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundBranch = this.branchs
            ? this.branchs().find((item) => item.id === params.value)
            : null;

          return foundBranch ? foundBranch.name : params.value;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idBranch) return '';
          const branch = this.branchs()?.find(b => b.id === params.data.idBranch);
          return branch ? branch.name : '';
        },
      },
      {
        field: 'idBlockPeriod',
        headerName: 'Bloque del Periodo',
        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundblockPeriod = this.blockPeriods
            ? this.blockPeriods.find((item) => item.id === params.value)
            : null;

          return foundblockPeriod ? foundblockPeriod.blockPeriodCode : params.value;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idBlockPeriod) return '';
          const blockPeriod = this.blockPeriods?.find(b => b.id === params.data.idBlockPeriod);
          return blockPeriod ? blockPeriod.blockPeriodCode : '';
        },
        width: 140,
      },
      {
        field: 'period',
        headerName: 'Periodo',
        width: 260,
      },
      {
        field: 'createdAt',
        headerName: 'Creado',
        width: 260,
        valueFormatter: (params) => {
          const date = new Date(params.value);
          const formattedDate = date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          const formattedTime = date.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          return `${formattedDate} ${formattedTime}`;
        }
      },
      {
        field: 'startDate',
        headerName: 'Fecha de inicio',
        filter: 'agDateColumnFilter',
        width: 140,
        valueFormatter: (params) => {
          const date = new Date(params.value);
          return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
        }
      },

      {
        field: 'endDate',
        headerName: 'Fecha final',
        filter: 'agDateColumnFilter',
        width: 160,
        valueFormatter: (params) => {
          const date = new Date(params.value);
          return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
        }
      },
      {
        field: 'fiscalYear',
        headerName: 'Año fiscal',
        filter: true,
        width: 160,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
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
  constructor() {
      effect(() => {
        this.idRoot = this.signalsService.getRootSelectedBySidebar()();
        this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
        this.obtenerBranchs();
        this.obtenerBlockPariod(this.idBranch);
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
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };

  activatePayrollDetailTab() {
    this.showPayrollDetailTab.emit(true);
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
    // Reset to default height
    this.showPayrollDetailTab.emit(false); // Ocultar la pestaña de detalle
    if (this.gridApi) {
      this.gridApi.setFilterModel(null); // Limpiar filtros
      this.gridApi.onFilterChanged(); // Aplicar cambios
    }
  }

  onCellDoubleClicked(event: CellDoubleClickedEvent): void {
    //alert("Holaaaaaaaaaaaaa");
    const selectRowData = event.data; // Obtener los datos de la fila seleccionada

    if (this.aggregatingRecord) this.activatePayrollDetailTab();

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData.set(selectRowData);
  }

  onSelectionChanged(event: any) {
    // console.log('onSelectionChanged', event);
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData.set(selectedNodes[0].data);
    } else {
      this.selectedRowData.set(null);
    }
  }
    obtenerBlockPariod(idBranch: any){
    this.idBlockPeriodsService.getIdBlockPeriods(idBranch).subscribe(
      (data: any) => {
        this.blockPeriods = data;
      },
      (error) => console.error('Error fetching data:', error)
    )
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

  onSelectedRow(event: any) {
    // console.log('onSelectedRow', event);
    this.employeeData.emit(event.data.payrollEmployees);
    this.id.set(event.data.id);
  }
}
