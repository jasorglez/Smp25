import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { IdentificationRiskComponent } from "./identification-risk.component";
import { AnalysisRiskComponent } from "./analysis-risk.component";
import { PlanificationRiskComponent } from "./planification-risk.component";

@Component({
  selector: 'app-riskmatrix',
  standalone: true,
  imports: [CommonModule, IdentificationRiskComponent, AnalysisRiskComponent, PlanificationRiskComponent],
  templateUrl: './riskmatrix.component.html'
})
export class RiskmatrixComponent {

  private signalsService = inject(SignalsService);

  idIdentificationRisk = this.signalsService.getIdIdentificationRisk();
  idAnalysisRisk = this.signalsService.getIdAnalysisRisk();

}
