import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MisCursosComponent } from './mis-cursos.component';
import { RegistrosCursosComponent } from './registros-cursos.component';
import { ConfigCursosComponent } from './config-cursos.component';

type Tab = 'mis-cursos' | 'registros' | 'config';

@Component({
  selector: 'app-cursos',
  standalone: true,
  imports: [CommonModule, MisCursosComponent, RegistrosCursosComponent, ConfigCursosComponent],
  template: `
    <div class="mt-2">
      <!-- Sub-nav -->
      <ul class="nav nav-tabs nav-tabs-sm mb-3">
        <li class="nav-item">
          <a class="nav-link" [class.active]="tab === 'mis-cursos'" (click)="tab = 'mis-cursos'" role="button">
            <i class="bi bi-mortarboard-fill me-1"></i> Mis Cursos
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" [class.active]="tab === 'registros'" (click)="tab = 'registros'" role="button">
            <i class="bi bi-person-lines-fill me-1"></i> Registros
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" [class.active]="tab === 'config'" (click)="tab = 'config'" role="button">
            <i class="bi bi-gear-fill me-1"></i> Configuración
          </a>
        </li>
      </ul>

      <app-mis-cursos      *ngIf="tab === 'mis-cursos'"></app-mis-cursos>
      <app-registros-cursos *ngIf="tab === 'registros'"></app-registros-cursos>
      <app-config-cursos   *ngIf="tab === 'config'"></app-config-cursos>
    </div>
  `,
})
export class CursosComponent {
  tab: Tab = 'mis-cursos';
}
