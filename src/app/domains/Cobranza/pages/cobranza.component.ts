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
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'cliente')">
          <a class="nav-link green-tab" routerLink="clientes" routerLinkActive="active"><i class="bi bi-people"></i><span>Clientes</span></a>
        </li>
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'cobr')">
          <a class="nav-link green-tab" routerLink="cobradores" routerLinkActive="active"><i class="bi bi-person-badge"></i><span>Cobradores</span></a>
        </li>
        <li class="nav-item" *ngIf="authService.hasDetailedPermission('cobranzas', 'dashboard')">
          <a class="nav-link green-tab" routerLink="dashboard" routerLinkActive="active"><i class="bi bi-speedometer2"></i><span>Dashboard</span></a>
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
