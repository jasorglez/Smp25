import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-cobranza',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="col-md-12"><div class="card">
      <div class="card-header px-2"><ul class="nav nav-pills">
        <li class="nav-item" *ngFor="let item of menuItems" [style.order]="item.order">
          <a class="nav-link green-tab" [routerLink]="item.path" routerLinkActive="active"><i class="bi" [ngClass]="item.icon"></i><span>{{ item.name }}</span></a>
        </li>
      </ul></div>
      <router-outlet></router-outlet>
    </div></div>
  `,
  styleUrl: '../../ModSales/pages/procsales/procsales.component.scss'
})
export class CobranzaComponent {
  authService = inject(AuthService);

  private readonly menuRoutes: Record<string, string> = {
    cliente: 'clientes',
    cobr: 'cobradores',
    cortecaja: 'corte-caja',
    aperturacaja: 'apertura-caja'
  };

  private readonly menuIcons: Record<string, string> = {
    cliente: 'bi-people',
    cobr: 'bi-person-badge',
    dashboard: 'bi-speedometer2',
    cortecaja: 'bi-calculator',
    aperturacaja: 'bi-unlock',
    cajas: 'bi-cash-stack'
  };

  get menuItems(): { identifier: string; name: string; order: number; path: string; icon: string }[] {
    const children = this.authService.getUserPermissions()?.cobranzas?.children || {};
    return Object.entries(children)
      .filter(([, permission]: [string, any]) => permission?.active === true)
      .map(([identifier, permission]: [string, any]) => ({
        identifier,
        name: permission.permissionName || permission.description || identifier,
        order: Number.isFinite(Number(permission.order)) ? Number(permission.order) : 10000,
        path: this.menuRoutes[identifier] || identifier,
        icon: this.menuIcons[identifier] || 'bi-grid'
      }))
      .sort((a, b) => a.order - b.order);
  }
}

@Component({
  selector: 'app-cobranza-en-construccion',
  standalone: true,
  template: `<div class="card-body"><h5>{{ title }}</h5><p>En construcción</p></div>`
})
export class CobranzaEnConstruccionComponent {
  title = inject(ActivatedRoute).snapshot.data['title'];
}
