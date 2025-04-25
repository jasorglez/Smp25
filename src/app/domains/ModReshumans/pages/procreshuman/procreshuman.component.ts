import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procreshuman.component.html',
  styleUrl: './procreshuman.component.scss',
})
export class ProcreshumanComponent {
  private signalsService = inject(SignalsService);
  ngOnInit() {
    this.signalsService.setCatalogSelected('RESOURCEHUMAN');
  }
}
