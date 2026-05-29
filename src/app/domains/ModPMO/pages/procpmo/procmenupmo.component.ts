import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procmenupmo',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmenupmo.component.html',
  styleUrl: './procmenupmo.component.scss'
})
export class ProcmenupmoComponent {
  authService   = inject(AuthService);
  signalsService = inject(SignalsService);

  ngOnInit(): void {
    this.signalsService.setCatalogSelected('PMO');
  }
}
