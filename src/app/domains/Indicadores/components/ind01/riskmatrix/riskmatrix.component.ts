import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { IdentificationRiskComponent } from "./identification-risk/identification-risk.component";
import { AnalysisRiskComponent } from "./analysis-risk/analysis-risk.component";

@Component({
  selector: 'app-riskmatrix',
  standalone: true,
  imports: [CommonModule, IdentificationRiskComponent, AnalysisRiskComponent],
  templateUrl: './riskmatrix.component.html',
  styleUrl: './riskmatrix.component.scss'
})
export class RiskmatrixComponent {

  private signalsService = inject(SignalsService);

  idIdentificationRisk: number= this.signalsService.getIdIdentificationRisk()();

}
