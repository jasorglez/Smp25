import { ChangeDetectionStrategy, effect, Component ,inject} from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { forkJoin } from 'rxjs';
import { EmployeeClockData } from 'app/interface/EmpleyeeClock';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { ClockService } from 'app/services/clock.service';
import { CommonModule } from '@angular/common';
import { EmployeesService } from 'app/services/employees.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './holidays.component.html',
})
export default class  HolidaysComponent { 

  private clockService = inject(ClockService);
  private employeesService = inject(EmployeesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  diasSemana = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
  
  idCompany: number;
  idBranch: number;
  fechaInicio: string;
  fechaFin: string;
  myForm;
  diaSemanaInicio: string = '';
  diaSemanaFin: string = '';
  catalogoFestive: any[] = [];
  requests: any[] = [];
  catalogoFestiveVigente: any[] = [];
  festivo: number = null;

   constructor(private formBuilder: FormBuilder) {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerCatalogoFestivo(this.idCompany);
      this.obtenerCatalogoFestivoVigente(this.idCompany);
    });

      this.fechaInicio = this.getLocalDate();
      this.myForm = this.formBuilder.group({
        fechaInicio: [this.fechaInicio, Validators.required],
        fechaFin: [null, Validators.required],
        festivo: ['', Validators.required],
      });
      this.actualizarDiaSemanaInicio(this.fechaInicio);
    
      this.myForm.valueChanges.subscribe((values) => {
          this.fechaInicio = values.fechaInicio;
          this.actualizarDiaSemanaInicio(values.fechaInicio);
          this.fechaFin = values.fechaFin;
          this.actualizarDiaSemanaFin(values.fechaFin);
          this.festivo = values.festivo;
      });
  }

  private actualizarDiaSemanaInicio(fecha: string): void {
    

    // Validación robusta
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.diaSemanaInicio = 'Fecha inválida';
      return;
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);

    if (isNaN(fechaObj.getTime())) {
      this.diaSemanaInicio = 'Fecha inválida';
    } else {
      this.diaSemanaInicio = this.diasSemana[fechaObj.getDay()];
    }
  }
  private actualizarDiaSemanaFin(fecha: string): void {

    // Validación robusta
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.diaSemanaFin = 'Fecha inválida';
      return;
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);

    if (isNaN(fechaObj.getTime())) {
      this.diaSemanaFin = 'Fecha inválida';
    } else {
      this.diaSemanaFin = this.diasSemana[fechaObj.getDay()];
    }
  }

  private getLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  obtenerCatalogoFestivo(idCompany: number) {
    this.clockService.getCatalogsFestive(idCompany).subscribe((data: any) => {
      this.catalogoFestive = data;
    });
  }

  obtenerCatalogoFestivoVigente(idCompany: number) {
    this.clockService.getCatalogsFestiveVigente(idCompany).subscribe((data: any) => {
      this.catalogoFestiveVigente = data;
      
    });
  }

  onSubmit() {
  const fechaInicio = this.myForm.value.fechaInicio;
  const fechaFin = this.myForm.value.fechaFin || fechaInicio; // Si no hay fin, se usa el inicio
  const idReason = this.myForm.value.festivo;

  if (!fechaInicio || !idReason) {
    alerts.basicAlert('Error', 'Debe seleccionar una fecha y un motivo.', 'error');
    return;
  }

  alerts.confirmAlert(
    'Confirmar',
    '¿Está seguro que desea añadir estos datos al sistema?',
    'warning',
    'Sí, añadir'
  ).then((result) => {
    if (!result.isConfirmed) return;

    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const allRequests = [];

    const recorrerDias = (current: Date) => {
      if (current > fin) {
        forkJoin(allRequests).subscribe({
          next: (responses) => {
            console.log('✅ Registros completados:', responses);
            alerts.basicAlert('Éxito', 'Se procesaron todos los registros.', 'success');
          },
          error: (err) => {
            console.error('❌ Error al procesar registros:', err);
            alerts.basicAlert('Error', 'Hubo un problema al guardar los datos.', 'error');
          }
        });
        return;
      }

      const nombreDia = diasSemana[current.getDay()];
      const fechaStr = current.toISOString().split('T')[0];

      this.employeesService.getEmployeeClockByBranch(this.idBranch, nombreDia).subscribe({
        next: (empleados) => {
          empleados.forEach((item: any) => {
            const horaSalida = this.sumarHoras(item.entry1, item.hours);

            const baseData = {
              active: true,
              byTimeClock: false,
              edited: true,
              editedBy: this.signalsService.getDisplayName()(),
              idEmployee: item.idEmployee,
              idReason: idReason,
              minuteDiscount: 0,
              holiday: true,
              minuteDiscountBackup: null,
              valid: false
            };

            const dataIn = {
              ...baseData,
              timeStamp: `${fechaStr}T${item.entry1}`,
              type: 'IN'
            };

            const dataOut = {
              ...baseData,
              timeStamp: `${fechaStr}T${horaSalida}`,
              type: 'OUT'
            };
            console.log(dataIn)
            console.log(dataOut)
            allRequests.push(this.clockService.checkInOut(dataIn));
            allRequests.push(this.clockService.checkInOut(dataOut));
          });

          // Ir al siguiente día
          current.setDate(current.getDate() + 1);
          recorrerDias(current);
        },
        error: (err) => {
          console.error(`❌ Error al obtener empleados para ${nombreDia}:`, err);
          alerts.basicAlert('Error', `Error al obtener empleados para ${nombreDia}`, 'error');
        }
      });
    };

    recorrerDias(new Date(inicio)); // Iniciar proceso
  });
}

  revertChanges(){
    this.fechaInicio = this.getLocalDate();
      this.myForm = this.formBuilder.group({
        fechaInicio: [this.fechaInicio, Validators.required],
        fechaFin: [null, Validators.required],
        festivo: ['', Validators.required],
      });
      this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Feriados', 'Menu Feriados en Checador',  this.trackingService.getEmail());
  }


  sumarHoras(horaStr: string, horasASumar: number): string {
  const [h, m, s] = horaStr.split(':').map(Number);

  // Convertir hora base a minutos totales
  let totalMinutos = h * 60 + m;

  // Convertir horas decimales a minutos
  const minutosASumar = Math.round(horasASumar * 60);

  totalMinutos += minutosASumar;

  // Calcular nueva hora
  const nuevaHora = Math.floor(totalMinutos / 60) % 24;
  const nuevosMinutos = totalMinutos % 60;

  // Convertir a string con formato HH:mm:ss
  const horaFormateada = `${String(nuevaHora).padStart(2, '0')}:${String(nuevosMinutos).padStart(2, '0')}:00`;

  return horaFormateada;
}

}
