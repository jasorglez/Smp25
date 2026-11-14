import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-cobradores-cobranza-detail',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <section class="detail-panel">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
        <div><strong class="text-primary">Cobros realizados</strong><small class="text-muted ms-2">{{ payments.length }} movimientos</small></div>
        <span class="badge rounded-pill text-bg-primary">Total {{ total | currency:'MXN' }}</span>
      </div>
      <ag-grid-angular *ngIf="payments.length" class="ag-theme-quartz small-text-ag-grid d-block" style="width:100%;height:230px"
        [rowData]="payments" [columnDefs]="columns" [defaultColDef]="defaultColDef" [localeText]="localeText">
      </ag-grid-angular>
      <div *ngIf="!payments.length" class="empty-detail text-center text-muted py-4">Este usuario todavía no tiene cobros registrados.</div>
    </section>
  `,
  styles: [':host { display:block; padding:8px 22px 14px; background:#f7faff; } .detail-panel { padding:12px; border:1px solid #dce8f5; border-radius:10px; background:#fff; } .empty-detail { border:1px dashed #cbd8e6; border-radius:8px; background:#f8fbff; font-size:.8rem; }']
})
export class CobradoresCobranzaDetailComponent implements ICellRendererAngularComp {
  payments: any[] = [];
  total = 0;
  readonly localeText = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 120, suppressHeaderMenuButton: true };
  readonly columns: ColDef[] = [
    { field: 'fechaPago', headerName: 'Fecha', minWidth: 140, valueFormatter: params => params.value ? new Date(`${String(params.value).slice(0, 10)}T00:00:00`).toLocaleDateString('es-MX') : '—' },
    { field: 'cliente', headerName: 'Cliente', minWidth: 190 },
    { field: 'prestamo', headerName: 'Préstamo', minWidth: 105 },
    { field: 'cuota', headerName: 'Letra', minWidth: 90 },
    { field: 'monto', headerName: 'Monto', minWidth: 130, valueFormatter: params => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(params.value || 0)) },
    { field: 'tipoPago', headerName: 'Tipo de pago', minWidth: 125 },
    { field: 'origen', headerName: 'Recibido en', minWidth: 150 },
    { field: 'comentario', headerName: 'Comentario', minWidth: 180 }
  ];

  agInit(params: ICellRendererParams): void {
    this.payments = params.data?.cobros || [];
    this.total = this.payments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0);
  }

  refresh(params: ICellRendererParams): boolean { this.agInit(params); return true; }
}
