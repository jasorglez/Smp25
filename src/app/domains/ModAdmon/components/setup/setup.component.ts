import { Component, inject } from '@angular/core';
import { PositionsComponent } from './positions/positions.component';
import { BillingComponent } from './billing/billing.component';
import { CatalogsComponent } from 'app/domains/SMP/Components/catalogs/catalogs.component';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [PositionsComponent, BillingComponent, CatalogsComponent],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupAdmonComponent {
  idRoot: number;

  private signalsService = inject(SignalsService);

  ngOnInit() {
    this.signalsService.setCatalogSelected('ADMINISTRATION');
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
  }
}
