import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { saveLastWarehouseRoute } from './warehouse-route-memory';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procwarehousesTD.component.html',
  styleUrl: './procwarehousesTD.component.scss',
})
export class ProcWarehousesTDComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private readonly router = inject(Router);
  private routeSubscription?: Subscription;

  ngOnInit(): void {
    this.routeSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => this.rememberWarehouseRoute(event.urlAfterRedirects || event.url));
    this.rememberWarehouseRoute(this.router.url);
    //this.signalsService.setCatalogSelected('SHOPPINGDELISON');
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  private rememberWarehouseRoute(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const match = cleanUrl.match(/^\/warehousesTD\/([^/]+)\/?$/);
    if (match) saveLastWarehouseRoute(this.signalsService, match[1]);
  }
}
