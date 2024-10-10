import { Component } from '@angular/core';
import { IdentificationComponent } from './identification/identification.component';
import { AnalysisComponent } from './analysis/analysis.component';
import { ContingencyActionsComponent } from './contingency-actions/contingency-actions.component';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [IdentificationComponent, AnalysisComponent,ContingencyActionsComponent],
  templateUrl: './issues.component.html',
  styleUrl: './issues.component.scss'
})
export class IssuesComponent {

}
