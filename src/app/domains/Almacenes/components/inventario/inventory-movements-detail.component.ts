import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-inventory-movements-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="movement-detail border rounded bg-white mx-2 my-2">
      <div class="d-flex align-items-center gap-2 px-2 py-1 bg-light border-bottom">
        <strong class="small"><i class="bi bi-clock-history me-1 text-primary"></i>Movimientos del material</strong>
        <span class="badge bg-secondary">{{ movements.length }}</span>
      </div>
      <div class="movement-scroll">
        <table class="table table-sm table-striped table-hover mb-0">
          <thead class="table-light">
            <tr>
              <th>Fecha</th>
              <th>Folio</th>
              <th>Movimiento</th>
              <th class="text-end">Entrada</th>
              <th class="text-end">Salida</th>
              <th class="text-end">Saldo</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let movement of movements">
              <td>{{ formatDate(movement.fecha) }}</td>
              <td>{{ movement.folio || '—' }}</td>
              <td>
                <span class="badge" [class.bg-success]="movement.tipo === 'IN'" [class.bg-danger]="movement.tipo === 'OUT'">
                  {{ movement.tipo === 'IN' ? 'Entrada' : 'Salida' }}
                </span>
              </td>
              <td class="text-end text-success">{{ formatQuantity(movement.entrada) }}</td>
              <td class="text-end text-danger">{{ formatQuantity(movement.salida) }}</td>
              <td class="text-end fw-semibold">{{ formatQuantity(movement.saldo) }}</td>
              <td class="text-truncate reference-cell" [title]="movement.referencia">{{ movement.referencia || '—' }}</td>
            </tr>
            <tr *ngIf="!movements.length">
              <td colspan="7" class="text-center text-muted py-3">Este material no tiene movimientos en el almacén seleccionado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; background: #f8fafc; }
    .movement-scroll { max-height: 205px; overflow: auto; }
    .table { font-size: 11px; min-width: 850px; }
    .table th { position: sticky; top: 0; z-index: 1; white-space: nowrap; }
    .reference-cell { max-width: 280px; }
  `],
})
export class InventoryMovementsDetailComponent implements ICellRendererAngularComp {
  movements: any[] = [];

  agInit(params: any): void {
    this.movements = Array.isArray(params?.data?.movements) ? params.data.movements : [];
  }

  refresh(params: any): boolean {
    this.agInit(params);
    return true;
  }

  formatDate(value: any): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-MX');
  }

  formatQuantity(value: any): string {
    return Number(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 4 });
  }
}
