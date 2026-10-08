import { WorkspaceDraftsService } from 'app/services/workspace-drafts.service';
import { Component, inject } from '@angular/core';
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
             (click)="selectTab('egresos')"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-receipt me-1"></i>Egresos
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'xfechas'"
             (click)="selectTab('xfechas')"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-calendar-range me-1"></i>Egresos x Fechas
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link py-1 px-3"
             [class.active]="activeTab === 'todas'"
             (click)="selectTab('todas')"
             style="cursor:pointer; font-size:0.85rem;">
            <i class="bi bi-collection me-1"></i>Todas
          </a>
        </li>
      </ul>

      <!-- Contenido -->
      <app-expenditure     *ngIf="visited.has('egresos')" [hidden]="activeTab !== 'egresos'" [hideProjects]="true" />
      <app-egresosxfechas  *ngIf="visited.has('xfechas')" [hidden]="activeTab !== 'xfechas'" />
      <app-egresosxfechas  *ngIf="visited.has('todas')" [hidden]="activeTab !== 'todas'" [allAccounts]="true" />
    </div>
  `
})
export class EgresoShellComponent {
  private store = inject(WorkspaceDraftsService);
  private get key(): string { return this.store.key('expenditure/egreso-shell-tab:' + localStorage.getItem('company')); }
  activeTab: string = this.store.read<string>(this.key) || 'egresos';
  visited = new Set([this.activeTab]);
  selectTab(tab: string): void {
    this.visited.add(tab);
    this.activeTab = tab;
    this.store.write(this.key, tab);
  }
}
