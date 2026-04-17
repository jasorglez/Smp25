import { alerts } from 'app/helpers/alerts';
import { RouterModule } from '@angular/router';
import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CurrencyPipe, formatCurrency } from '@angular/common';
import * as bootstrap from 'bootstrap';
import {
  PayrollService,
  PayrollData,
  EmployeePayroll,
} from 'app/services/payroll.service';

import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';

import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { firstValueFrom } from 'rxjs';
import { AdministrationService } from 'app/services/administration.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { DetailpayrollComponent } from '../detailpayroll/detailpayroll.component';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { BranchsService } from 'app/services/branchs.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HRService } from 'app/services/hr.service';
import { IdBlockPeriodsService } from 'app/services/IdBlockPeriods.service';

@Component({
  selector: 'app-master-payroll',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    FormsModule,
    DetailpayrollComponent,
  ],
  templateUrl: './masterpayroll.component.html',
  styleUrl: './masterpayroll.component.scss',
})
export class MasterPayrollComponent implements OnInit {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  dias: any[] = [
    { id: 1, dia: 'Lunes' },
    { id: 2, dia: 'Martes' },
    { id: 3, dia: 'Miércoles' },
    { id: 4, dia: 'Jueves' },
    { id: 5, dia: 'Viernes' },
    { id: 6, dia: 'Sábado' },
    { id: 7, dia: 'Domingo' },

  ]

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.signalsService.getRefreshNomina() == true) {
        //this.aggregatingRecord = false;
        this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        //this.resetGridSize();
        this.signalsService.resetRefreshNomina(); // Resetear la señal después de actualizar
      }
      if (this.idBranch == null) {
        this.rowData = [];
        alerts.basicAlert(
          'Empleados',
          'Debe elegir una sucursal primero.',
          'error'
        );
      } else {
        this.obtenerDatos();
        this.obtenerBranchs();
        this.obtenerConfig();
        this.CalculoDeDias();
        this.obtenerBlockPariod(this.idBranch);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.obtenerDatos();
  }
  onGridReady2(params: GridReadyEvent): void {
    this.gridApi2 = params.api;
  }
  async CalculoDeDias() {
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

  obtenerDatos() {
    this.administrationService.getNormalPayrolls(this.idBranch).subscribe(
      (data: any) => {
        this.rowData = data;
      },
      (error) => {
        this.rowData = [];
      }
    );
  }

  obtenerExistenciaDP(startDate, endDate, idBranch) {
    this.administrationService
      .getDPPayrollsExistence(startDate, endDate, idBranch)
      .subscribe({
        next: (payrollId) => {
          if (payrollId !== 0) {
          } else {
          }
        },
        error: (error) => {
          console.error('Error al obtener el PayrollId:', error);
        },
      });
  }

  private signalsService = inject(SignalsService);
  authService = inject(AuthService);
  private branchesService = inject(BranchsService);
  private administrationService = inject(AdministrationService);
  private payrollService = inject(PayrollService);
  private hrService = inject(HRService);
  private idBlockPeriodsService = inject(IdBlockPeriodsService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }
  selectFechas: FormGroup;
  mostrarGridDetalle = false;
  datosDetalle: any = [];
  notSavedChanges: boolean = false;
  private tempIdCounter: number = 0;
  id: string;
  gridApi2!: GridApi;
  idBranch: number;
  payrolls: any [];
  selectedPayrollId: number = 0;
  idSelected: number = 0;
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  private modalServiceTable = inject(ModalService);
  selectedRowData: any = null;
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  showPayrollDetailTab: boolean = false;
  gridHeight: string = '80vh';
  DPAvailable: boolean = true;
  aggregatingRecord: boolean = false;
  initialDate: string;
  endingDate: string;
  branchs: any[] = [];
  blockPeriods: any[] = [];
  idRoot: number;
  hrData: any = {};
  ultimaFecha: any;
  idDia: any;
  hoy = new Date();
  fechaInicio: any;
  fechaFin: any;


  activatePayrollDetailTab() {
    this.showPayrollDetailTab = true;
    this.adjustGridSize();
  }

  adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  mostrarDetalle(params: any) {
    this.mostrarGridDetalle = true;
    this.datosDetalle = [
      { detalleId: 1, info: `Detalle de ${params.data.nombre}` },
      { detalleId: 2, info: `Más info de ${params.data.nombre}` },
    ];
  }

  cerrarDetalle() {
    this.mostrarGridDetalle = false;
  }
  private validateRequiredField(value: any): any {
    return {
      backgroundColor: !value ? '#fff3cd' : 'transparent',
      border: !value ? '2px solid #ff9966' : 'none',
    };
  }

  private _colMaster: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        headerName: 'Sucursal',
        field: 'idBranch',
        headerClass: 'required-header',
        pinned: 'left',
        hide:
          this.authService.hasDetailedPermission(
            'principal',
            'see-all-branches'
          ) || this.signalsService.getemailChoose() === 'root@beapp.com.mx'
            ? false
            : true,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','payroll', 'update');
        },
        filter: true,
        width: 170,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        cellEditor: 'agSelectCellEditor',

        cellEditorParams: (params) => {
          return {
            values: this.branchs
              ? this.branchs
                  .slice() // Creamos una copia para no modificar el array original
                  .sort((a, b) => a.name.localeCompare(b.name)) // Ordenamos por nombre
                  .map((item) => item.id) // Extraemos solo los IDs
              : [],
          };
        },

        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundBranch = this.branchs
            ? this.branchs.find((item) => item.id === params.value)
            : null;

          return foundBranch ? foundBranch.name : params.value;
        },

        valueGetter: (params) => {
          if (!params.data || !params.data.idBranch) return '';
          const branch = this.branchs?.find(b => b.id === params.data.idBranch);
          return branch ? branch.name : '';
        },
      },
      {
        field: 'idBlockPeriod',
        headerName: 'Bloque del Periodo',
        headerClass: 'required-header',
        pinned: 'left',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','payroll', 'update');
        },
        suppressMovable: true,
        width: 120,
        filter: 'agSetColumnFilter',
        filterParams: {
          //excelMode: 'mac',
          defaultToNothingSelected: true,
        },
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.id) || [],
          filterKey: 'idBlockPeriod',
          placeholder: 'Buscar empleado...',
          minLength: 1,
        },
       valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }
        
          const normalizedValue = rawValue.trim().toUpperCase();
        
          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }
        
          // Busca el blockPeriodCode en la lista
          const matched = this.blockPeriods?.find(
            (b) => b.blockPeriodCode.toUpperCase() === normalizedValue
          );
        
          if (!matched) {
            alerts.basicAlert('No encontrado', 'El periodo no existe.', 'error');
            return false;
          }
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.idBlockPeriod === matched.id
          );
        
          if (duplicateExists) {
            alerts.basicAlert(
              'Duplicado',
              'Ya existe un registro con ese periodo.',
              'error'
            );
            return false;
          }
          
            params.data[params.colDef.field] = matched.id;
            params.data['startDate'] = matched.startDate;
            params.data['endDate'] = matched.endDate;
          return true;
        },
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
      },
      {
        headerName: 'Fecha Inicio',
        field: 'startDate',
        filter: 'agDateColumnFilter',

        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','payroll', 'update');
        },
      
        cellEditor: 'agDateCellEditor',
      
        valueGetter: (params) => {
          return this.parseLocalDate(params.data.startDate);
        },
      
        valueFormatter: (params) => {
          if (params.value) {
            const date = this.parseLocalDate(params.value);
            this.initialDate = `${('0' + date.getDate()).slice(-2)}-${(
              '0' + (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
            return this.initialDate;
          }
          return '';
        },
      
        valueSetter: (params) => {
          if (!params.newValue) {
            alerts.basicAlert(
              'Campo requerido',
              'La fecha de inicio es requerida.',
              'error'
            );
            return false;
          }
        
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex && row.name === params.newValue
          );
        
          if (duplicateExists) {
            alerts.basicAlert(
              'Fecha duplicada',
              'Ya existe una fecha.',
              'error'
            );
            return false;
          }
        
          params.data[params.colDef.field] = params.newValue;
          return true;
        },
      
        width: 170,
      },
      {
        headerName: 'Fecha Fin',
        field: 'endDate',
        filter: 'agDateColumnFilter',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'employees','payroll', 'update');
        },
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          return this.parseLocalDate(params.data.endDate);
        },
      
        valueFormatter: (params) => {
          if (params.value) {
            const date = this.parseLocalDate(params.value);
            this.initialDate = `${('0' + date.getDate()).slice(-2)}-${(
              '0' + (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
            return this.initialDate;
          }
          return '';
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            alerts.basicAlert(
              'Campo requerido',
              'la fecha de fin es requerida.',
              'error'
            );
            return false;
          }
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Fecha duplicada',
              'Ya existe una fecha.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        },
        width: 170,
      },

      
      {
        field: 'totalBaseWorkingHours',
        headerName: 'Total Horas Trabajadas',
        width: 170,
        cellStyle: { backgroundColor: '#d4edda' },
        valueFormatter: (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) return '';
      
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
      
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      },
      },

      {
        field: 'totalBaseExtraHours',
        headerName: 'Total Horas Extra',
        width: 170,
        cellEditorParams: {
          maxLength: 15,
        },
        valueFormatter: (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) return '';
      
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
      
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        },
      },
      {
        field: 'totalBaseExtraHoursSpecial',
        headerName: 'Total Horas Extra Especial',
        width: 170,
        cellEditorParams: {
          maxLength: 15,
        },
        valueFormatter: (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) return '';
      
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
      
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        },
      },
      { 
        field: 'totalAbsence',
        headerName: 'Total de faltas',
        width: 140,
      },
       { 
        field: 'totalDelays',
        headerName: 'Total de pendientes',
        width: 140,
        cellStyle: (params) => {
          if (params.value !== 0 && params.value != null) {
            return { backgroundColor: '#fbcccc' }; // Fondo rojo
          }
          return null; // Sin estilos
        }
      },
       { 
        field: 'totalBaseSalary',
        headerName: 'Total Salarios Base',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },
       { 
        field: 'totalExtraSalary',
        headerName: 'Total Salarios Extra',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },
       { 
        field: 'totalSpecialSalary',
        headerName: 'Total Salario Extra Especial',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },
      { 
        field: 'totalBonos',
        headerName: 'Total Bonos',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },
      { field: 'totalSubtotal',
        headerName: 'Total Sueldo Bruto',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },
      { field: 'totalSavings',
        headerName: 'Total Ahorros',
        width: 140,
        valueFormatter: params =>  this.formatCurrencyMx(params.value)
      },
      { field: 'totalDescuentos',
        headerName: 'Total Descuento Real',
        width: 160,
        valueFormatter: params => this.formatCurrencyMx(params.value)
      },
      { field: 'totalDigitalPayment',
        headerName: 'Total Pago Digital',
        width: 160,
        valueFormatter: params => this.formatCurrencyMx(params.value)
      },
      { field: 'total',
        headerName: 'Total Efectivo',
        width: 100,
        valueFormatter: params => this.formatCurrencyMx(params.value)
      },
      {
        headerName: 'Nóm Digital',
        field: 'nomDigital',
        width: 130,
        valueFormatter: params => this.formatCurrencyMx(params.value),
        //cellRenderer: 'excelDownloadCellRenderer',

        cellRenderer: (params) => {
          const button = document.createElement('button');

          this.DPAvailable = params.data.nomDigital; // Verificar si la nómina digital está disponible

          button.innerHTML = this.DPAvailable ? '✅' : '❌'; // Palomita o cruz roja
          button.style.cursor = 'pointer';
          button.style.border = 'none';
          button.style.background = 'transparent';
          button.style.fontSize = '12px';

          button.addEventListener('click', () => {
            //alert(`Estado en la fila: row: ${params.node.rowIndex} -- Id: ${params.data.id} -- FechaInicial: ${params.data.startDate} -- FechaFinal: ${params.data.endDate}
            //  -- IdBranch Tabla: ${params.data.idBranch} -- ${this.DPAvailable ? 'Disponible' : 'No disponible'}`);
            this.onCheckClick(params);
            // Aquí puedes ejecutar cualquier otra acción, como actualizar el estado
          });
          return button;
        },
        onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
      },
      {
        headerName: 'Cerrada',
        field: 'closed',
        width: 130,
        editable: (params) => !params.data.closed,
        cellRenderer: (params) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = params.value;
          checkbox.disabled = params.data.closed;
          
          checkbox.addEventListener('change', (event) => {
            params.setValue((event.target as HTMLInputElement).checked);
          });
          
          return checkbox;
        }
      }
    ];

    return this._colMaster;
  }

    parseLocalDate(input: string | Date): Date | null {
    if (!input) return null;

    if (input instanceof Date) return input;

    // Detectar formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
      const [day, month, year] = input.split('/');
      return new Date(Number(year), Number(month) - 1, Number(day)); // local
    }

    // Detectar formato ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
      const [year, month, day] = input.split('T')[0].split('-');
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Fallback: intentar convertir como Date, pero puede fallar
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }



  onCheckClick(params: any): void {
    if (!params.data) return;

    const payrollId = params.data.id;
    const startDate = params.data.startDate ? new Date(params.data.startDate) : null;
    const endDate = params.data.endDate ? new Date(params.data.endDate) : null;
    //const idBranch = this.idBranch;
    const idBranch = params.data.idBranch;

    if (!startDate || !endDate) {
      console.error('Fechas no válidas');
      alert('No se pudo descargar el archivo: fechas no válidas');
      return;
    }

    // Llamar al servicio para descargar el Excel
    this.payrollService
      .downloadPayrollExcel(idBranch, startDate, endDate)
      .subscribe({
        next: (blob: Blob) => {
          // Crear un nombre de archivo descriptivo
          const fileName = `Nomina_${
            new Date(startDate).toISOString().split('T')[0]
          }_${new Date(endDate).toISOString().split('T')[0]}.xlsx`;

          // Crear URL del objeto y generar la descarga
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();

          // Liberar el objeto URL
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Error al descargar el archivo:', error);
          alert(
            'No se pudo descargar el archivo. Por favor, inténtelo de nuevo.'
          );
        },
      });
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
    
    if (event.colDef.field === 'closed') {
      event.data.__modified = true;
      this.notSavedChanges = true;
      return;
    }
    
    if (event.colDef.field === 'idBranch') {
    const selectedBranchId = event.newValue;
    const rowData = event.data;
    
    const branch = this.branchs.find(b => b.name === selectedBranchId);
    const idBranch = branch ? branch.id : null;

    // Buscar bloque relacionado a la sucursal
    const relatedBlock = this.blockPeriods.find(
      (block) => block.idBranch === idBranch
    );
    if (relatedBlock) {
      rowData.idBlockPeriod = relatedBlock.id;
      rowData.startDate = relatedBlock.startDate;
      rowData.endDate = relatedBlock.endDate;

      // Si usas AgGrid con edición manual, forzar refresco
      if (this.gridApi) {
        this.gridApi.refreshCells({
          rowNodes: [event.node],
          force: true,
          columns: ['idBlockPeriod', 'startDate', 'endDate'],
        });
      }
      event.data.__modified = true;
      this.notSavedChanges = true;
    } else {
      alerts.basicAlert(
        'Sin periodo',
        'No se encontró un bloque asociado a esta sucursal.',
        'warning'
      );
      this.obtenerDatos();
      this.notSavedChanges = false;
      event.data.__modified = false;
    }
  }
   // event.data.__modified = true;
   // this.notSavedChanges = true;
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


  onCellDoubleClicked(event: CellDoubleClickedEvent): void {
    //alert("Holaaaaaaaaaaaaa");
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    this.signalsService.setFechaNomina(selectedRowData.startDate, selectedRowData.endDate);
    this.signalsService.setClosedPayroll(!selectedRowData.closed);

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
    if (colId === 'Sucursal'){
      alert(selectedRowData.idBranch)
    }

    if (!this.aggregatingRecord) this.activatePayrollDetailTab();

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }

  


  addRow() {
  const selectedBranchId = this.idBranch > 0 ? this.idBranch : null;

  // Buscar si hay un bloque asociado a la sucursal
  const relatedBlock = this.blockPeriods.find(
    (block) => block.idBranch === selectedBranchId
  );

  const newItem = {
    idBranch: this.idBranch >=0 ? this.idBranch : selectedBranchId,
    idBlockPeriod: relatedBlock ? relatedBlock.id : null,
    startDate: relatedBlock ? relatedBlock.startDate : '',
    endDate: relatedBlock ? relatedBlock.endDate : '',
    closed: false,
    active: true,
    __isNew: true,
  };

  this.rowData = [newItem, ...this.rowData];
  this.notSavedChanges = true;
  this.aggregatingRecord = true;

  const newRowIndex = this.rowData.findIndex((row) => newItem);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colMaster.find((col) => col.editable);
    const firstEditableColKey = firstEditableCol
      ? firstEditableCol.field
      : null;
  if(this.idBranch <= 0){
  setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: 'idBranch', // Editar la primera columna editable
        });
      }
    }, 50);}
  this.notSavedChanges = true;
  this.aggregatingRecord = true;
}

formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
}



  async saveChanges() {
    let hasErrors = false; // 🔴 Controla si hubo errores en alguna petición
  const isValid = this.rowData.every(
    (item) => item.startDate && item.endDate && item.idBranch && item.startDate <= item.endDate
  );

  if (!isValid) {
    alerts.basicAlert(
      'Añadir entrada',
      'Debe llenar correctamente las fechas de inicio y fin de la semana laborada antes de guardar.',
      'error'
    );
    return;
  }

  const newRows = this.rowData.filter((row) => row.__isNew);
  const modifiedRows = this.rowData.filter(
    (row) => row.__modified && !row.__isNew
  );

  // Procesa filas nuevas de forma asíncrona
  const addObservables: any[] = [];
  for (const row of newRows) {
    const cleanedData = this.cleanDataForServer(row);
    const PayrollId = await this.obtenerPayrollsByRange(
      row.startDate,
      row.endDate,
      row.idBranch
    );
    cleanedData.payrollId = PayrollId;
    addObservables.push(
      this.administrationService.addNormalPayroll(cleanedData).pipe(
        tap((response) => {
          alerts.basicAlert('Datos guardados', response.message, 'success');
          this.notSavedChanges = false;
          this.aggregatingRecord = false;
          this.obtenerDatos();
          this.resetGridSize();
        }),
        catchError((error) => {
          const errorMessage =
            error?.error?.message ||
            'Ocurrió un error al guardar los datos. Intente nuevamente.';
          alerts.basicAlert('Error', errorMessage, 'error');
          this.notSavedChanges = false;
          this.aggregatingRecord = false;
          this.obtenerDatos();
          this.resetGridSize();
          return EMPTY;
        })
      )
    );
  }

  const updateObservables = modifiedRows.map((row) => {
    return this.administrationService.updateNormalPayroll(row.id).pipe(
    catchError((error) => {
      hasErrors = true;
      const mensajeError = typeof error.error === 'string'
        ? error.error
        : error?.error?.message || 'Error al actualizar los datos.';

      alerts.basicAlert('Error', mensajeError, 'error');

      return EMPTY; // Permite que las demás actualizaciones continúen
    })
    );
  });

  try {
    const responses = await lastValueFrom(
      concat(...addObservables, ...updateObservables).pipe(toArray())
    );
     if (!hasErrors) {
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
    }
    this.notSavedChanges = false;
    this.aggregatingRecord = false;
    this.obtenerDatos();
    this.resetGridSize();
  } catch (error) {
    console.error(error);
    alerts.basicAlert(
      'Error',
      'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
      'error'
    );
  }
}


  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  // Datos para la tabla
  rowData: any;

  // Estado de carga
  isLoading = false;

  // Referencia al grid API
  private gridApi: any;
  private valorObtenido: any;

  // Definición de columnas para AG Grid
  columnDefs: ColDef[] = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      field: 'codigoEmpleado',
      headerName: 'Código',
      sortable: true,
      filter: true,
      resizable: true,
    },
    {
      field: 'diasTrabajados',
      headerName: 'Días',
      sortable: true,
      filter: true,
      width: 90,
    },
    {
      field: 'salarioDiario',
      headerName: 'Sal. Diario',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'salarioDiarioIntegrado',
      headerName: 'SDI',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'sueldos',
      headerName: 'Sueldos',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'totalPercepciones',
      headerName: 'Tot. Percepciones',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'percepcionesGravadas',
      headerName: 'Perc. Gravadas',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'impuestoArt96',
      headerName: 'Imp. Art.96',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'ISPT',
      headerName: 'ISPT',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'IMSS',
      headerName: 'IMSS',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
    },
    {
      field: 'neto',
      headerName: 'Neto',
      sortable: true,
      filter: true,
      valueFormatter: this.currencyFormatter,
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

  // Formateo de valores monetarios
  currencyFormatter(params: any) {
    if (typeof params.value !== 'number') {
      return params.value;
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(params.value);
  }

  // Evento cuando el grid está listo
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    // Ajustar columnas al tamaño óptimo
    this.gridApi.sizeColumnsToFit();
  }

  // Método para exportar a Excel
  exportToExcel(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `Nominas_${new Date().toISOString().split('T')[0]}.xlsx`,
      });
    }
  }

  // Método para refrescar los datos
  refreshData(): void {
    this.aggregatingRecord = false;
    this.notSavedChanges = false;
    this.obtenerDatos();
    this.resetGridSize();
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
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

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showPayrollDetailTab = false; // Ocultar la pestaña de detalle
    if (this.gridApi) {
      this.gridApi.setFilterModel(null); // Limpiar filtros
      this.gridApi.onFilterChanged(); // Aplicar cambios
    }
  }

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
          this.payrollService
            .deletePayroll(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar nómina',
                  'Error al eliminar la nómina.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Nómina eliminada',
                'La nómina se eliminó correctamente',
                'success'
              );
              this.obtenerDatos();
              this.gridHeight = '80vh'; // Reset to default height
              this.showPayrollDetailTab = false; // Ocultar la pestaña de detalle
              if (this.gridApi) {
                this.gridApi.setFilterModel(null); // Limpiar filtros
                this.gridApi.onFilterChanged(); // Aplicar cambios
              }
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

   onPayrollChange(event: Event): void {
  }
  selectionPayroll(): void {
    if (this.selectedPayrollId !== null) {
    } else {
    }
  }

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
        //console.log('this.branchs ' + this.branchs);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

 async obtenerPayrollsByRange(startDate: Date, endDate: Date, idBranch: number): Promise<number> {
  return new Promise((resolve, reject) => {
    this.payrollService.getPayrollsByRange(startDate, endDate, idBranch).subscribe(
      (data: any) => {
        this.payrolls = data;
        this.payrolls = this.payrolls.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt)
        }));

        if (this.payrolls.length > 1) {
        // Si hay más de una nómina, mostramos el modal para que el usuario seleccione
        const modal = new bootstrap.Modal(document.getElementById('payrolls')!);
        modal.show();

        // Aquí esperamos que el usuario seleccione una nómina
        const onSelect = () => {
// Debug
          if (this.selectedPayrollId !== null) {
            resolve(this.selectedPayrollId); // Resolvemos con el ID seleccionado
            modal.hide(); // Cerrar el modal
          } else {
            alert('Por favor, selecciona una nómina.');
            reject('No se seleccionó ninguna nómina.');
          }
        };
      
        // 🔽 Aquí pegas el nuevo código
        const selectButton = document.getElementById('selectPayrollButton');
        if (selectButton) {
          selectButton.addEventListener('click', onSelect, { once: true }); // evita múltiples listeners
        } else {
          console.error('Botón de selección no encontrado en el DOM');
          reject('Error al mostrar el modal');
        }
      
        // ⏱️ Opcional: timeout para evitar quedar colgado si no se hace nada
        setTimeout(() => {
          reject('Timeout esperando selección de nómina');
        }, 30000); // 30 segundos de espera
      } else if (this.payrolls.length === 1) {
                // Si solo hay una nómina, la devolvemos directamente
                resolve(this.payrolls[0].payrollId);
              } else {
                // Si no hay nóminas, devolvemos 0
                resolve(0);
              }
            },
            (error) => {
              console.error('Error fetching data:', error);
              reject(error); // Si hay un error, rechazamos la promesa
            }
          );
        });
      }




  obtenerBlockPariod(idBranch: any){
    this.idBlockPeriodsService.getIdBlockPeriods(idBranch).subscribe(
      (data: any) => {
        this.blockPeriods = data;
      },
      (error) => console.error('Error fetching data:', error)
    )
  }

  formatCurrencyMx(value: number): string {
  if (value == null) return '';
  return value.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

}
