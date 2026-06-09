import { Component } from '@angular/core';
import { InventarioComponent } from 'app/domains/Almacenes/components/inventario/inventario.component';

@Component({
  selector: 'app-inventory-st',
  standalone: true,
  imports: [InventarioComponent],
  template: `<app-inventario></app-inventario>`,
})
export class InventoryStComponent {}
