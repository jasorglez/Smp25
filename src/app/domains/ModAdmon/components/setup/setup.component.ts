import { Component } from '@angular/core';
import { PositionsComponent } from './positions/positions.component';
import { BillingComponent } from "./billing/billing.component";

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [PositionsComponent, BillingComponent],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupAdmonComponent {

}