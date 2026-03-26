import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
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
  private destroyRef = inject(DestroyRef);

  /** Submenú debajo de la barra “Punto de venta” (solo frontend). */
  posSubmenuOpen = false;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const url = this.router.url;
        const staysOpen =
          url.includes('/procsales/pos') || url.includes('/procsales/before-pos');
        if (!staysOpen) this.posSubmenuOpen = false;
      });
  }

  private getPosViewFromUrl(): string {
    const tree = this.router.parseUrl(this.router.url);
    const v = (tree.queryParams?.['view'] ?? '') as string;
    return (v || 'nueva').toLowerCase();
  }

  isPosSubView(view: string): boolean {
    if (!this.isPosActive()) return false;
    return this.getPosViewFromUrl() === view.toLowerCase();
  }

  isPosActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/before-pos') || currentUrl.includes('/pos');
  }

  isPuntoVentaTabActive(): boolean {
    return this.isPosActive() || this.posSubmenuOpen;
  }

  togglePosSubmenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.posSubmenuOpen = !this.posSubmenuOpen;
  }

  closePosSubmenu(): void {
    this.posSubmenuOpen = false;
  }
}
