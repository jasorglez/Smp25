import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-issues-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './issues-info.component.html',
  styleUrl: './issues-info.component.scss'
})
export class IssuesInfoComponent {

  private signalsService = inject(SignalsService);

  identificationId = this.signalsService.idIdentification;
  identificationName = this.signalsService.nameIdentification;
  identificationClassification = this.signalsService.classificationIdentification;
  identificationEvent = this.signalsService.eventIdentification;
  identificationRegisteredDate = this.signalsService.registeredDateIdentification;
  analysisId = this.signalsService.idAnalysis;
  analysisName = this.signalsService.nameAnalysis;
  contingencyActionId = this.signalsService.idContingencyAction;
  contingencyActionName = this.signalsService.nameContingencyAction;


}
