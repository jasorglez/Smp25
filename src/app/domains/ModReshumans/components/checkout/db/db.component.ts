import { Component, effect, inject } from '@angular/core';
import { ClockService } from 'app/services/clock.service';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { CommonModule } from '@angular/common';
import { filter, map } from 'rxjs';
import { TimeService } from 'app/services/time.service';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';


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

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  data: any;
  idEmployee: number;
  idBranch: number;
  startDate: string = '';
  endDate: string = '';
  localTime: string = '';
  weekData: any = { Hours: null, PendingOuts: null, Absences: null, Delays: null };
  customData: any = { Hours: null, PendingOuts: null, Absences: null, Delays: null };

  columnDefs = [
    { headerName: 'Nombre Empleado', field: 'name', flex: 2 , filter: true, filterParams: {defaultToNothingSelected: true},},
    {
      headerName: 'Fecha y Hora',
      field: 'timeStamp',
      flex: 2,
      filter: true,
      filterParams: {
        // can be 'windows' or 'mac'
        defaultToNothingSelected: true,
        //excelMode: 'mac',
      },
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return date.toLocaleString('es-MX', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    },
    { headerName: 'Tipo', field: 'type', flex: 1},
    { headerName: 'Válido', field: 'valid', flex: 1 },
    { headerName: 'Minutos descontados', field: 'minuteDiscount', flex: 1 }
  ];

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
  };

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.getTime();
    this.getData();
  }

  constructor() {
    effect(() => {

      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.getTime();
      this.getData();

    });
  }

  getData() {
    this.clockService.getCheckInfo(this.idBranch).subscribe(
      data => {
        this.data = data;
        console.log(data);
      },
      error => {
        this.data = null;
        console.error(error)
      });
  }

  onRowDoubleClicked(event: any) {
    this.idEmployee = event.data.id;
    console.log(this.localTime.slice(0, 10), event.data.timeStamp);
    this.checkIncidentsByWeek(this.idEmployee, this.localTime.slice(0, 10), event.data.timeStamp);
    console.log('ID Empleado seleccionado:', this.idEmployee);

    const modal = new bootstrap.Modal(document.getElementById('searchModal')!);
    modal.show();
  }

  onSearch() {
    console.log('Fecha Inicio:', this.startDate);
    console.log('Fecha Fin:', this.endDate);

    const modal = bootstrap.Modal.getInstance(document.getElementById('searchModal')!);
    modal?.hide();
  }

  getTime() {
    return this.timeService.getTime().subscribe(time => {
      this.localTime = time.localTime;
      console.log('Fecha y hora local:', this.localTime);
    });
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
      console.log('startPeriod:', formatLocalDate(startPeriod));
      console.log('endPeriod:', formatLocalDate(endPeriod));

      // Llamar al servicio para verificar incidentes
      this.clockService.checkIncidentsByEmployee(idEmployee, formatLocalDate(startPeriod), formatLocalDate(endPeriod)).subscribe(incidentData => {
        console.log('Datos de incidentes:', incidentData);
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
      console.log('Datos de incidentes:', incidentData);
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

