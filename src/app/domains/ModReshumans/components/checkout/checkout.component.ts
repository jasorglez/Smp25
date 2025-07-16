import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent { }
