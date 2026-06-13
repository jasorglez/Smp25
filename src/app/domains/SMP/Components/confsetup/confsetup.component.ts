import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confsetup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-header p-2">
      <ul class="nav nav-pills">
        <li class="nav-item">
          <a class="nav-link green-tab setup-dark-tab"
             [class.active]="selectedTab === 'branches'"
             (click)="selectedTab = 'branches'" style="cursor:pointer;">
            <i class="bi bi-building-fill-gear"></i> Sucursales
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link green-tab setup-dark-tab"
             [class.active]="selectedTab === 'users'"
             (click)="selectedTab = 'users'" style="cursor:pointer;">
            <i class="bi bi-person-bounding-box"></i> Usuarios
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link green-tab setup-dark-tab"
             [class.active]="selectedTab === 'roles'"
             (click)="selectedTab = 'roles'" style="cursor:pointer;">
            <i class="bi bi-people-fill"></i> Departamentos
          </a>
        </li>
      </ul>
    </div>

    <div class="d-flex flex-column align-items-center justify-content-center mt-4" style="min-height: 250px;">
      <ng-container *ngIf="selectedTab === 'branches'">
        <i class="bi bi-building-fill-gear text-secondary" style="font-size: 3rem;"></i>
        <h4 class="mt-3 text-secondary">Sucursales — En construcción</h4>
      </ng-container>
      <ng-container *ngIf="selectedTab === 'users'">
        <i class="bi bi-person-bounding-box text-secondary" style="font-size: 3rem;"></i>
        <h4 class="mt-3 text-secondary">Usuarios — En construcción</h4>
      </ng-container>
      <ng-container *ngIf="selectedTab === 'roles'">
        <i class="bi bi-people-fill text-secondary" style="font-size: 3rem;"></i>
        <h4 class="mt-3 text-secondary">Departamentos — En construcción</h4>
      </ng-container>
      <p class="text-muted">Este módulo estará disponible próximamente.</p>
    </div>
  `
})
export class ConfsetupComponent {
  selectedTab: string = 'branches';
}
