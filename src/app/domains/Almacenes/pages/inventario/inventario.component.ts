import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

/**
 * Página "Inventario" (tab de Almacenes). Sub-nav hardcodeado: por ahora un único
 * submenú "Inventario materia prima". Futuros inventarios se agregan a `subTabs`.
 */
@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: `
    <div class="col-md-12">
      <div class="card mt-3">
        <div class="card-header p-2">
          <ul class="nav nav-pills nav-level-2">
            <li class="nav-item" *ngFor="let tab of subTabs">
              <a class="nav-link" [routerLink]="tab.route" routerLinkActive="active">
                <i [class]="tab.icon"></i> {{ tab.label }}
              </a>
            </li>
          </ul>

          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
})
export class InventarioComponent {
  subTabs = [
    { label: 'Inventario materia prima', route: 'materia-prima', icon: 'bi bi-clipboard-data' },
  ];
}
