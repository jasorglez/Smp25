import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalles-bote-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #fff8e1;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #e65100;">Asignar bote</strong>
        <div class="d-flex gap-1">
          <button class="btn btn-xs btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasChanges">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-xs btn-warning" (click)="revert()">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetallesBoteFiltradoComponent {
  private productionService = inject(ProductionService);

  private idMolienda: number | null = null;
  private originalRowData: any[] = [];

  gridApi!: GridApi;
  rowData: any[] = [];
  hasChanges = false;

  colDefs: ColDef[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', color: '#495057' },
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    {
      field: 'jugo',
      headerName: 'Cantidad (Jugo)',
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', color: '#495057' },
      valueFormatter: (p: any) => p.value != null ? String(p.value) : '—',
    },
    {
      field: 'bote',
      headerName: 'Bote',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => p.value != null ? String(Number(p.value)) : '',
      valueSetter: (p: any) => {
        p.data.bote = p.newValue;
        p.data.resta = this.calcResta(p.data.jugo, p.newValue);
        p.data.__modified = true;
        this.hasChanges = true;
        return true;
      },
    },
    {
      field: 'resta',
      headerName: 'Resta',
      editable: false,
      cellStyle: (p: any) => ({
        backgroundColor: '#f8f9fa',
        color: p.value != null && p.value < 0 ? '#dc3545' : '#495057',
      }),
      valueFormatter: (p: any) => p.value != null ? String(Number(p.value).toFixed(2)) : '—',
    },
  ];

  gridOptions: any = {
    getRowId: (params: any) => String(params.data.id),
    headerHeight: 25,
    rowHeight: 22,
    autoSizeStrategy: { type: 'fitCellContents' },
    defaultColDef: { resizable: true },
  };

  agInit(params: any) {
    this.idMolienda = params?.data?.id ?? null;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  refresh(): boolean { return false; }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  private calcResta(jugo: number | null, bote: number | null): number | null {
    if (jugo == null || bote == null) return null;
    return jugo - bote;
  }

  async loadData() {
    if (!this.idMolienda) { this.rowData = []; return; }
    try {
      const items = await lastValueFrom(this.productionService.getMoliendaMatDetalleByMolienda(this.idMolienda));
      const mapped = (Array.isArray(items) ? items : []).map(i => ({
        id: i.id,
        fecha: i.fechaMolienda ? String(i.fechaMolienda).split('T')[0] : null,
        jugo: i.jugo ?? null,
        bote: i.bote ?? null,
        resta: this.calcResta(i.jugo ?? null, i.bote ?? null),
        __modified: false,
      }));
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = mapped;
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', mapped);
    } catch (e) {
      console.error('Error cargando botes:', e);
    }
  }

  async saveChanges() {
    const modRows = this.rowData.filter(r => r.__modified);
    if (!modRows.length) return;
    try {
      for (const row of modRows) {
        await lastValueFrom(this.productionService.patchMoliendaMatDetalleBote(row.id, row.bote ?? null));
        row.__modified = false;
      }
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges = false;
      alerts.reqSuccessToast('Guardado');
    } catch (e) {
      console.error('Error guardando bote:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', this.rowData);
  }
}
