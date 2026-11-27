import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-inventory-movements-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="movement-detail border rounded bg-white mx-2 my-2">
      <div class="d-flex align-items-center gap-2 px-2 py-1 bg-light border-bottom">
        <strong class="small"><i class="bi bi-clock-history me-1 text-primary"></i>{{ 'modules.warehouses.ui.inventoryDetail.title' | translate }}</strong>
        <span class="badge bg-secondary">{{ movements.length }}</span>
      </div>
      <div class="movement-scroll">
        <table class="table table-sm table-striped table-hover mb-0">
          <thead class="table-light">
            <tr>
              <th>{{ 'modules.warehouses.ui.inventoryDetail.date' | translate }}</th>
              <th>{{ 'modules.warehouses.ui.inventoryDetail.reference' | translate }}</th>
              <th>{{ 'modules.warehouses.ui.inventoryDetail.movement' | translate }}</th>
              <th class="text-end">{{ 'modules.warehouses.ui.inventoryDetail.receipt' | translate }}</th>
              <th class="text-end">{{ 'modules.warehouses.ui.inventoryDetail.issue' | translate }}</th>
              <th class="text-end">{{ 'modules.warehouses.ui.inventoryDetail.balance' | translate }}</th>
              <th>{{ 'modules.warehouses.ui.inventoryDetail.note' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let movement of movements">
              <td>{{ formatDate(movement.fecha) }}</td>
              <td>{{ movement.folio || '—' }}</td>
              <td>
                <span class="badge" [class.bg-success]="movement.tipo === 'IN'" [class.bg-danger]="movement.tipo === 'OUT'">
                  {{ movement.tipo === 'IN' ? ('modules.warehouses.ui.inventoryDetail.receipt' | translate) : ('modules.warehouses.ui.inventoryDetail.issue' | translate) }}
                </span>
              </td>
              <td class="text-end text-success">{{ formatQuantity(movement.entrada) }}</td>
              <td class="text-end text-danger">{{ formatQuantity(movement.salida) }}</td>
              <td class="text-end fw-semibold">{{ formatQuantity(movement.saldo) }}</td>
              <td class="text-truncate reference-cell" [title]="movement.referencia">{{ movement.referencia || '—' }}</td>
            </tr>
            <tr *ngIf="!movements.length">
              <td colspan="7" class="text-center text-muted py-3">{{ 'modules.warehouses.ui.inventoryDetail.noMovements' | translate }}</td>
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
  private translate = inject(TranslateService);
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
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX');
  }

  formatQuantity(value: any): string {
    return Number(value || 0).toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX', { maximumFractionDigits: 4 });
  }
}
