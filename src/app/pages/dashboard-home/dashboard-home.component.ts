import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashAdmonComponent } from './components/dash-admon.component';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, DashAdmonComponent],
  template: `
    <div class="dashboard-wrapper">

      <!-- Pestañas -->
      <ul class="nav nav-tabs px-3 pt-2">
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'admon'" (click)="activeTab = 'admon'">
            <i class="bi bi-bar-chart-line me-1"></i> Administración
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'proyectos'" (click)="activeTab = 'proyectos'">
            <i class="bi bi-kanban me-1"></i> Proyectos
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'almacenes'" (click)="activeTab = 'almacenes'">
            <i class="bi bi-box-seam me-1"></i> Almacenes
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'ventas'" (click)="activeTab = 'ventas'">
            <i class="bi bi-cart3 me-1"></i> Ventas
          </button>
        </li>
      </ul>

      <!-- Contenido -->
      <div class="tab-content p-2">
        <ng-container *ngIf="activeTab === 'admon'">
          <app-dash-admon />
        </ng-container>
        <ng-container *ngIf="activeTab === 'proyectos'">
          <div class="p-4 text-muted">Dashboard Proyectos — próximamente.</div>
        </ng-container>
        <ng-container *ngIf="activeTab === 'almacenes'">
          <div class="p-4 text-muted">Dashboard Almacenes — próximamente.</div>
        </ng-container>
        <ng-container *ngIf="activeTab === 'ventas'">
          <div class="p-4 text-muted">Dashboard Ventas — próximamente.</div>
        </ng-container>
      </div>

    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      height: 100%;
      background: #f8f9fa;
    }
    .nav-tabs {
      background: #fff;
      border-bottom: 2px solid #dee2e6;
    }
    .nav-link {
      border: none;
      color: #6c757d;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 0;
      cursor: pointer;
      background: transparent;
    }
    .nav-link.active {
      color: #2980b9;
      border-bottom: 3px solid #2980b9;
      background: transparent;
    }
    .nav-link:hover:not(.active) {
      color: #343a40;
      background: #f0f4ff;
    }
  `]
})
export class DashboardHomeComponent {
  activeTab: string = 'admon';
}
