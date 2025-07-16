import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { IdentificationRiskComponent } from "./identification-risk.component";
import { AnalysisRiskComponent } from "./analysis-risk.component";
import { PlanificationRiskComponent } from "./planification-risk.component";
import { ImplementationRiskComponent } from "./implementation-risk.component";

@Component({
  selector: 'app-riskmatrix',
  standalone: true,
  imports: [CommonModule, IdentificationRiskComponent, AnalysisRiskComponent, PlanificationRiskComponent, ImplementationRiskComponent],
  templateUrl: './riskmatrix.component.html'
})
export class RiskmatrixComponent {

  private signalsService = inject(SignalsService);

  idIdentificationRisk = this.signalsService.getIdIdentificationRisk();
  idAnalysisRisk = this.signalsService.getIdAnalysisRisk();
  idSelectedWorkProgram = this.signalsService.getSelectedWorkProgram();
  idPlanificationRisk = this.signalsService.getIdPlanificationRisk();

}
