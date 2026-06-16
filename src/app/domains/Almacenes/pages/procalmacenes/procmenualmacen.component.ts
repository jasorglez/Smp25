import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procmenualmacen',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './procmenualmacen.component.html',
  styleUrl: './procmenualmacen.component.scss'
})
export class ProcmenualmacenComponent {
  private signalsService = inject(SignalsService);

  tabMenus = [
    { route: 'producto-terminado', icon: 'bi bi-box-seam',    permissionName: 'Productos Terminados' },
    { route: 'inventario',         icon: 'bi bi-clipboard2-data', permissionName: 'Inventario' },
  ];

  constructor() {
    this.signalsService.setCatalogSelected('WAREHOUSE');
  }
}
