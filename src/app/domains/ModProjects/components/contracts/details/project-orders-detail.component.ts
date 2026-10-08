import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-project-orders-detail',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <section class="project-orders-detail">
      <div class="project-orders-title">
        <i class="bi bi-list-ul"></i>
        <strong>Órdenes de {{ projectName }}</strong>
        <span *ngIf="!loading">({{ orders.length }})</span>
        <span *ngIf="loading">Cargando...</span>
      </div>
      <div class="empty-message" *ngIf="!loading && orders.length === 0">Este proyecto no tiene órdenes.</div>
      <ag-grid-angular
        *ngIf="!loading && orders.length > 0"
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; height: 126px"
        [rowHeight]="20"
        [headerHeight]="25"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [rowData]="orders">
      </ag-grid-angular>
    </section>
  `,
  styles: [`
    .project-orders-detail { height: 100%; padding: 5px 10px; background: #f8fafc; border-left: 3px solid #5a8fc5; overflow: hidden; }
    .project-orders-title { height: 24px; display: flex; align-items: center; gap: 6px; color: #334155; font-size: 12px; }
    .project-orders-title i { color: #1976d2; }
    .project-orders-title span { color: #64748b; }
    .empty-message { padding: 10px 0; font-size: 12px; color: #64748b; }
  `]
})
export class ProjectOrdersDetailComponent implements ICellRendererAngularComp {
  private otService = inject(OtService);

  projectName = '';
  orders: any[] = [];
  loading = true;

  readonly defaultColDef: ColDef = { sortable: true, resizable: true, minWidth: 80 };
  readonly columnDefs: ColDef[] = [
    { field: 'cdc', headerName: 'CDC', width: 90 },
    { field: 'cuentaHoja', headerName: 'Hoja', width: 80 },
    { field: 'otNumber', headerName: 'Orden', width: 90 },
    { field: 'package', headerName: 'Paquete', flex: 1, minWidth: 150 },
    { field: 'area', headerName: 'Área', width: 120 },
    { field: 'closed', headerName: 'Estado', width: 95, valueFormatter: params => params.value ? 'Cerrada' : 'Abierta' }
  ];

  agInit(params: ICellRendererParams): void {
    const project = params.data;
    this.projectName = project?.name || project?.number || `#${project?.id}`;

    forkJoin({
      open: this.otService.getOtListByProject(Number(project?.id), false).pipe(catchError(() => of([]))),
      closed: this.otService.getOtListByProject(Number(project?.id), true).pipe(catchError(() => of([])))
    }).subscribe(({ open, closed }: any) => {
      const uniqueOrders = new Map<string, any>();
      [...this.toOrdersArray(open), ...this.toOrdersArray(closed)].forEach((order, index) => {
        uniqueOrders.set(String(order?.id ?? order?.otNumber ?? index), order);
      });
      this.orders = [...uniqueOrders.values()];
      this.loading = false;
    });
  }

  refresh(): boolean { return false; }

  private toOrdersArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.ots)) return response.ots;
    return [];
  }
}
