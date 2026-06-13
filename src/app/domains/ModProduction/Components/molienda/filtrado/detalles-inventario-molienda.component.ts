import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService } from 'app/services/molienda.service';

@Component({
  selector: 'app-detalles-inventario-molienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #f5f5f5;">
      <div style="margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #333;">Historial de Entradas y Salidas</strong>
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
export class DetallesInventarioMoliendaComponent {
  private moliendaService = inject(MoliendaService);

  private internalParams: any;
  private gridApi!: GridApi;

  rowData: any[] = [];

  colDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Folio',
      width: 80,
      cellStyle: { backgroundColor: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }
    },
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold', textAlign: 'center' }
    },
    {
      field: 'tipo',
      headerName: 'Tipo',
      flex: 1.2,
      minWidth: 120,
      cellStyle: (params: any) => {
        if (params.data?.tipo === 'ENTRADA') {
          return { backgroundColor: '#c8e6c9', color: '#2e7d32', fontWeight: 'bold', textAlign: 'center' };
        } else if (params.data?.tipo === 'SALIDA') {
          return { backgroundColor: '#ffcccc', color: '#c62828', fontWeight: 'bold', textAlign: 'center' };
        }
        return { textAlign: 'center' };
      },
      valueFormatter: (p) => {
        if (p.value === 'ENTRADA') return '📥 ENTRADA';
        if (p.value === 'SALIDA') return '📤 SALIDA';
        return p.value;
      }
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      flex: 1,
      minWidth: 110,
      cellStyle: { textAlign: 'center' },
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
      flex: 0.9,
      minWidth: 100,
      type: 'numericColumn',
      cellStyle: { textAlign: 'right', paddingRight: '10px' },
      valueFormatter: (p) => p.value != null ? String(Number(p.value).toFixed(2)) : '—',
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
  }

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
      const [entradas, salidas] = await Promise.all([
        lastValueFrom(this.moliendaService.getDetails(idMolienda, 'ENTRADA')),
        lastValueFrom(this.moliendaService.getDetails(idMolienda, 'SALIDA')),
      ]);

      const entradasMapped = (Array.isArray(entradas) ? entradas : []).map(d => ({
        id:       d.id,
        tipo:     'ENTRADA',
        fecha:    d.fecha ? new Date(d.fecha as string) : null,
        cantidad: d.cantidad ?? 0,
      }));

      const salidasMapped = (Array.isArray(salidas) ? salidas : []).map(d => ({
        id:       d.id,
        tipo:     'SALIDA',
        fecha:    d.fecha ? new Date(d.fecha as string) : null,
        cantidad: d.cantidad ?? 0,
      }));

      this.rowData = [...entradasMapped, ...salidasMapped].sort((a, b) => {
        const fechaA = a.fecha?.getTime() ?? 0;
        const fechaB = b.fecha?.getTime() ?? 0;
        return fechaA - fechaB;
      });

      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
    } catch (error) {
      console.error('Error cargando detalles de inventario:', error);
    }
  }
}
