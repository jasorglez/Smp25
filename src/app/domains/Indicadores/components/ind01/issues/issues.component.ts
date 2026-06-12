import { Component, inject } from '@angular/core';
import { IdentificationComponent } from './identification/identification.component';
import { AnalysisComponent } from './analysis/analysis.component';
import { ContingencyActionsComponent } from './contingency-actions/contingency-actions.component';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, IdentificationComponent, AnalysisComponent, ContingencyActionsComponent],
  templateUrl: './issues.component.html',
  styleUrl: './issues.component.scss'
})
export class IssuesComponent {
  private signalsService = inject(SignalsService);
  idIdentification = this.signalsService.idIdentification;
  idAnalysis = this.signalsService.idAnalysis;
}
