import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';

@Component({
  selector: 'app-project-orders-detail',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <section class="project-orders-detail">
      <div class="d-flex align-items-center gap-2 mb-2">
        <i class="bi bi-card-checklist text-primary"></i>
        <strong>Órdenes del proyecto: {{ projectName }}</strong>
        <span class="text-muted small" *ngIf="!loading">({{ orders.length }})</span>
      </div>
      <div class="text-muted small py-3" *ngIf="loading">Cargando órdenes...</div>
      <div class="text-muted small py-3" *ngIf="!loading && error">No se pudieron cargar las órdenes de este proyecto.</div>
      <div class="text-muted small py-3" *ngIf="!loading && !error && orders.length === 0">Este proyecto no tiene órdenes.</div>
      <ag-grid-angular
        *ngIf="!loading && !error && orders.length > 0"
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; height: 205px"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [rowData]="orders"
        [pagination]="true"
        [paginationPageSize]="5">
      </ag-grid-angular>
    </section>
  `,
  styles: [`
    .project-orders-detail { height: 100%; padding: 10px 14px; background: #f8fafc; border-left: 3px solid #5a8fc5; }
  `]
})
export class ProjectOrdersDetailComponent implements ICellRendererAngularComp {
  private otService = inject(OtService);

  projectName = '';
  orders: any[] = [];
  loading = true;
  error = false;

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, minWidth: 100 };
  readonly columnDefs: ColDef[] = [
    { field: 'cdc', headerName: 'CDC', width: 100 },
    { field: 'cuentaHoja', headerName: 'Hoja', width: 100 },
    { field: 'otNumber', headerName: 'Orden', width: 110 },
    { field: 'package', headerName: 'Paquete', flex: 1, minWidth: 180 },
    { field: 'area', headerName: 'Área', width: 140 },
    { field: 'closed', headerName: 'Estado', width: 120, valueFormatter: params => params.value ? 'Cerrada' : 'Abierta' }
  ];

  agInit(params: ICellRendererParams): void {
    const project = params.data;
    this.projectName = project?.name || project?.number || `#${project?.id}`;
    this.otService.getOtListByProject(Number(project?.id), false).subscribe({
      next: (response: any) => {
        this.orders = Array.isArray(response) ? response : response?.data || response?.ots || [];
        this.loading = false;
      },
      error: error => {
        console.error('Error loading project orders:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  refresh(): boolean { return false; }
}
