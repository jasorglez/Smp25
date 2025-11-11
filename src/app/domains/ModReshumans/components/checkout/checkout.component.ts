import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  
  authService = inject(AuthService);
}
