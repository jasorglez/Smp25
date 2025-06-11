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
    });
  }
  private actualizarDiaSemana(fecha: string) {
    const diasSemana = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado'
    ];
    
    // Parsear la fecha asegurándonos de que se interprete en la zona horaria local
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);
    this.diaSemana = diasSemana[fechaObj.getDay()];
  }

  onSubmit() {

  }

  revertChanges(){

  }
}
