import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { ClockService } from 'app/services/clock.service';
import { SignalsService } from 'app/services/signals.service';
import { TimeService } from 'app/services/time.service';
import { interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clock.component.html',
  styleUrl: './clock.component.scss'
})
export class ClockComponent {

  private timeService = inject(TimeService);
  private clockService = inject(ClockService);
  private signalsService = inject(SignalsService);

  time: any[] = [];
  idBranch: number;
  formattedDate: string = '';
  formattedTime: string = '';
  private updateInterval!: any;
  employeeCode: string = '';
  clockPassword: string = '';
  status: string = '';

  ngOnInit() {
    this.setupTimeUpdates();
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
    interval(10000).subscribe(() => this.getTime());
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
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    this.formattedDate = date.toLocaleDateString('es-MX', options)
      .replace(/(^\p{Ll})/u, m => m.toUpperCase())
      .replace(/\bde\b/gi, m => m.toLowerCase())
      .replace(/,/g, '')

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
    this.clockService.getEmployeeInfo(this.idBranch, this.employeeCode, this.clockPassword).subscribe({
      next: (data) => {
        console.log(data);
        this.getTimeAgain().subscribe(fecha => {
          console.log(fecha);
          if (type == 'IN') {
            // Verifica si la fecha es la misma que la última entrada, ya que no se puede ingresar en
            // el mismo día dos veces consecutivas sin una salida de por medio.
            if (data[0]?.lastType === 'IN' && 
                data[0]?.lastCheck.split('T')[0] === fecha.split('T')[0]) {
              alerts.basicAlert("Error", "Ya ha ingresado al día de hoy", "error");
              return;
            }
            const info = { idEmployee: data[0]?.idEmployee, type: 'IN', timeStamp: fecha, active: true };
            console.log(info);
            this.clockService.checkInOut(info).subscribe(
              (data => {
                alerts.basicAlert("Éxito", "Entrada marcada exitosamente", "success");
              })
            );
          }
          else if(type == 'OUT')
          {
            // Verifica si la fecha es la misma que la última salida, ya que no se puede salir en
            // el mismo día dos veces consecutivas sin una entrada de por medio.
            if (data[0]?.lastType === 'OUT' && 
                data[0]?.lastCheck.split('T')[0] === fecha.split('T')[0]) {
              alerts.basicAlert("Error", "Ya ha marcado su salida el día de hoy", "error");
              return;
            }
            const info = { idEmployee: data[0]?.idEmployee, type: 'OUT', timeStamp: fecha, active: true };
            console.log(info);
            this.clockService.checkInOut(info).subscribe(
              (data => {
                alerts.basicAlert("Éxito", "Salida marcada exitosamente", "success");
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

}
