import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-total-inventarios',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container-fluid mt-3">
      <!-- Pestañas -->
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'materiaprima'"
                  (click)="activeTab = 'materiaprima'">
            Materia Prima
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'materianoproima'"
                  (click)="activeTab = 'materianoproima'">
            Materia No Prima
          </button>
        </li>
      </ul>

      <!-- Contenido -->
      <div *ngIf="activeTab === 'materiaprima'" class="text-center py-5 text-muted">
        <i class="bi bi-tools fs-1 d-block mb-3"></i>
        <h5>En construcción</h5>
        <p class="small">Materia Prima — próximamente disponible</p>
      </div>

      <div *ngIf="activeTab === 'materianoproima'" class="text-center py-5 text-muted">
        <i class="bi bi-tools fs-1 d-block mb-3"></i>
        <h5>En construcción</h5>
        <p class="small">Materia No Prima — próximamente disponible</p>
      </div>
    </div>
  `,
})
export class TotalInventariosComponent {
  activeTab: 'materiaprima' | 'materianoproima' = 'materiaprima';
}
