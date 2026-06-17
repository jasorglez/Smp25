import { Component, effect, HostListener, inject, OnInit, ChangeDetectorRef} from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { PayrollService } from 'app/services/payroll.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import DetailClock2Component from "../detail-clock-2/detail-clock-2.component";
import SpecialExtraHoursMasterComponent from "../special-extra-hours-master/special-extra-hours-master.component";
import { AdministrationService } from 'app/services/administration.service';
import { HRService } from 'app/services/hr.service';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'app/services/auth.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-master-clock',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, SpecialExtraHoursMasterComponent, DetailClock2Component],
  templateUrl: './master-clock.component.html',
  styleUrl: './master-clock.component.scss'
})
export default class MasterClockComponent implements OnInit {
  //  private administrationService = inject(AdministrationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private payrollService = inject(PayrollService);
  private hrService = inject(HRService);
  private signalsService = inject(SignalsService);
  private route = inject(ActivatedRoute);
  private administrationService = inject(AdministrationService);
  private fb = inject(FormBuilder);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  ngOnInit() {
    // Initialization handled by the constructor effect
  }

  constructor() {

    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
      if (this.signalsService.getRefreshClock()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.setRefreshClock(false); // Resetear la señal después de actualizar
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
      const newBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idBranch = newBranch;
      if (newBranch !== this.lastBuiltBranch) {
        this.lastBuiltBranch = newBranch;
        this.buildColMaster();
      }
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
  openPanel: 'details' | 'special' | null = null;
  branchs: any[] = [];
  Typecop: any[] = [];
  hrData: any = {};
  ultimaFecha: any;
  idDia: any;
  hoy = new Date();

  dias: any[] = [
    { id: 1, dia: 'Lunes' },
    { id: 2, dia: 'Martes' },
    { id: 3, dia: 'Miércoles' },
    { id: 4, dia: 'Jueves' },
    { id: 5, dia: 'Viernes' },
    { id: 6, dia: 'Sábado' },
    { id: 7, dia: 'Domingo' },

  ]

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idBranch: number;
  private lastBuiltBranch: number | null = null;
  selectedTab: string = 'customers-payments';
  colMaster: ColDef[] = [];
  idEmployee: number;
  fechaInicio: any;
  fechaFin: any;


  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';
  public autoGroupColumnDef: ColDef = {
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {
      suppressCount: true, // Esto quita el conteo automático de AG-Grid
      innerRenderer: (params: any) => {
        if (params.node.group) {
          // Para el nivel de sucursal, mostrar el conteo de bloques
          if (params.node.level === 0) {
            const childCount = params.node.childrenAfterFilter?.length || 0;
            return `${params.node.key} (${childCount})`;
          }
          return params.node.key;
        }
        return params.value;
      }
    }
  };
  public groupDisplayType: any = 'multipleColumns';
  public groupDefaultExpanded = 1;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };


  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      if (!event.node.group) {
        event.node.setSelected(true);
      }
    },
    onRowSelected: (event) => {
      if (event.node.group) return;
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (!node.group && node.id !== event.node.id) {
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
    onRowGroupOpened: (params) => {
      setTimeout(() => params.api.autoSizeAllColumns(), 50);
    },
  };



  private buildColMaster(): void {
    this.colMaster = [
      // Nivel 1: Sucursal
      {
        field: 'nameBranch',
        headerName: 'Sucursal',
        hide: true,//this.idBranch >= 0, // Ocultar si no es la sucursal principal
        rowGroup: this.idBranch <= 0,
        showRowGroup: false
      },
      // Nivel 2: Bloque con fechas
      {
        field: 'idBlockPeriod',
        headerName: 'ID Bloque',
        hide: true,
        filter: 'agTextColumnFilter'
      },
      {
        headerName: 'Bloque (con fechas)',
        colId: 'blockWithDates', // personalizado
        rowGroup: true,
        showRowGroup: false,
        hide: true,
        valueGetter: (params) => {
          if (params.data) {
            const startDate = new Date(params.data.periodStart).toLocaleDateString('es-ES');
            const endDate = new Date(params.data.periodEnd).toLocaleDateString('es-ES');
            return `${params.data.idBlockPeriod} (${startDate} - ${endDate})`;
          }
          return 'Sin bloque';
        }
      },
      // Nivel 3: Empleado
      {
        field: 'nameEmployee',
        headerName: 'Empleado',
        hide: true,
      },
      {
        field: 'idEmployee',
        headerName: 'Id',
        editable: false,
        hide: true,
        filter: 'agNumberColumnFilter',
        filterParams: {
          filterOptions: ['equals'],
        },
      },
      {
        field: 'periodStart',
        headerName: 'Fecha inicio',
        editable: false,
        hide: true,
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
        hide: true,
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
        hide: !this.authService.hasSubDetailedPermission('hr', 'clock', 'MaeChe_Ajus'),
        cellStyle: (params) => {
          if (params.value !== null && params.value !== undefined && params.value !== '') {
            return { backgroundColor: '#d4edda', cursor: 'pointer' };
          }
          return { cursor: 'pointer' };
        },
        editable: false,
        valueFormatter: (params) => {
          const value = params.value;
          if (typeof value !== 'number' || isNaN(value)) return '';
          const hours = Math.floor(value);
          const minutes = Math.round((value - hours) * 60);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        },
        onCellClicked: (params: any) => this.togglePanel(params, 'details'),
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
        colId: 'specialExtraHours',
        hide: !this.authService.hasSubDetailedPermission('hr', 'clock', 'MaeChe_HorEsp'),
        cellStyle: (params) => {
          if (params.data && params.data.specialExtraStatus === 1) {
            return { backgroundColor: '#fff3cd', cursor: 'pointer' }; // Requires attention (Yellow)
          }
          return { backgroundColor: '#d4edda', cursor: 'pointer' }; // No attention required (Green)
        },
        editable: false,
        onCellClicked: (params: any) => this.togglePanel(params, 'special'),
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
    ];
    this.cdr.detectChanges();
  }

  private getExpandedGroupKeys(): Set<string> {
    const keys = new Set<string>();
    this.gridApi?.forEachNode(node => {
      if (node.group && node.expanded && node.key != null) {
        keys.add(node.key);
      }
    });
    return keys;
  }

  private restoreGroupExpansion(keys: Set<string>) {
    if (!keys.size) return;
    this.gridApi?.forEachNode(node => {
      if (node.group && node.key != null && keys.has(node.key)) {
        node.setExpanded(true);
      }
    });
  }

  async obtenerDatos(fechaInicio: string = '', fechaFin: string = '') {
    return new Promise((resolve) => {
      const expandedKeys = this.getExpandedGroupKeys();
      this.payrollService.getMasterClock(this.idBranch, fechaInicio, fechaFin).subscribe(
        (data: any) => {
          this.rowData = data;
          this.cdr.detectChanges();
          this.trackingService.addLog(this.trackingService.getnameComp(), 'Get Registro en Maestro de Checador', 'Menu Maestro de Checador', this.trackingService.getEmail());
          setTimeout(() => {
            this.restoreGroupExpansion(expandedKeys);
            this.gridApi?.autoSizeAllColumns();
          }, 50);
          resolve(true);
        },
        (error) => {
          console.error('Error fetching data:', error);
          this.rowData = [];
          this.cdr.detectChanges();
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
      this.signalsService.setDetailClockForEmployee(this.selectedRowData.idEmployee, this.selectedRowData.periodStart.split('T')[0], this.selectedRowData.periodEnd.split('T')[0]);
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


  private togglePanel(params: any, panel: 'details' | 'special'): void {
    if (!params.data) return;

    this.selectedRowData = params.data;

    if (this.openPanel === panel) {
      this.closePanel();
    } else {
      if (this.openPanel === null) this.adjustGridSize();
      this.showDetailsTab = panel === 'details';
      this.showSpecialTimesTab = panel === 'special';
      this.openPanel = panel;
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    this.signalsService.setProviderOrCustomer(this.type);
    const selectedRowData = event.data;
    if (!selectedRowData) return;

    const filterModel = {
      idEmployee: { type: 'equals', filter: selectedRowData.idEmployee },
      idBlockPeriod: { type: 'equals', filter: selectedRowData.idBlockPeriod }
    };
    this.gridApi.setFilterModel(filterModel);
    this.gridApi.onFilterChanged();
    this.selectedRowData = selectedRowData;
  }

  private closePanel(): void {
    this.gridHeight = '80vh';
    this.showDetailsTab = false;
    this.showSpecialTimesTab = false;
    this.openPanel = null;
    this.gridApi.setFilterModel(null);
    this.gridApi.onFilterChanged();
  }

  resetGridSize() {
    this.closePanel();
  }

  adjustGridSize() {
    this.gridHeight = '25vh';
  }

  async Consultar() {
    /*if (this.selectFechas.valid) {
      const datos = this.selectFechas.value;
      this.fechaInicio = datos.fechaInicio;
      this.fechaFin = datos.fechaFin;
      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    } else {
      alerts.basicAlert('Error', 'Por favor selecciona ambas fechas', 'error');
    }*/
    await this.getNextPayrollStartDate();
    // Determinar fechaInicio
    if (this.idBranch < 0) {
      const primerDiaDelMes = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);
      this.fechaInicio = primerDiaDelMes.toISOString().split('T')[0];
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
    if (this.idBranch > 0) {
      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    } else {
      this.obtenerDatos();
    }

  
    this.cdr.detectChanges();}
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
  
    this.cdr.detectChanges();}

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
