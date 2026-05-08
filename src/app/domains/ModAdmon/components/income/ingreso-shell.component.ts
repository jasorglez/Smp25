import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncomeComponent } from './income.component';
import { IngresosxfechasComponent } from './ingresosxfechas.component';

@Component({
  selector: 'app-ingreso-shell',
  standalone: true,
  imports: [CommonModule, IncomeComponent, IngresosxfechasComponent],
  template: `
    <div class="px-2 pt-2">
      <!-- Sub-tabs -->
      <ul class="nav nav-pills nav-sm mb-2 border-bottom pb-2">
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'ingresos'"
             (click)="activeTab = 'ingresos'"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-receipt me-1"></i>Ingresos
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'xfechas'"
             (click)="activeTab = 'xfechas'"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-calendar-range me-1"></i>Ingresos x Fechas
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'todas'"
             (click)="activeTab = 'todas'"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-collection me-1"></i>Todas
          </a>
        </li>
      </ul>

      <!-- Contenido -->
      <app-income            *ngIf="activeTab === 'ingresos'" />
      <app-ingresosxfechas   *ngIf="activeTab === 'xfechas'" />
      <app-ingresosxfechas   *ngIf="activeTab === 'todas'" [allAccounts]="true" />
    </div>
  `
})
export class IngresoShellComponent {
  activeTab: 'ingresos' | 'xfechas' | 'todas' = 'ingresos';
}
