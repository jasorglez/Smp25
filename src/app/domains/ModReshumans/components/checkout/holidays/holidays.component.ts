import { ChangeDetectionStrategy, effect, Component ,inject} from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { ClockService } from 'app/services/clock.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './holidays.component.html',
})
export default class  HolidaysComponent { 

  private clockService = inject(ClockService);
  private signalsService = inject(SignalsService);
  
  
  idRoot: number;
  fechaInicio: string;
  fechaFin: string;
  myForm;
  diaSemanaInicio: string = '';
  diaSemanaFin: string = '';
  catalogoFestive: any[] = [];
  catalogoFestiveVigente: any[] = [];

   constructor(private formBuilder: FormBuilder) {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerCatalogoFestivo(this.idRoot);
    this.obtenerCatalogoFestivoVigente(this.idRoot);
    this.myForm = this.formBuilder.group({
      fechaInicio: [null, Validators.required],
      fechaFin: [null, Validators.required],
      justificante: ['', Validators.required],
    });


    this.myForm.valueChanges.subscribe((values) => {
        this.fechaInicio = values.fechaInicio;
        this.actualizarDiaSemanaInicio(values.fechaInicio);
        this.fechaFin = values.fechaFin;
        this.actualizarDiaSemanaFin(values.fechaFin);
    });

    // Log de cambios del formulario completo
    this.myForm.valueChanges.subscribe((values) => {
      console.log('Estado actual del formulario:', values);
    });
  }

  private actualizarDiaSemanaInicio(fecha: string): void {
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
      this.diaSemanaInicio = 'Fecha inválida';
      return;
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);

    if (isNaN(fechaObj.getTime())) {
      this.diaSemanaInicio = 'Fecha inválida';
    } else {
      this.diaSemanaInicio = diasSemana[fechaObj.getDay()];
    }
  }
  private actualizarDiaSemanaFin(fecha: string): void {
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
      this.diaSemanaFin = 'Fecha inválida';
      return;
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);

    if (isNaN(fechaObj.getTime())) {
      this.diaSemanaFin = 'Fecha inválida';
    } else {
      this.diaSemanaFin = diasSemana[fechaObj.getDay()];
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
      console.log(this.catalogoFestiveVigente)
    });
  }
  onSubmit() {

  }

  revertChanges(){

  }
}
