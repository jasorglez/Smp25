import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashAdmonComponent } from './components/dash-admon.component';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DashAdmonComponent],
  template: `
    <div class="dashboard-wrapper">
      <div class="dashboard-body">
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

      <footer class="dashboard-publicidad-footer">
        <a routerLink="/publicidad" class="dashboard-publicidad-link">
          <i class="bi bi-megaphone-fill" aria-hidden="true"></i>
          <span>Publicidad</span>
          <span class="dashboard-publicidad-hint">Novedades y anuncios de la empresa</span>
          <i class="bi bi-chevron-right dashboard-publicidad-chevron" aria-hidden="true"></i>
        </a>
      </footer>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      min-height: calc(100vh - 88px);
      display: flex;
      flex-direction: column;
      background: #f8f9fa;
    }
    .dashboard-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .tab-content {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
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
    .dashboard-publicidad-footer {
      flex-shrink: 0;
      margin-top: auto;
      border-top: 1px solid #dee2e6;
      background: #fff;
    }
    .dashboard-publicidad-link {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.5rem 0.75rem;
      padding: 12px 18px;
      color: #0e4491;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .dashboard-publicidad-link:hover {
      background: #eef3fb;
      color: #0a3570;
    }
    .dashboard-publicidad-hint {
      font-size: 0.8rem;
      font-weight: 500;
      color: #6c757d;
    }
    .dashboard-publicidad-chevron {
      font-size: 0.9rem;
      opacity: 0.7;
    }
  `]
})
export class DashboardHomeComponent {
  activeTab: string = 'admon';
}
