import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenditureComponent } from './expenditure.component';
import { EgresosxfechasComponent } from './egresosxfechas.component';

@Component({
  selector: 'app-egreso-shell',
  standalone: true,
  imports: [CommonModule, ExpenditureComponent, EgresosxfechasComponent],
  template: `
    <div class="px-2 pt-2">
      <!-- Sub-tabs -->
      <ul class="nav nav-pills nav-sm mb-2 border-bottom pb-2">
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'egresos'"
             (click)="activeTab = 'egresos'"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-receipt me-1"></i>Egresos
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'xfechas'"
             (click)="activeTab = 'xfechas'"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-calendar-range me-1"></i>Egresos x Fechas
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
      <app-expenditure     *ngIf="activeTab === 'egresos'" [hideProjects]="true" />
      <app-egresosxfechas  *ngIf="activeTab === 'xfechas'" />
      <app-egresosxfechas  *ngIf="activeTab === 'todas'" [allAccounts]="true" />
    </div>
  `
})
export class EgresoShellComponent {
  activeTab: 'egresos' | 'xfechas' | 'todas' = 'egresos';
}
