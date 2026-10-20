import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-proc-precios-unitarios',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="card modern-card">
      <div class="card-header modern-header">
        <ul class="nav nav-pills modern-nav">
          <li class="nav-item" *ngIf="authService.hasDetailedPermission('preciosunitarios', 'preciosunitarios')">
            <a class="nav-link modern-tab" routerLink="catalogo" routerLinkActive="active">
              <i class="bi bi-currency-dollar"></i><span>Precios Unitarios</span>
            </a>
          </li>
          <li class="nav-item" *ngIf="authService.hasDetailedPermission('preciosunitarios', 'personal')">
            <a class="nav-link modern-tab" routerLink="personal" routerLinkActive="active">
              <i class="bi bi-person-badge"></i><span>Personal</span>
            </a>
          </li>
          <li class="nav-item" *ngIf="authService.hasDetailedPermission('preciosunitarios', 'equipos')">
            <a class="nav-link modern-tab" routerLink="equipos" routerLinkActive="active">
              <i class="bi bi-gear-wide-connected"></i><span>Equipos</span>
            </a>
          </li>
          <li class="nav-item" *ngIf="authService.hasDetailedPermission('preciosunitarios', 'materiales')">
            <a class="nav-link modern-tab" routerLink="materiales" routerLinkActive="active">
              <i class="bi bi-box-seam"></i><span>Materiales</span>
            </a>
          </li>
          <li class="nav-item" *ngIf="authService.hasDetailedPermission('preciosunitarios', 'herramientas')">
            <a class="nav-link modern-tab" routerLink="herramientas" routerLinkActive="active">
              <i class="bi bi-wrench-adjustable"></i><span>Herramientas</span>
            </a>
          </li>
          <li class="nav-item" *ngIf="authService.hasDetailedPermission('preciosunitarios', 'auxiliares')">
            <a class="nav-link modern-tab" routerLink="auxiliares" routerLinkActive="active">
              <i class="bi bi-layers"></i><span>Auxiliares</span>
            </a>
          </li>
        </ul>
        <div *ngIf="!hasSelectedMenu" class="py-4 text-center text-muted">
          <i class="bi bi-arrow-up-circle fs-4"></i>
          <div>Selecciona una opción del módulo.</div>
        </div>
        <router-outlet (activate)="hasSelectedMenu = true" (deactivate)="hasSelectedMenu = false"></router-outlet>
      </div>
    </div>
  `,
})
export class ProcPreciosUnitariosComponent {
  readonly authService = inject(AuthService);
  hasSelectedMenu = false;
}
