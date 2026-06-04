import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-procsales',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procsales.component.html',
  styleUrl: './procsales.component.scss',
})
export class ProcsalesComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  get isPosGroupActive(): boolean {
    const url = this.router.url;
    return ['before-pos', 'stores', 'cash-register', 'restaurant-mesas', 'cash-closing', 'returns', 'reports', 'mis-tareas']
      .some(r => url.includes(r));
  }

  get hasPosGroupPermission(): boolean {
    return ['pos', 'stores', 'cash-register', 'mesas', 'closebox', 'returns', 'reports', 'prospectos']
      .some(p => this.authService.hasDetailedPermission('sales', p));
  }
}
