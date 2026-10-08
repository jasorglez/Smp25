import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';

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
      <div class="empty-message text-danger" *ngIf="loadError">{{ loadError }}</div>
      <div class="empty-message" *ngIf="!loading && !loadError && orders.length === 0">Este proyecto no tiene órdenes.</div>
      <ag-grid-angular
        *ngIf="!loading && orders.length > 0"
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; flex: 1; min-height: 0"
        [rowHeight]="20"
        [headerHeight]="25"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [rowData]="orders">
      </ag-grid-angular>
    </section>
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .project-orders-detail { height: 100%; box-sizing: border-box; padding: 5px 10px; background: #f8fafc; border-left: 3px solid #5a8fc5; overflow: hidden; display: flex; flex-direction: column; }
    .project-orders-title { height: 24px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; color: #334155; font-size: 12px; }
    .project-orders-title i { color: #1976d2; }
    .project-orders-title span { color: #64748b; }
    .empty-message { padding: 10px 0; font-size: 12px; color: #64748b; }
  `]
})
export class ProjectOrdersDetailComponent implements ICellRendererAngularComp {
  private otService = inject(OtService);
  private destroyRef = inject(DestroyRef);

  projectName = '';
  orders: any[] = [];
  loading = true;
  loadError = '';

  readonly defaultColDef: ColDef = { sortable: true, resizable: true, minWidth: 80 };
  readonly columnDefs: ColDef[] = [
    { field: 'cdc', headerName: 'CDC', width: 90 },
    { field: 'cuentaHoja', headerName: 'Hoja', width: 80 },
    { field: 'otNumber', headerName: 'Orden', width: 90 },
    { field: 'package', headerName: 'Paquete', width: 180, minWidth: 100, maxWidth: 220 },
    { field: 'area', headerName: 'Área', width: 360, minWidth: 300 },
    ...(['closed', 'closedApp'] as const).map((field, index): ColDef => ({
      field,
      headerName: index === 0 ? 'Cierre Web' : 'Cierre App',
      width: 115,
      cellDataType: 'boolean',
      valueFormatter: ({ value }) => value ? 'Sí' : 'No',
      cellStyle: ({ value }) => ({
        backgroundColor: value ? '#d1e7dd' : '#fff3cd',
        color: value ? '#0f5132' : '#664d03'
      })
    })),
    ...[
      ['photoCount', 'Fotos'], ['personalCount', 'Personal'],
      ['materialCount', 'Material'], ['equipmentCount', 'Equipos']
    ].map(([field, headerName]): ColDef => ({
      field, headerName, width: 105,
      valueFormatter: ({ value }) => value == null ? '—' : Number(value) > 0 ? `Sí (${Number(value)})` : 'No',
      cellStyle: ({ value }) => ({
        backgroundColor: value == null ? '#e2e3e5' : Number(value) > 0 ? '#d1e7dd' : '#f8d7da',
        color: value == null ? '#41464b' : Number(value) > 0 ? '#0f5132' : '#842029',
        fontWeight: '700'
      })
    }))
  ];

  agInit(params: ICellRendererParams): void {
    const project = params.data;
    this.projectName = project?.name || project?.number || `#${project?.id}`;

    this.otService.getProjectOrdersWithContent(Number(project?.id)).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: orders => {
        this.orders = orders;
        this.loading = false;
      },
      error: error => {
        console.error('Error cargando órdenes del proyecto:', error);
        this.loadError = 'No se pudieron cargar las órdenes del proyecto.';
        this.loading = false;
      }
    });
  }

  refresh(): boolean { return false; }

}
