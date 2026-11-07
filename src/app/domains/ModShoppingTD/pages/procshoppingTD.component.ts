import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { canSeeWarehouseCleanup } from 'app/guards/warehouse-cleanup.guard';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procshoppingTD.component.html',
  styleUrl: './procshoppingTD.component.scss',
})
export class ProcShoppingTDComponent {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  get canCleanModule(): boolean { return canSeeWarehouseCleanup(this.signalsService); }
  ngOnInit() {
    //this.signalsService.setCatalogSelected('SHOPPINGDELISON');
  }
}
