import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { SignalsService } from './services/signals.service';
import { ItemChatOverlayComponent } from './shared/item-comments-cell-renderer/item-chat-overlay.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ItemChatOverlayComponent],
  template: '<router-outlet></router-outlet><app-item-chat-overlay></app-item-chat-overlay>',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'bi-aug-24';
  private lastLoadedBranchId: number | null = null; // Variable para rastrear la última sucursal cargada
  /** Cancela GET guard/guardAdvanced anteriores si cambia la sucursal antes de que respondan. */
  private permissionsLoadSub: Subscription | null = null;

  private authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      const email = localStorage.getItem('mail');
      const isAdvanced = this.signalsService.getIsAdvanced();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();

      // Cargamos permisos siempre que tengamos email. La sucursal filtra qué módulos aparecen.
      if (email) {
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

  ngOnDestroy(): void {
    this.permissionsLoadSub?.unsubscribe();
    this.permissionsLoadSub = null;
  }

  private loadPermissions(email: string, isAdvanced: boolean, idBranch: number | null) {
    // Si los permisos ya existen y no han cambiado las condiciones, no recargar.
    if (this.authService.getUserPermissions() && Object.keys(this.authService.getUserPermissions()).length > 0) {
      if (idBranch === this.lastLoadedBranchId) {
        return;
      }
    }

    this.permissionsLoadSub?.unsubscribe();
    const branchSnapshot = idBranch;

    this.permissionsLoadSub = this.authService
      .getUserId(email)
      .pipe(
        switchMap((userId) => {
          if (idBranch != null && idBranch > 0) {
            return forkJoin({
              basic: this.authService.fetchUserPermissions(userId),
              advanced: this.authService.fetchUserPermissionsAdvanced(userId, idBranch).pipe(
                catchError(() => of({ permissions: {} }))
              ),
            }).pipe(
              map(({ basic, advanced }) => ({ mode: 'advanced' as const, basic, advanced }))
            );
          }
          return this.authService
            .fetchUserPermissions(userId)
            .pipe(map((data: any) => ({ mode: 'basic' as const, data })));
        })
      )
      .subscribe({
        next: (result) => {
          if (this.signalsService.getBranchSelectedBySidebar()() !== branchSnapshot) {
            return;
          }
          if (result.mode === 'advanced') {
            const { basic, advanced } = result;
            const adv = advanced?.permissions;
            this.authService.setMenuUserPermissions(basic.permissions);
            const merged = this.authService.mergeGuardAdvancedIntoBase(basic.permissions, adv);
            this.authService.setUserPermissions(merged);
          } else {
            const data = result.data;
            this.authService.setUserPermissions(data.permissions);
            this.authService.setMenuUserPermissions(data.permissions);
          }
          this.lastLoadedBranchId = branchSnapshot;
          this.signalsService.bumpGuardRefreshTick();
        },
        error: (error) => console.error('Error fetching permissions:', error),
      });
  }
}
