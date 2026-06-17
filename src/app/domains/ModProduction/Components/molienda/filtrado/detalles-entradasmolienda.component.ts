import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService } from 'app/services/molienda.service';

@Component({
  selector: 'app-detalles-entradasmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #e8f5e9;">
      <div style="margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #2e7d32;">Entradas de almacén</strong>
      </div>
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetallesEntradasMoliendaComponent {
  private moliendaService = inject(MoliendaService);
  private readonly cdr = inject(ChangeDetectorRef);

  private internalParams: any;
  private gridApi!: GridApi;

  rowData: any[] = [];

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 50,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 160,
      valueFormatter: (p) => {
        if (!p.value) return '';
        const d = p.value instanceof Date ? p.value : new Date(p.value);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      },
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      flex: 1,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? String(p.value) : '—',
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true },
  };

  agInit(params: any) {
    this.internalParams = params;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  
    this.cdr.detectChanges();}

  refresh(params: any): boolean {
    this.internalParams = params;
    return true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  async loadData() {
    const idMolienda = this.internalParams?.data?.idAlm;
    if (!idMolienda) {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }

    try {
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, 'ENTRADA'));
      this.rowData = (Array.isArray(items) ? items : []).map(d => ({
        id:       d.id,
        fecha:    d.fecha ? new Date(d.fecha as string) : null,
        cantidad: d.cantidad ?? 0,
      }));
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
    } catch (error) {
      console.error('Error cargando entradas molienda:', error);
    }
  
    this.cdr.detectChanges();}
}
