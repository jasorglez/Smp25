import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-detail-cell-renderer-comparison',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 12px; height: 100%; background: #f0f4ff;">

      <div *ngIf="loading" class="d-flex align-items-center justify-content-center gap-2 py-4">
        <div class="spinner-border spinner-border-sm text-primary"></div>
        <span class="text-muted small">Cargando cuadro comparativo...</span>
      </div>

      <ng-container *ngIf="!loading">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-table text-primary"></i>
          <strong class="text-primary small">Cuadro Comparativo de Precios</strong>
          <span class="badge bg-secondary">{{ rowData.length }} materiales</span>
        </div>

        <div *ngIf="rowData.length === 0" class="text-center text-muted py-3 small">
          <i class="bi bi-info-circle me-1"></i>
          Sin datos — los proveedores aún no han cotizado items.
        </div>

        <ag-grid-angular *ngIf="rowData.length > 0"
          style="width: 100%; height: 300px;"
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="innerGridOptions"
          [pinnedBottomRowData]="pinnedTotals"
          (gridReady)="onGridReady($event)"
        ></ag-grid-angular>
      </ng-container>

    </div>
  `
})
export class DetailCellRendererComparisonComponent implements ICellRendererAngularComp {
  private quotesService = inject(OcAndReqsService);

  loading = true;
  rowData: any[] = [];
  colDefs: ColDef[] = [];
  pinnedTotals: any[] = [];

  innerGridOptions: any = {
    headerHeight: 25,
    rowHeight: 42,
    suppressRowClickSelection: true,
    defaultColDef: { resizable: true, sortable: false }
  };

  agInit(params: any): void {
    this.loadData(params.data);
  }

  refresh(): boolean { return false; }

  onGridReady(event: GridReadyEvent) {
    event.api.sizeColumnsToFit();
  }

  private async loadData(rowData: any) {
    this.loading = true;

    const STYLES = [
      { bg: '#dbeafe', border: '#3b82f6' },
      { bg: '#dcfce7', border: '#22c55e' },
      { bg: '#fef9c3', border: '#eab308' },
    ];

    const providers = [
      { slot: 1, cotizId: rowData.proveedor1CotizId, name: rowData.proveedor1Name || 'Proveedor 1' },
      { slot: 2, cotizId: rowData.proveedor2CotizId, name: rowData.proveedor2Name || 'Proveedor 2' },
      { slot: 3, cotizId: rowData.proveedor3CotizId, name: rowData.proveedor3Name || 'Proveedor 3' },
    ].filter(p => p.cotizId > 0);

    try {
      const allItems: any[] = [];
      for (const prov of providers) {
        const items: any[] = await lastValueFrom(this.quotesService.getReqItems(prov.cotizId));
        items.forEach(item => allItems.push({ ...item, providerSlot: prov.slot }));
      }

      const productMap = new Map<number, any>();
      allItems.forEach(item => {
        if (!productMap.has(item.idSupplie)) {
          productMap.set(item.idSupplie, {
            productName: item.productName || item.description || `Producto ${item.idSupplie}`,
            p1: null, p2: null, p3: null
          });
        }
        const entry = productMap.get(item.idSupplie);
        entry[`p${item.providerSlot}`] = {
          price: item.price ?? 0,
          total: (item.quantity ?? 0) * (item.price ?? 0),
          quantity: item.quantity ?? 0
        };
      });

      this.rowData = Array.from(productMap.values());
      this.buildColDefs(providers, STYLES);
      this.buildPinnedTotals(providers);
    } catch (e) {
      console.error('Error loading comparison detail', e);
      this.rowData = [];
    }

    this.loading = false;
  }

  private buildColDefs(providers: any[], styles: any[]) {
    this.colDefs = [
      {
        headerName: '#',
        valueGetter: (p: any) => p.node?.rowPinned ? '' : (p.node?.rowIndex ?? 0) + 1,
        width: 50,
        pinned: 'left',
        cellStyle: { textAlign: 'center', color: '#999' }
      },
      {
        field: 'productName',
        headerName: 'Material',
        flex: 2,
        minWidth: 160,
        pinned: 'left',
        cellStyle: (p: any) => p.node?.rowPinned
          ? { fontWeight: 'bold', textAlign: 'right', paddingRight: '8px' }
          : {}
      }
    ];

    providers.forEach((prov, i) => {
      const slot = prov.slot;
      const style = styles[i] ?? styles[0];
      this.colDefs.push({
        headerName: prov.name,
        field: `p${slot}`,
        width: 75,
        cellRenderer: (params: any) => {
          if (params.node?.rowPinned) {
            const total = params.value ?? 0;
            return `<div style="text-align:right;padding:2px 6px;font-weight:bold;color:#155724;">
                      $${Number(total).toFixed(2)}
                    </div>`;
          }
          const data = params.value;
          if (!data) return '<span style="color:#bbb;font-size:10px;padding:2px 6px;">N/C</span>';
          const best   = this.isBestPrice(params.node?.data, slot);
          const color  = best ? '#155724' : '#555';
          const weight = best ? 'bold' : 'normal';
          const check  = best ? ' ✓' : '';
          return `<div style="text-align:right;padding:1px 6px;line-height:1.3;">
                    <div style="font-size:10px;color:#999;">$${Number(data.price).toFixed(2)} × ${data.quantity}</div>
                    <div style="font-weight:${weight};color:${color};">= $${Number(data.total).toFixed(2)}${check}</div>
                  </div>`;
        },
        cellStyle: (params: any) => {
          if (params.node?.rowPinned) {
            return { background: '#d4edda', borderLeft: `3px solid ${style.border}` };
          }
          return this.isBestPrice(params.data, slot)
            ? { background: '#d4edda', borderLeft: `3px solid ${style.border}` }
            : { background: style.bg };
        }
      });
    });
  }

  private buildPinnedTotals(providers: any[]) {
    const row: any = { productName: 'TOTAL' };
    providers.forEach(prov => {
      row[`p${prov.slot}`] = this.rowData.reduce(
        (sum, r) => sum + (r[`p${prov.slot}`]?.total ?? 0), 0
      );
    });
    this.pinnedTotals = [row];
  }

  private isBestPrice(rowData: any, slot: number): boolean {
    if (!rowData) return false;
    const prices = [rowData.p1?.price, rowData.p2?.price, rowData.p3?.price]
      .filter((p): p is number => p != null && p > 0);
    if (prices.length === 0) return false;
    return rowData[`p${slot}`]?.price === Math.min(...prices);
  }
}
