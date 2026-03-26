import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procpresupuestos',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procpresupuestos.component.html',
  styleUrl: './procpresupuestos.component.scss'
})
export class ProcpresupuestosComponent {
  authService = inject(AuthService);
  signalsService = inject(SignalsService);

  ngOnInit() {
    this.signalsService.setCatalogSelected('PRESUPUESTOS');
  }
}
