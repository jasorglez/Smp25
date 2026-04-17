import { Component, effect, inject } from '@angular/core';
import { ClockService } from 'app/services/clock.service';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { CommonModule } from '@angular/common';
import { TimeService } from 'app/services/time.service';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { BranchsService } from 'app/services/branchs.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-clock-db',
  standalone: true,
  imports: [AgGridModule, FormsModule, CommonModule],
  templateUrl: './db.component.html',
  styleUrl: './db.component.scss'
})

export default class DbComponent {

  private clockService = inject(ClockService);
  private timeService = inject(TimeService);
  private hrService = inject(HRService);
  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private trackingService = inject(TrackingService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  data: any;
  idEmployee: number;
  idBranch: number;
  idRoot: number;
  branchs: any[] = [];
  startDate: string = '';
  endDate: string = '';
  localTime: string = '';
  weekData: any = { Hours: null, PendingOuts: null, Absences: null, Delays: null };
  customData: any = { Hours: null, PendingOuts: null, Absences: null, Delays: null };

  columnDefs = [
    {
      headerName: 'Fecha',
      field: 'hour',
      flex: 1,
      filter: 'agDateColumnFilter',
      filterParams: {
        excelMode: 'mac',
        comparator: (filterLocalDateAtMidnight: Date, cellValue: any): number => {
          if (!cellValue) return -1;

          const date = typeof cellValue === 'string'
            ? this.parseAsUTC(cellValue)
            : new Date(cellValue);

          if (isNaN(date.getTime())) return -1;

          // Comparar solo fecha local (sin horas)
          const cellDay = date.getDate();
          const cellMonth = date.getMonth();
          const cellYear = date.getFullYear();

          const filterDay = filterLocalDateAtMidnight.getDate();
          const filterMonth = filterLocalDateAtMidnight.getMonth();
          const filterYear = filterLocalDateAtMidnight.getFullYear();

          if (cellYear < filterYear) return -1;
          if (cellYear > filterYear) return 1;
          if (cellMonth < filterMonth) return -1;
          if (cellMonth > filterMonth) return 1;
          if (cellDay < filterDay) return -1;
          if (cellDay > filterDay) return 1;
          return 0;
        }
      },
      valueFormatter: (params) => {
        if (!params.value) return '';

        const date = typeof params.value === 'string'
          ? this.parseAsUTC(params.value)
          : new Date(params.value);

        return date.toLocaleDateString('es-MX', {
          timeZone: 'America/Mexico_City', // muestra correctamente en zona local
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    },
    {
      field: 'idBranch',
      headerName: 'Nombre sucursal',
      editable: true,
      filter: true,
      width: 170,
      cellEditor: 'agSelectCellEditor',
      filterParams: {
        // can be 'windows' or 'mac'
        defaultToNothingSelected: true,
        //excelMode: 'windows',
      },

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
      headerName: 'Nombre Empleado',
      field: 'employeeName',
      flex: 2,
      filter: true,
      filterParams: { defaultToNothingSelected: true },
    },

    {
      headerName: 'Hora',
      field: 'hour',
      flex: 1,
      filter: 'agTextColumnFilter',
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return date.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    },
    { headerName: 'Tipo', field: 'type', flex: 1 },
    { headerName: 'Válido', field: 'valid', flex: 1 },
    { headerName: 'Minutos descontados', field: 'minuteDiscount', flex: 1 }
  ];

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
  };

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.getTime();
    this.getData();
    this.obtenerBranchs();
  }

  constructor() {
    effect(() => {

      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getTime();
      this.getData();
      this.obtenerBranchs();

    });
  }

  parseAsUTC(dateStr: string): Date {
    // Convierte '2025-06-24 18:00:00.000' → '2025-06-24T18:00:00Z'
    const [datePart, timePart] = dateStr.trim().split(' ');
    return new Date(`${datePart}T${timePart}Z`);
  }

  getData() {
    this.clockService.getCheckInfo(this.idBranch).subscribe(
      data => {
        // Convertir las cadenas de fecha a objetos Date
        this.data = data.map(item => ({
          ...item,
          date: new Date(item.date),  // Convertir cadena a Date
          hour: new Date(`${item.date}T${item.hour}`)  // Combinar fecha y hora
        }));
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Histórico de Checador', 'Menu Recursos HumanosHistórico Checador',  this.trackingService.getEmail());
      },
      error => {
        this.data = null;
        console.error(error)
      });
  }
  onRowDoubleClicked(event: any) {
    this.idEmployee = event.data.id;
    this.checkIncidentsByWeek(this.idEmployee, this.localTime.slice(0, 10), event.data.timeStamp);

    const modal = new bootstrap.Modal(document.getElementById('searchModal')!);
    modal.show();
  }

  onSearch() {

    const modal = bootstrap.Modal.getInstance(document.getElementById('searchModal')!);
    modal?.hide();
  }

  getTime() {
    return this.timeService.getTime().subscribe(time => {
      this.localTime = time.localTime;
    });
  }

  obtenerBranchs() {
    // alert('this.branchs'+ this.idBranch)
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }


  private checkIncidentsByWeek(idEmployee: number, currentDay: string, fecha: string) {
    this.hrService.getHRManagementData(8).subscribe(hrData => {
      const startDay = hrData[0]?.startDay;

      let startPeriod: Date;
      let endPeriod: Date;

      // Crear un objeto Date a partir de la fecha y eliminar la hora
      const fechaDate = new Date(fecha);
      fechaDate.setHours(0, 0, 0, 0); // Establecer horas, minutos, segundos y milisegundos a cero

      // Calcular las fechas de inicio y fin
      if (startDay === currentDay) {
        startPeriod = new Date(fechaDate); // Usar la fecha sin hora
        endPeriod = new Date(fechaDate);
        endPeriod.setDate(endPeriod.getDate() + 6); // Hoy + 7 días
      } else {
        // Obtener el último día correspondiente
        const today = new Date(fechaDate); // Usar la fecha sin hora
        const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const daysToLastStartDay = (dayOfWeek + 7 - this.getDayIndex(startDay)) % 7; // Días hasta el último startDay
        startPeriod = new Date(today);
        startPeriod.setDate(today.getDate() - daysToLastStartDay); // Último startDay

        // Calcular el siguiente día correspondiente
        endPeriod = new Date(startPeriod);
        endPeriod.setDate(startPeriod.getDate() + 6); // Sábado siguiente
      }

      // Función para formatear la fecha en YYYY-MM-DD manteniendo la zona horaria local
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Meses van de 0 a 11
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Mostrar en consola las fechas calculadas

      // Llamar al servicio para verificar incidentes
      this.clockService.checkIncidentsByEmployee(idEmployee, formatLocalDate(startPeriod), formatLocalDate(endPeriod)).subscribe(incidentData => {
        this.weekData = incidentData;
      });
    });
  }

  private getDayIndex(day: string): number {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days.indexOf(day);
  }

  private getCustomData(idEmployee: number, start: string, end: string) {
    // Convertir end a Date y sumar un día
    const endDate = new Date(end);
    const endDateFormatted = endDate.toISOString().split('T')[0]; // Formatear a YYYY-MM-DD

    // Llamar al servicio para verificar incidentes
    this.clockService.checkIncidentsByEmployee(idEmployee, start, endDateFormatted).subscribe(incidentData => {
      this.customData = incidentData;
    });
  }

  onCustomSearch() {
    if (!this.startDate || !this.endDate) {
      alert('Por favor, ingrese ambas fechas.');
      return;
    }

    // Llamar al método getCustomData con las fechas seleccionadas
    this.getCustomData(this.idEmployee, this.startDate, this.endDate);
  }

}

