import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-configuracion-prod',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="col-md-12">
      <div class="card mt-3">
        <div class="card-header p-2">
          <ul class="nav nav-pills nav-level-2">
            <li class="nav-item" *ngFor="let tab of tabs">
              <a class="nav-link" [class.active]="activeTab === tab.key" (click)="activeTab = tab.key" style="cursor:pointer;">
                {{ tab.label }}
              </a>
            </li>
          </ul>
        </div>
        <div class="card-body">
          <p *ngIf="activeTab === 'molienda'">Molienda — en construcción</p>
          <p *ngIf="activeTab === 'preparacion1'">Preparacion 1 — en construcción</p>
          <p *ngIf="activeTab === 'preparacion2'">Preparacion 2 — en construcción</p>
          <p *ngIf="activeTab === 'cerveza'">Cerveza — en construcción</p>
          <p *ngIf="activeTab === 'envasado'">Envasado — en construcción</p>
        </div>
      </div>
    </div>
  `,
})
export class ConfiguracionProdComponent {
  activeTab = 'molienda';

  tabs = [
    { key: 'molienda',     label: 'Molienda' },
    { key: 'preparacion1', label: 'Preparacion 1' },
    { key: 'preparacion2', label: 'Preparacion 2' },
    { key: 'cerveza',      label: 'Cerveza' },
    { key: 'envasado',     label: 'Envasado' },
  ];
}
