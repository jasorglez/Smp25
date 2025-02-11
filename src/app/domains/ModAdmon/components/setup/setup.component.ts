import { Component } from '@angular/core';
import { PositionsComponent } from './positions/positions.component';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [PositionsComponent],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupAdmonComponent {

}