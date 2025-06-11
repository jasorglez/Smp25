import { ChangeDetectionStrategy, effect, Component ,inject} from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './holidays.component.html',
})
export default class  HolidaysComponent { 
  private signalsService = inject(SignalsService);
  
  
  idRoot: number;
  fechaInicio: string;
  fechaFin: string;
  myForm;
  diaSemana: string = '';

   constructor(private formBuilder: FormBuilder) {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    this.myForm = this.formBuilder.group({
      fechaInicio: [null, Validators.required],
      fechaFin: [null, Validators.required],
      justificante: ['', Validators.required],
    });

    // Día de la semana inicial (basado en la fecha actual)
    const fechaHoy = this.getLocalDate();
    this.actualizarDiaSemana(fechaHoy);

    // Escuchar cambios de fechaInicio
    this.myForm.get('fechaInicio')?.valueChanges.subscribe((fechaInicio: string) => {
      if (fechaInicio) {
        this.actualizarDiaSemana(fechaInicio);
      }
    });
    this.myForm.valueChanges.subscribe((values) => {
      if (this.myForm.valid) {
        alert(values.fechaInicio)
        this.fechaInicio = values.fechaInicio;
        this.fechaFin = values.fechaFin;
      }
    });

    // Log de cambios del formulario completo
    this.myForm.valueChanges.subscribe((values) => {
      console.log('Estado actual del formulario:', values);
    });
  }

  private actualizarDiaSemana(fecha: string): void {
    const diasSemana = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];

    // Validación robusta
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.diaSemana = 'Fecha inválida';
      return;
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);

    if (isNaN(fechaObj.getTime())) {
      this.diaSemana = 'Fecha inválida';
    } else {
      this.diaSemana = diasSemana[fechaObj.getDay()];
    }
  }

  private getLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  onSubmit() {

  }

  revertChanges(){

  }
}
