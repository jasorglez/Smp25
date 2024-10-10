import { Component } from '@angular/core';
import { IdentificationComponent } from './identification/identification.component';



@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [IdentificationComponent],
  templateUrl: './issues.component.html',
  styleUrl: './issues.component.scss'
})
export class IssuesComponent {

}
