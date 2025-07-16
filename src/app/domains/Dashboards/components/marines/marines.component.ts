import { Component } from '@angular/core';
import { ContractsBySpecialityComponent } from "../contracts-by-speciality/contracts-by-speciality.component";

@Component({
  selector: 'app-marines',
  standalone: true,
  imports: [ContractsBySpecialityComponent],
  templateUrl: './marines.component.html',
  styleUrl: './marines.component.scss'
})
export class MarinesComponent {

}
