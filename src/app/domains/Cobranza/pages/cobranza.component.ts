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
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'cliente')" [style.order]="authService.getDetailedPermissionOrder('cobranzas', 'cliente')">
          <a class="nav-link green-tab" routerLink="clientes" routerLinkActive="active"><i class="bi bi-people"></i><span>Clientes</span></a>
        </li>
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'cobr')" [style.order]="authService.getDetailedPermissionOrder('cobranzas', 'cobr')">
          <a class="nav-link green-tab" routerLink="cobradores" routerLinkActive="active"><i class="bi bi-person-badge"></i><span>Cobradores</span></a>
        </li>
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'dashboard')" [style.order]="authService.getDetailedPermissionOrder('cobranzas', 'dashboard')">
          <a class="nav-link green-tab" routerLink="dashboard" routerLinkActive="active"><i class="bi bi-speedometer2"></i><span>Dashboard</span></a>
        </li>
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'cortecaja')" [style.order]="authService.getDetailedPermissionOrder('cobranzas', 'cortecaja')">
          <a class="nav-link green-tab" routerLink="corte-caja" routerLinkActive="active"><i class="bi bi-calculator"></i><span>Corte Caja</span></a>
        </li>
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'aperturacaja')" [style.order]="authService.getDetailedPermissionOrder('cobranzas', 'aperturacaja')">
          <a class="nav-link green-tab" routerLink="apertura-caja" routerLinkActive="active"><i class="bi bi-unlock"></i><span>Apertura Caja</span></a>
        </li>
      </ul></div>
      <router-outlet></router-outlet>
    </div></div>
  `,
  styleUrl: '../../ModSales/pages/procsales/procsales.component.scss'
})
export class CobranzaComponent {
  authService = inject(AuthService);
}

@Component({
  selector: 'app-cobranza-en-construccion',
  standalone: true,
  template: `<div class="card-body"><h5>{{ title }}</h5><p>En construcción</p></div>`
})
export class CobranzaEnConstruccionComponent {
  title = inject(ActivatedRoute).snapshot.data['title'];
}
