import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { SignalsService } from './services/signals.service';
import { ItemChatOverlayComponent } from './shared/item-comments-cell-renderer/item-chat-overlay.component';
import { ComparacionPreciosComponent } from './domains/ModShoppingDelison/pages/quote-delison/comparacion-precios.component';
import { ComparacionOverlayService, ComparacionOverlayData } from './services/comparacion-overlay.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ItemChatOverlayComponent, CommonModule, ComparacionPreciosComponent],
  template: `
    <router-outlet></router-outlet>
    <app-item-chat-overlay></app-item-chat-overlay>

    <!-- Modal Comparación de Precios — nivel raíz para evitar el transform de AG Grid -->
    <div *ngIf="comparacionData"
         style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:10000; display:flex; align-items:center; justify-content:center; padding:16px;"
         (click)="closeComparacion()">
      <div style="background:#fff; border-radius:10px; width:99vw; max-width:100%; height:95vh; display:flex; flex-direction:column; box-shadow:0 8px 40px rgba(0,0,0,0.3); overflow:hidden;"
           (click)="$event.stopPropagation()">
        <app-comparacion-precios
          [cotizacionId]="comparacionData.cotizacionId"
          [requisitionId]="comparacionData.requisitionId"
          [selectedProviderIds]="comparacionData.selectedProviderIds"
          [idBranchFromReq]="comparacionData.idBranchFromReq"
          (closed)="closeComparacion()"
          style="display:flex; flex-direction:column; height:100%;">
        </app-comparacion-precios>
      </div>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Delison';
  private lastLoadedBranchId: number | null = null;
  private permissionsLoadSub: Subscription | null = null;
  private comparacionSub?: Subscription;

  comparacionData: ComparacionOverlayData | null = null;

  private authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);
  private comparacionOverlayService = inject(ComparacionOverlayService);

  constructor() {
    effect(() => {
      const email = localStorage.getItem('mail');
      const isAdvanced = this.signalsService.getIsAdvanced();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();

      // Cargar permisos básicos en cuanto haya email; actualizarlos cuando cambie la sucursal.
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
    this.comparacionSub = this.comparacionOverlayService.open$.subscribe(data => {
      this.comparacionData = data;
    });
  }

  closeComparacion() {
    this.comparacionData = null;
  }

  ngOnDestroy(): void {
    this.permissionsLoadSub?.unsubscribe();
    this.permissionsLoadSub = null;
    this.comparacionSub?.unsubscribe();
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
