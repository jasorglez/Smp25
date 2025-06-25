import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-modal-bonus',
  standalone: true,
  imports: [],
  templateUrl: './modalBonus.component.html',
})
export class ModalBonusComponent { 

  private signalsService = inject(SignalsService);
  idEmpleado: number = 0;
  fechaInico:string = '';
  fechaFin:string = '';
  constructor() {
    effect(() => {
      this.fechaInico = this.signalsService.getFechaNomina().fechaInicio;
      this.fechaFin = this.signalsService.getFechaNomina().fechaFin;
      this.idEmpleado = this.signalsService.getIdEmployee()();
    });
  }
}