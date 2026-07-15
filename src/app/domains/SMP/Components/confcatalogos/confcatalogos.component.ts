import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CostosProductoTerminadoComponent } from './costos-producto-terminado/costos-producto-terminado.component';

@Component({
  selector: 'app-confcatalogos',
  standalone: true,
  imports: [CommonModule, CostosProductoTerminadoComponent],
  template: `
    <div class="p-2">
      <!-- Pestañas de catálogos (extensible) -->
      <ul class="nav nav-tabs mb-2">
        <li class="nav-item">
          <a class="nav-link" [class.active]="tab === 'costos'" (click)="tab = 'costos'" role="button">
            Costos y Mapeo de Producto Terminado
          </a>
        </li>
      </ul>

      <app-costos-producto-terminado *ngIf="tab === 'costos'"></app-costos-producto-terminado>
    </div>
  `
})
export class ConfcatalogosComponent {
  tab: 'costos' = 'costos';
}
