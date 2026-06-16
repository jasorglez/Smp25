import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-procmenumolienda',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './procmenumolienda.component.html',
})
export class ProcmenumoliendaComponent {
  tabMenus = [
    { route: 'filtrado',        icon: 'bi bi-houses',        permissionName: 'Molienda' },
    { route: 'fermentacion',    icon: 'bi bi-boxes',         permissionName: 'Fermentacion' },
    { route: 'clarificacion1',  icon: 'bi bi-journal-text',  permissionName: 'Clarificacion 1' },
    { route: 'clarificacion2',  icon: 'bi bi-cart-fill',     permissionName: 'Clarificacion 2' },
    { route: 'envasado',        icon: 'bi bi-graph-up',      permissionName: 'Envasado' },
    { route: 'almmolienda',     icon: 'bi bi-box-seam',      permissionName: 'Almacen Molienda' },
    { route: 'ohbloque',        icon: 'bi bi-calendar2-week', permissionName: 'OH y Bloque' },
    { route: 'totalinventarios',icon: 'bi bi-clipboard-data',permissionName: 'Total Inventarios' },
  ];
}
