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
  title = 'Delison';
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

      // Esperar sucursal seleccionada evita pintar el árbol global y luego corregirlo "a destiempo".
      if (email && idBranch != null) {
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
        switchMap((userId) =>
          this.authService.fetchEffectivePermissionsTree(userId, idBranch).pipe(
            catchError(() => of({} as any))
          )
        )
      )
      .subscribe({
        next: (tree) => {
          if (this.signalsService.getBranchSelectedBySidebar()() !== branchSnapshot) {
            return;
          }
          this.authService.applyEffectivePermissionsTree(tree);
          this.lastLoadedBranchId = branchSnapshot;
          this.signalsService.bumpGuardRefreshTick();
        },
        error: (error) => console.error('Error fetching permissions:', error),
      });
  }
}
