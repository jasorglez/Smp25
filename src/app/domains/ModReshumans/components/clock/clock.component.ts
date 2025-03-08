import { CommonModule } from '@angular/common';
import { Component, effect, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { ClockService } from 'app/services/clock.service';
import { EmployeesService } from 'app/services/employees.service';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';
import { TimeService } from 'app/services/time.service';
import { map } from 'rxjs/operators';
import { DbComponent } from './db/db.component';

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule, FormsModule, DbComponent],
  templateUrl: './clock.component.html',
  styleUrl: './clock.component.scss'
})
export class ClockComponent {
  @ViewChild('clockDb') clockDb!: DbComponent; // Referencia al componente DbComponent

  private timeService = inject(TimeService);
  private clockService = inject(ClockService);
  private signalsService = inject(SignalsService);
  private employeesService = inject(EmployeesService);
  private hrService = inject(HRService);

  time: any[] = [];
  idBranch: number;
  formattedDate: string = '';
  formattedTime: string = '';
  private updateInterval!: any;
  employeeCode: string = '';
  clockPassword: string = '';
  status: string = '';
  currentDayName: string = '';
  incidentData: any = { Hours: null, PendingOuts: null }

  ngOnInit() {
    this.setupTimeUpdates();
    this.setupModalListener();
  }

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    });
  }

  private setupTimeUpdates() {
    // Actualización inicial
    this.getTime();

    // Actualizar cada segundo
    this.updateInterval = setInterval(() => {
      const now = new Date();
      now.setSeconds(now.getSeconds());
      this.formatDateTime(now.toISOString());
    }, 1000);

    // Sincronizar con servidor cada 10 segundos
    // Activar si lo desean
    // interval(10000).subscribe(() => this.getTime());
  }

  private setupModalListener() {
    const modal = document.getElementById('clockDbModal');
    if (modal) {
      modal.addEventListener('shown.bs.modal', () => {
        if (this.clockDb) {
          this.clockDb.getData(); // Refrescar los datos al abrir el modal
        }
      });
    }
  }

  getTime() {
    this.timeService.getTime().subscribe(data => {
      this.formatDateTime(data.localTime);
    });
  }

  getTimeAgain() {
    return this.timeService.getTime().pipe(
      map(data => data.localTime)
    );
  }

  private formatDateTime(isoString: string) {
    const date = new Date(isoString);

    // Obtener solo el día de la semana
    const dayOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long'
    };
    this.currentDayName = date.toLocaleDateString('es-MX', dayOptions)
      .replace(/(^\p{Ll})/u, m => m.toUpperCase());

    // El resto del código existente
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    this.formattedDate = date.toLocaleDateString('es-MX', options)
      .replace(/(^\p{Ll})/u, m => m.toUpperCase())
      .replace(/\bde\b/gi, m => m.toLowerCase())
      .replace(/,/g, '');

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    this.formattedTime = date.toLocaleTimeString('es-MX', timeOptions);
  }

  ngOnDestroy() {
    clearInterval(this.updateInterval);
  }

  checkInOrOut(type: string) {
    this.clockService.getEmployeeInfo(this.employeeCode, this.clockPassword).subscribe({
      next: (data) => {
        console.log(data);
        this.getTimeAgain().subscribe(fecha => {
          console.log(fecha);
          const currentDay = this.currentDayName; // Obtener el día actual almacenado

          // Llamar al método para verificar incidentes
          this.checkIncidents(data[0]?.idEmployee, currentDay, fecha);

          if (type == 'IN') {
            // El empleado no marcó su salida.
            // Si la fecha de entrada sea distinta a la fecha actual, debe arrojar este error.
            if (data[0]?.lastType === 'IN' &&
              data[0]?.lastCheck.split('T')[0] === fecha.split('T')[0]) {
              alerts.basicAlert("Error", "Ya ha marcado su entrada el día de hoy", "error");
              return;
            }

            // Si el último lastValid fue false y es el mismo día, setear valid en false
            let valid = true; // Inicialmente se asume que es válido
            if (data[0]?.lastValid === false && 
                data[0]?.lastCheck.split('T')[0] === fecha.split('T')[0]) {
              valid = false;
            }

            // Consultar el horario del empleado para el día actual
            this.employeesService.getEmployeeClockByDay(data[0]?.idEmployee, currentDay).subscribe(clockData => {
              console.log('Horario del empleado para el día actual:', clockData);

              // Obtener las horas de entrada
              const entry1 = clockData[0]?.entry1;
              const entry2 = clockData[0]?.entry2;

              // Convertir fecha y entradas a objetos Date para comparación
              const fechaDate = new Date(fecha);
              const entry1Date = new Date();
              const entry2Date = new Date();

              if (entry1) {
                const [hour1, minute1] = entry1.split(':').map(Number);
                entry1Date.setHours(hour1, minute1, 0);
              }

              if (entry2) {
                const [hour2, minute2] = entry2.split(':').map(Number);
                entry2Date.setHours(hour2, minute2, 0);
              }

              // Si clockData[0]?.enabled es false, valid es true
              // Y se marca como hora extra
              if (clockData[0]?.enabled === false) {
                valid = true;
                let extra = true;
              } else {
                let extra = false;
                // Obtener la tolerancia de hrData
                this.hrService.getHRManagementData(this.idBranch).subscribe(hrData => {
                  const clockTolerance = hrData[0]?.clockTolerance || 0; // Usar 0 como valor predeterminado si no está definido

                  // Validar las condiciones
                  const entry1DatePlusTolerance = new Date(entry1Date);
                  entry1DatePlusTolerance.setMinutes(entry1Date.getMinutes() + clockTolerance); // entry1Date + tolerancia

                  const entry2DatePlusTolerance = new Date(entry2Date);
                  entry2DatePlusTolerance.setMinutes(entry2Date.getMinutes() + clockTolerance); // entry2Date + tolerancia

                  const twoHoursBeforeEntry2 = new Date(entry2Date);
                  twoHoursBeforeEntry2.setHours(entry2Date.getHours() - 2);

                  if (valid) { // Solo validar si valid no fue forzado a false
                    valid = (fechaDate <= entry1DatePlusTolerance) ||
                      (fechaDate <= entry2DatePlusTolerance && fechaDate >= twoHoursBeforeEntry2);
                  }

                  const info = { idEmployee: data[0]?.idEmployee, type: 'IN', timeStamp: fecha, valid: valid, extra: extra, active: true };
                  console.log(info);
                  this.clockService.checkInOut(info).subscribe(
                    (clock => {
                      alerts.basicAlert("Entrada marcada exitosamente", `Hola ${data[0]?.name}`, "success");
                    })
                  );
                });
              }
            });
          }
          else if (type == 'OUT') {
            // Verifica si la fecha es la misma que la última salida, ya que no se puede salir en
            // el mismo día dos veces consecutivas sin una entrada de por medio.
            if (data[0]?.lastType === 'OUT' &&
              data[0]?.lastCheck.split('T')[0] === fecha.split('T')[0]) {
              alerts.basicAlert("Error", "Ya ha marcado su salida el día de hoy", "error");
              return;
            }

            // Si lastType fue IN y lastValid fue false, setear valid en false
            let valid = true; // Inicialmente se asume que es válido
            if (data[0]?.lastType === 'IN' && !data[0]?.lastValid) {
              valid = false;
            }

            const info = { idEmployee: data[0]?.idEmployee, type: 'OUT', timeStamp: fecha, valid: valid, active: true };
            console.log(info);
            this.clockService.checkInOut(info).subscribe(
              (clock => {
                alerts.basicAlert("Salida marcada exitosamente", `Adiós ${data[0]?.name}`, "success");
              })
            );
          }
        });
      },
      error: (error) => {
        if (error.status === 404) {
          alerts.basicAlert("Error", "Los datos proporcionados no son válidos", "error");
        } else {
          console.error('Error en la solicitud:', error);
        }
      }
    });
  }

  private checkIncidents(idEmployee: number, currentDay: string, fecha: string) {
    this.hrService.getHRManagementData(this.idBranch).subscribe(hrData => {
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
        endPeriod.setDate(endPeriod.getDate() + 7); // Hoy + 7 días
      } else {
        // Obtener el último día correspondiente
        const today = new Date(fechaDate); // Usar la fecha sin hora
        const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const daysToLastStartDay = (dayOfWeek + 7 - this.getDayIndex(startDay)) % 7; // Días hasta el último startDay
        startPeriod = new Date(today);
        startPeriod.setDate(today.getDate() - daysToLastStartDay); // Último startDay

        // Calcular el siguiente día correspondiente
        endPeriod = new Date(startPeriod);
        endPeriod.setDate(startPeriod.getDate() + 7); // Sábado siguiente
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
        this.incidentData = incidentData;
        /*         setTimeout(() => {
                  this.incidentData = { Hours: null, PendingOuts: null, Absences: null };
                }, 15000); // 15000 milisegundos = 15 segundos */
      });
    });
  }

  private getDayIndex(day: string): number {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days.indexOf(day);
  }
}
