import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CustomersService } from 'app/services/customers.service';

interface OcRow {
  id: number;
  folio: string;
  idProvider: number;
  providerName: string;
  datecreate: string;
  typeoc: string;
  conditions: string;
  countitem: number;
}

@Component({
  selector: 'app-ordenesydetallesoc',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background: #fff3e0;">
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">Órdenes de Compra del pedimento</strong>
      </div>

      <div
        [style.flex]="selectedOcRow && itemsData.length > 0 ? '0 0 58px' : '1 1 auto'"
        style="min-height: 58px; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (rowClicked)="onRowClicked($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <div *ngIf="selectedOcRow && itemsData.length > 0"
           style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #e67e22; background: #fff9e6;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #e67e22; margin-bottom: 3px; flex-shrink: 0;">
          Ítems de {{ selectedOcRow.folio }}
        </div>
        <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="itemsData"
            [columnDefs]="itemsColDefs"
            [gridOptions]="itemsGridOptions"
            (gridReady)="onItemsGridReady($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class OrdenesydetallesOcComponent {
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);

  private internalParams: any;
  private gridApi!: GridApi;
  private itemsGridApi!: GridApi;
  private providersLoaded = false;
  private gridReady = false;

  rowData: OcRow[] = [];
  itemsData: any[] = [];
  selectedOcRow: OcRow | null = null;
  providers: any[] = [];

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'folio',
      headerName: 'OC',
      width: 140,
      editable: false,
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        div.style.cssText = 'cursor:pointer;color:#d97706;text-decoration:underline;';
        div.textContent = params.value || '—';
        return div;
      },
    },
    {
      field: 'providerName',
      headerName: 'Proveedor',
      width: 250,
    },
    {
      field: 'datecreate',
      headerName: 'Fecha OC',
      width: 130,
      editable: false,
      valueFormatter: (p) => {
        if (!p.value) return '';
        const date = new Date(p.value);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      },
    },
    {
      field: 'typeoc',
      headerName: 'Tipo',
      width: 120,
    },
    {
      field: 'conditions',
      headerName: 'Condic. Compra',
      width: 140,
      cellStyle: { backgroundColor: '#e0f2f1' },
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'selected-row-highlight': (p: any) => p.data === this.selectedOcRow,
    },
    tooltipShowDelay: 300,
    defaultColDef: { resizable: true, sortable: true },
  };

  itemsColDefs: ColDef[] = [
    { field: 'numarticle', headerName: '# Item OC', width: 140 },
    { field: 'namearticle', headerName: 'Artículo', flex: 2, minWidth: 140 },
    { field: 'observation', headerName: 'Producto Externo', flex: 2, minWidth: 150 },
    { field: 'caducidad', headerName: 'Caducidad', width: 120 },
    { field: 'quantity', headerName: 'Cantidad Pedida', width: 130, type: 'numericColumn' },
    { field: 'price', headerName: 'Precio unitario', width: 140, type: 'numericColumn' },
    { field: 'total', headerName: 'Total', width: 120, type: 'numericColumn' },
    { field: 'dateuse', headerName: 'Fecha Entrada Almacén', width: 150 },
    { field: 'datepostpone', headerName: 'Fecha Entrega', width: 130 },
  ];

  itemsGridOptions: any = {
    headerHeight: 45,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true, wrapHeaderText: true, autoHeaderHeight: true },
  };

  agInit(params: any): void {
    this.internalParams = params;
    this.providersLoaded = false;
    this.loadProviders();
  }

  refresh(params: any): boolean {
    this.internalParams = params;
    return true;
  }

  private loadProviders() {
    this.customersService.getCustomersByCompany(this.internalParams?.data?.idCompany || 0, 'PROVIDERS').subscribe({
      next: (data: any) => {
        this.providers = (Array.isArray(data) ? data : []).map((p: any) => ({
          id: p.id,
          name: (p.name ?? '').trim() || (p.Description ?? p.description ?? '').trim() || `Proveedor ${p.id}`
        }));
        this.providersLoaded = true;
        this.tryLoadData();
      },
      error: () => {
        this.providers = [];
        this.providersLoaded = true;
        this.tryLoadData();
      }
    });
  }

  private tryLoadData(): void {
    if (this.gridReady && this.providersLoaded && this.gridApi && !this.gridApi.isDestroyed()) {
      this.loadData();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridReady = true;
    this.tryLoadData();
  }

  onItemsGridReady(params: GridReadyEvent) {
    this.itemsGridApi = params.api;
    if (this.itemsData.length) {
      this.itemsGridApi.setGridOption('rowData', this.itemsData);
    }
  }

  loadData() {
    const idPedimento = this.internalParams?.data?.idPedimento ?? this.internalParams?.data?.id;
    if (!idPedimento) {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', []);
      }
      return;
    }

    this.ocAndReqsService.getOcsByPedimento(idPedimento).subscribe({
      next: (ocs: any[]) => {
        this.rowData = (Array.isArray(ocs) ? ocs : []).map((oc: any) => {
          const provider = this.providers.find((p) => p.id === oc.idProvider || p.id === oc.id_provider);
          return {
            id: oc.id,
            folio: oc.folio || '',
            idProvider: oc.idProvider || oc.id_provider || 0,
            providerName: provider?.name || provider?.description || `Proveedor ${oc.idProvider || oc.id_provider}`,
            datecreate: oc.datecreate || oc.dateCreate || '',
            typeoc: oc.typeoc || oc.typeOc || '',
            conditions: oc.conditions || '',
            countitem: oc.countitem || oc.countrow || 0,
          };
        });

        if (this.gridApi && !this.gridApi.isDestroyed()) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      },
      error: (error) => {
        console.error('Error loading OCs:', error);
        this.rowData = [];
      },
    });
  }

  onRowClicked(event: any) {
    const row = event.data as OcRow;
    if (!row?.id) {
      this.selectedOcRow = null;
      this.itemsData = [];
      return;
    }

    if (this.selectedOcRow?.id === row.id) {
      this.selectedOcRow = null;
      this.itemsData = [];

      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => {
          node.setRowHeight(undefined);
        });
        this.gridApi.onRowHeightChanged();
        this.gridApi.refreshCells({ force: true });
      }
      return;
    }

    this.selectedOcRow = row;

    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data?.id === row.id) {
          node.setRowHeight(undefined);
        } else {
          node.setRowHeight(0);
        }
      });
      this.gridApi.onRowHeightChanged();
    }

    this.ocAndReqsService.getReqItems(row.id).subscribe({
      next: (items: any[]) => {
        this.itemsData = Array.isArray(items) ? items : [];
        if (this.itemsGridApi) {
          this.itemsGridApi.setGridOption('rowData', this.itemsData);
        }
      },
      error: () => {
        this.itemsData = [];
      },
    });

    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }
}
