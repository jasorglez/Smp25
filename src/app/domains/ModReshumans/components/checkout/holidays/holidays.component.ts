import { ChangeDetectionStrategy, effect, Component ,inject} from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { forkJoin } from 'rxjs';
import { EmployeeClockData } from 'app/interface/EmpleyeeClock';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { ClockService } from 'app/services/clock.service';
import { CommonModule } from '@angular/common';
import { EmployeesService } from 'app/services/employees.service';

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
    console.log(this.idBranch)
    if(this.myForm.value.fechaInicio != null && this.myForm.value.festivo != ''){
      const inicio = this.diasSemana.indexOf(this.diaSemanaInicio);
      const fin = this.diasSemana.indexOf(this.diaSemanaFin);
          if (inicio >= 0 && fin >= 0 && inicio <= fin) {
        const diasSeleccionados = this.diasSemana.slice(inicio, fin + 1);
        this.employeesService.getEmployeeClockByBranch(this.idBranch, diasSeleccionados).subscribe((data: any) => {
          this.Asignacion(data)});
      } else {
        const diasSeleccionados = [this.diaSemanaInicio];
        this.employeesService.getEmployeeClockByBranch(this.idBranch, diasSeleccionados).subscribe((data: any) => {
          this.Asignacion(data)});
      }
    }else{
      alerts.basicAlert(
        'Carga fallida',
        'Por favor, seleccione un motivo.',
        'error'
      );
      return;
    }
  }
  Asignacion(valor: EmployeeClockData[]){
    
    alerts.confirmAlert(
        'Confirmar',
        '¿Está seguro que desea añadir estos datos al sistema?',
        'warning',
        'Sí, añadir'
      ).then((result) => {
        if (result.isConfirmed) {
          for (const item of valor) {
            const newHora = this.sumarHoras(item.entry1, item.hours);
            const fechaCorrespondiente = this.obtenerFechaPorNombreDia(
              this.myForm.value.fechaInicio,
              this.myForm.value.fechaFin,
              item.day
            );
          
            const data1 = {
              active: true,
              byTimeClock: false,
              edited: true,
              editedBy: this.signalsService.getDisplayName()(),
              idEmployee: item.idEmployee,
              idReason: this.myForm.value.festivo,
              minuteDiscount: 0,
              minuteDiscountBackup: null,
              timeStamp: `${fechaCorrespondiente}T${item.entry1}`,
              type: 'IN',
              valid: true,
            };
          
            const data2 = {
              ...data1,
              timeStamp: `${fechaCorrespondiente}T${newHora}`,
              type: 'OUT',
            };
          
            // Añadir los observables a la lista
            this.requests.push(this.clockService.checkInOut(data1));
            this.requests.push(this.clockService.checkInOut(data2));
          }
          
          forkJoin(this.requests).subscribe({
            next: (responses) => {
              console.log('✅ Todos los registros procesados con éxito:', responses);
              alerts.basicAlert(
                'Carga exitosa',
                'Se han añadido los datos correctamente.',
                'success'
              );
            },
            error: (error) => {
              console.error('❌ Error en alguna de las peticiones:', error);
              alerts.basicAlert(
                'Error',
                'Ocurrió un error al cargar los datos. Por favor, intente nuevamente.',
                'error'
              );
            },
          });
        }
    });
  }
  revertChanges(){

  }

  private obtenerFechaPorNombreDia(fechaInicio: string, fechaFin: string, diaBuscado: string): string | null {
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = fechaFin ? new Date(fechaFin  + 'T00:00:00') : new Date(fechaInicio  + 'T00:00:00'); // Si no hay fechaFin, solo evalúa una

  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const nombreDia = this.diasSemana[d.getDay()];
    //console.log(nombreDia, diaBuscado)
    if (nombreDia === diaBuscado) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return null; // No se encontró
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
