import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { PayrollService } from 'app/services/payroll.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import DetailClock2Component from "../detail-clock-2/detail-clock-2.component";
import { SpecialExtraHoursComponent } from "./special-extra-hours/special-extra-hours.component";
import { AdministrationService } from 'app/services/administration.service';
import { HRService } from 'app/services/hr.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-master-clock',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, SpecialExtraHoursComponent, DetailClock2Component],
  templateUrl: './master-clock.component.html',
  styleUrl: './master-clock.component.scss'
})
export default class MasterClockComponent implements OnInit {
  //  private administrationService = inject(AdministrationService);
  private payrollService = inject(PayrollService);
  private hrService = inject(HRService);
  private signalsService = inject(SignalsService);
  private route = inject(ActivatedRoute);
  private administrationService = inject(AdministrationService);
  private fb = inject(FormBuilder);

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.obtenerConfig();
    this.Consultar();
    this.obtenerDatos();
  }

  constructor() {

    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    });
    
    this.selectFechas = this.fb.group({
      fechaInicio: [this.fechaInicio, Validators.required],
      fechaFin: [this.fechaFin, Validators.required]
    });
    this.selectFechas.valueChanges.subscribe((values) => {
      if (this.selectFechas.valid) {
        this.fechaInicio = values.fechaInicio;
        this.fechaFin = values.fechaFin;
        this.obtenerDatos(this.fechaInicio, this.fechaFin);
      }
    });

   effect(async () => {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    await this.obtenerConfig();
    await this.Consultar();
    });

  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  selectFechas: FormGroup;
  type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
  gridHeight: string = '75vh';
  showDetailsTab: boolean = false;
  showSpecialTimesTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  hrData: any = {};
  ultimaFecha: any;
  idDia: any ;
  hoy = new Date();

   dias:any[] = [
    {id: 1 , dia: 'Lunes'},
    {id: 2 , dia: 'Martes'},
    {id: 3 , dia: 'Miércoles'},
    {id: 4 , dia: 'Jueves'},
    {id: 5 , dia: 'Viernes'},
    {id: 6 , dia: 'Sábado'},
    {id: 7 , dia: 'Domingo'},

  ]

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idBranch: number;
  selectedTab: string = 'customers-payments';
  idEmployee: number;
  fechaInicio: any;
  fechaFin: any;


  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };


  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los grupos
    rowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          requestAnimationFrame(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };



  get colMaster(): ColDef[] {
    return [
      {
        field: 'idEmployee',
        headerName: 'Id',
        editable: false,
        width: 110,
        hide: true,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'nameBranch',
        headerName: 'Nombre sucursal',
        editable: false,
        hide: true,//this.idBranch >= 0, // Ocultar si no es la sucursal principal
        rowGroup: this.idBranch <= 0
      },
      {
        field: 'periodStart',
        headerName: 'Fecha inicio',
        editable: false,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).replace(/\//g, '-');
        }
      },
      {
        field: 'periodEnd',
        headerName: 'Fecha fin',
        editable: false,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).replace(/\//g, '-');
        }
      },
      {
        field: 'nameEmployee',
        headerName: 'Nombre Empleado',
        editable: false
      },
      {
        field: 'baseHours',
        headerName: 'Horas base',
        editable: false
      },
      {
        field: 'hoursWithMinutes',
        headerName: 'Horas ajustadas',
        editable: false,
        cellStyle: (params) => {
          if (params.value == 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'extraHoursWithMinutes',
        headerName: 'Horas extra',
        editable: false
      },
      {
        field: 'specialExtraHours',
        headerName: 'Horas extra especiales',
        editable: false
      },
      {
        field: 'delays',
        headerName: 'Retardos',
        editable: false,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'pendingOuts',
        headerName: 'Salidas pendientes',
        editable: false,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'holidays',
        headerName: 'Festivos',
        editable: false
      },
      {
        field: 'absences',
        headerName: 'Faltas',
        editable: false,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
      {
        field: 'discountHoursWithMinutes',
        headerName: 'Horas descontadas',
        editable: false,
        cellStyle: (params) => {
          if (params.value > 0) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        }
      },
    ]

  }

  async obtenerDatos(fechaInicio: string = '', fechaFin: string = '') {
    return new Promise((resolve) => {
      //console.log(this.idBranch, fechaInicio, fechaFin)
      this.payrollService.getMasterClock(this.idBranch, fechaInicio, fechaFin).subscribe(
        (data: any) => {
          this.rowData = [];
          this.rowData = data;
          //console.log(data)

          // Actualizar el grid y esperar a que termine
          this.gridApi.setGridOption('rowData', this.rowData);

          // Esperar a que el grid se actualice y luego ajustar las columnas
          setTimeout(() => {
            if (this.gridApi) {
              // Obtener todas las columnas y ajustarlas automáticamente
              const allColumnIds = this.gridApi.getColumns().map(column => column.getColId());
              this.gridApi.autoSizeColumns(allColumnIds);
              // Forzar un redraw del grid para asegurar que los cambios se apliquen
              this.gridApi.redrawRows();
              resolve(true);
            }
          }, 100);
        },
        (error) => {
          console.error('Error fetching data:', error);
          resolve(false);
        }
      );
    });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      //console.log('ID del empleado seleccionado:', this.selectedRowData.idEmployee, this.selectedRowData.periodStart.split('T')[0], this.selectedRowData.periodEnd.split('T')[0]);
      this.signalsService.setDetailClockForEmployee(this.selectedRowData.idEmployee, this.selectedRowData.periodStart.split('T')[0], this.selectedRowData.periodEnd.split('T')[0] );
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    this.lastEditedRowId = event.data.id; // Guardar el ID de la última fila editada
  }


  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId = typeof node.data.id === 'string' ? parseInt(node.data.id) : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }


  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    this.signalsService.setProviderOrCustomer(this.type);
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.idEmployee; // Obtener el ID del registro

    // Filtrar el grid para mostrar solo el registro con el ID seleccionado
    const filterModel = {
      idEmployee: {
        type: 'equals',
        filter: selectedId,
      },
    };

    this.gridApi.setFilterModel(filterModel);
    this.gridApi.onFilterChanged();

    // Manejar casos especiales para pestañas
    if (colId === 'specialExtraHours') {
      if (!this.isOpen) {
        await this.adjustGridSize();
        this.showSpecialTimesTab = true;
        this.isOpen = true;
      } else {
        await this.resetGridSize();
        this.showSpecialTimesTab = false;
        this.isOpen = false;
      }
    } else {
      await this.activateDetailsTab();
    }
    this.selectedRowData = selectedRowData; // Guardar los datos seleccionados
  }

  async activateDetailsTab() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.showDetailsTab = true;
      this.isOpen = true;
    }
    else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showDetailsTab = false;
    this.showSpecialTimesTab = false;
    this.gridApi.setFilterModel(null);
    this.gridApi.onFilterChanged();
  }

  adjustGridSize() {
    this.gridHeight = '15vh'; // Adjust as needed
  }

  async Consultar() {
    /*if (this.selectFechas.valid) {
      const datos = this.selectFechas.value;
      this.fechaInicio = datos.fechaInicio;
      this.fechaFin = datos.fechaFin;
      console.log(this.fechaInicio, this.fechaFin)

      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    } else {
      alerts.basicAlert('Error', 'Por favor selecciona ambas fechas', 'error');
    }*/
   await this.getNextPayrollStartDate();
    // Determinar fechaInicio
    if (this.idBranch < 0) {
      const primerDiaDelMes = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);
      this.fechaInicio = primerDiaDelMes.toISOString().split('T')[0];
      console.log(this.fechaInicio);
    } else if (this.ultimaFecha instanceof Date) {
      const siguienteDia = new Date(this.ultimaFecha);
      siguienteDia.setDate(siguienteDia.getDate() + 1);
      this.fechaInicio = siguienteDia.toISOString().split('T')[0];
    } else {
      const diaEncontrado = this.dias.find(d => d.dia === this.hrData.startDay);
      this.idDia = diaEncontrado ? diaEncontrado.id : 1;
      const diaObjetivo = this.idDia % 7;
      this.hoy.setHours(0, 0, 0, 0);
      const fecha = new Date(this.hoy);
      const diaActual = fecha.getDay();
      const diferencia = (diaActual - diaObjetivo + 7) % 7;
      fecha.setDate(fecha.getDate() - diferencia);
      this.fechaInicio = fecha.toISOString().split('T')[0];
    }

    // Determinar fechaFin
    if (this.idBranch < 0) {
      const ultimoDiaDelMes = new Date(this.hoy.getFullYear(), this.hoy.getMonth() + 1, 0);
      this.fechaFin = ultimoDiaDelMes.toISOString().split('T')[0];
    } else if (this.hrData?.payrollPeriod > 0) {
      const inicio = new Date(this.fechaInicio);
      inicio.setDate(inicio.getDate() + this.hrData.payrollPeriod - 1);
      this.fechaFin = inicio.toISOString().split('T')[0];
    } else {
      this.fechaFin = this.hoy.toISOString().split('T')[0];
    }

    // Actualizar formulario reactivo
    this.selectFechas.patchValue(
      {
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin,
      },
      { emitEvent: false }
    );
    if(this.idBranch > 0){
      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    }else{
      this.obtenerDatos();
    }
    
  }
  async getNextPayrollStartDate(): Promise<void> {
      if (this.idBranch > 0) {
        try {
          const data: { endDate: string }[] = await firstValueFrom(
            this.administrationService.getNormalPayrolls(this.idBranch)
          );
  
          if (data.length > 0) {
            this.ultimaFecha = undefined;//= new Date(data[0].endDate);
          } else {
            this.ultimaFecha = undefined;
          }
        } catch (error) {
          console.error('Error fetching payroll data:', error);
        }
      }
    }

   obtenerConfig(): Promise<void> {
    return new Promise((resolve) => {
      this.hrService.getHRManagementData(this.idBranch).subscribe({
        next: (data: any) => {
          this.hrData = data[0] || {};
          resolve();
        },
        error: () => {
          this.hrData = {};
          this.idDia = 6;
          resolve();
        }
      });
    });
  }
}
