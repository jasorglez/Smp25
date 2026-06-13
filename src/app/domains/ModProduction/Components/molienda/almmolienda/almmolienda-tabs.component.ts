import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlmmoliendaComponent } from './almmolienda.component';

/**
 * Contenedor de pestañas para Almacén Molienda:
 *  - Materia Prima Básica → tabla existente (AlmmoliendaComponent).
 *  - Materia Prima de 1ra y 2da Fase → en construcción.
 */
@Component({
  selector: 'app-almmolienda-tabs',
  standalone: true,
  imports: [CommonModule, AlmmoliendaComponent],
  template: `
    <div class="container-fluid mt-2">
      <!-- Pestañas -->
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'basica'"
                  (click)="activeTab = 'basica'">
            Materia Prima Básica
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'fases'"
                  (click)="activeTab = 'fases'">
            Materia Prima de 1ra y 2da Fase
          </button>
        </li>
      </ul>

      <!-- Materia Prima Básica: tabla existente.
           Se mantiene en el DOM (hidden) para no perder estado al cambiar de pestaña. -->
      <div [hidden]="activeTab !== 'basica'">
        <app-almmolienda familiaFilter="BASICA"></app-almmolienda>
      </div>

      <!-- Materia Prima de 1ra y 2da Fase: en construcción -->
      <div *ngIf="activeTab === 'fases'" class="text-center py-5 text-muted">
        <i class="bi bi-tools fs-1 d-block mb-3"></i>
        <h5>En construcción</h5>
        <p class="small">Materia Prima de 1ra y 2da Fase — próximamente disponible</p>
      </div>
    </div>
  `,
})
export class AlmmoliendaTabsComponent {
  activeTab: 'basica' | 'fases' = 'basica';
}
