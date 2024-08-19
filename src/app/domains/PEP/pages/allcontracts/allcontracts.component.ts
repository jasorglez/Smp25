import { Component } from '@angular/core';
import { ProcessComponent } from "../process/process.component";

@Component({
  selector: 'app-allcontracts',
  standalone: true,
  imports: [ProcessComponent],
  templateUrl: './allcontracts.component.html',
  styleUrl: './allcontracts.component.scss'
})
export class AllcontractsComponent {

}
