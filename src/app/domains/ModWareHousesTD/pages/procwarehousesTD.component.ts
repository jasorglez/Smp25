import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procwarehousesTD.component.html',
  styleUrl: './procwarehousesTD.component.scss',
})
export class ProcWarehousesTDComponent {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  ngOnInit() {
    //this.signalsService.setCatalogSelected('SHOPPINGDELISON');
  }
}
