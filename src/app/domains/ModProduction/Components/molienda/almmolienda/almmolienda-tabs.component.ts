import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlmmoliendaComponent } from './almmolienda.component';

/**
 * Contenedor de pestañas para Almacén Molienda:
 *  - Materia Prima Básica       → filtra familia='BASICA'
 *  - Materia Prima 1ra/2da Fase → filtra familias=['1RA FASE','2DA FASE']
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
                  (click)="setTab('basica')">
            Materia Prima Básica
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'fases'"
                  (click)="setTab('fases')">
            Materia Prima de 1ra y 2da Fase
          </button>
        </li>
      </ul>

      <!-- Básica: siempre en DOM para preservar estado (es la pestaña por defecto). -->
      <div [hidden]="activeTab !== 'basica'">
        <app-almmolienda familiaFilter="BASICA"></app-almmolienda>
      </div>

      <!-- Fases: se instancia la PRIMERA vez que el usuario abre la pestaña (tab ya visible),
           así autoSizeAllColumns funciona correctamente. Después se oculta con [hidden]. -->
      <div [hidden]="activeTab !== 'fases'">
        <app-almmolienda *ngIf="fasesInitialized"
                         [familiaFilter]="fasesFilter"
                         [entradasSimple]="true">
        </app-almmolienda>
      </div>
    </div>
  `,
})
export class AlmmoliendaTabsComponent {
  activeTab: 'basica' | 'fases' = 'basica';
  fasesInitialized = false;
  readonly fasesFilter = ['1RA FASE', '2DA FASE'];

  setTab(tab: 'basica' | 'fases') {
    if (tab === 'fases') this.fasesInitialized = true;
    this.activeTab = tab;
  }
}
