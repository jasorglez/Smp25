import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-tablero-admon',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './tablero.component.html',
  styleUrl: './tablero.component.scss'
})
export class TableroComponent {
  authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    queueMicrotask(() => this.navigateToDefaultChild());
  }

  private navigateToDefaultChild(): void {
    if (this.route.firstChild) return;

    const hasDashboard = this.authService.hasMenuDetailedPermission('administration', 'dashboard');
    const hasDashboardHco = this.authService.hasMenuDetailedPermission('administration', 'dashboard-hco');
    const defaultChild = hasDashboard ? 'dashmodadmon' : hasDashboardHco ? 'dashboard-hco' : null;

    if (defaultChild) {
      this.router.navigate([defaultChild], { relativeTo: this.route });
    }
  }
}
