import { Component, effect, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { SignalsService } from './services/signals.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {
  title = 'bi-aug-24';
  private lastLoadedBranchId: number | null = null; // Variable para rastrear la última sucursal cargada

  private authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      const email = localStorage.getItem('mail');
      const isAdvanced = this.signalsService.getIsAdvanced();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();

      // Solo cargamos permisos si tenemos el email y, en caso de ser avanzado, el idBranch.
      if (email && (!isAdvanced || (isAdvanced && idBranch))) {
        this.loadPermissions(email, isAdvanced, idBranch);
      }
    });
  }

  ngOnInit() {
    const token = localStorage.getItem('token');
    const path = this.router.url.split('?')[0] || '';
    if (token && path !== '/login') {
      this.authService.startSessionTimers();
    }
  }

  private loadPermissions(email: string, isAdvanced: boolean, idBranch: number | null) {
    // Si los permisos ya existen y no han cambiado las condiciones, no recargar.
    if (this.authService.getUserPermissions() && Object.keys(this.authService.getUserPermissions()).length > 0) {
      if (!isAdvanced || (isAdvanced && idBranch === this.lastLoadedBranchId)) {
        return;
      }
    }

    this.authService.getUserId(email).subscribe((userId) => {
      if (isAdvanced && idBranch > 0) {
        forkJoin({
          basic: this.authService.fetchUserPermissions(userId),
          advanced: this.authService.fetchUserPermissionsAdvanced(userId, idBranch).pipe(
            catchError(() => of({ permissions: {} }))
          ),
        }).subscribe({
          next: ({ basic, advanced }) => {
            const adv = advanced?.permissions;
            this.authService.setMenuUserPermissions(basic.permissions);
            if (adv && Object.keys(adv).length > 0) {
              this.authService.setUserPermissions(adv);
            } else {
              this.authService.setUserPermissions(basic.permissions);
            }
            this.lastLoadedBranchId = idBranch;
          },
          error: (error) => console.error('Error fetching permissions:', error),
        });
      } else {
        this.authService.fetchUserPermissions(userId).subscribe({
          next: (data: any) => {
            this.authService.setUserPermissions(data.permissions);
            this.authService.setMenuUserPermissions(data.permissions);
            this.lastLoadedBranchId = idBranch;
          },
          error: (error) => console.error('Error fetching user permissions:', error),
        });
      }
    });
  }
}
