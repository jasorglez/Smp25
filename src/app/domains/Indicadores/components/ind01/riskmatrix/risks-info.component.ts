import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-risks-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './risks-info.component.html'
})
export class RisksInfoComponent {

  private signalsService = inject(SignalsService);

  idIdentificationRisk = this.signalsService.getIdIdentificationRisk();
  nameIdentificationRisk = this.signalsService.getNameIdentificationRisk();
  causeIdentificationRisk = this.signalsService.getCauseIdentificationRisk();
  selectedWorkProgram = this.signalsService.getSelectedWorkProgram();
  selectedPlanificationAction = this.signalsService.getPlanificationActionRisk();

}
