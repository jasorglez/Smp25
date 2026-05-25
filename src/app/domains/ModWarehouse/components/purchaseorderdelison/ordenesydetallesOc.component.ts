import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CustomersService } from 'app/services/customers.service';
import { SetupOcService } from 'app/services/setup-oc.service';
import { ConditionsPendingService } from 'app/services/conditions-pending.service';
import { SignalsService } from 'app/services/signals.service';
import { lastValueFrom } from 'rxjs';

interface OcRow {
  id: number;
  folio: string;
  idProvider: number;
  providerName: string;
  datecreate: string;
  typeoc: string;
  conditions: string;
  countitem: number;
  idReq?: number;
  numCotizacion?: string;
  condicionesPago?: string;
  totalOc?: number;
  anticipoOc?: number;
}

interface TooltipItem {
  articulo: string;
  cantidadRequerida: number;
  cantidadXProv: number;
}

interface OcTooltipData {
  typeoc: string;
  items: TooltipItem[];
}

@Component({
  selector: 'app-ordenesydetallesoc',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
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
          (firstDataRendered)="onFirstDataRendered($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <div *ngIf="selectedOcRow && itemsData.length > 0"
           [style.flex]="selectedArticleRow ? '0 0 115px' : '1 1 auto'"
           style="min-height: 0; border-top: 2px solid #e67e22;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; flex-shrink: 0;">
          <span style="font-size: 0.78rem; font-weight: bold; color: #e67e22;">Ítems de {{ selectedOcRow.folio }}</span>
          <button [disabled]="!hasLocalChanges"
                  (click)="revertLocalChanges()"
                  style="font-size: 0.7rem; padding: 1px 7px; border: 1px solid #e67e22; border-radius: 4px;
                         background: #fff3e0; color: #e67e22; cursor: pointer; line-height: 1.6;">
            <i class="bi bi-arrow-counterclockwise"></i> Deshacer
          </button>
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

      <div *ngIf="selectedArticleRow"
           style="flex: 0 0 220px; min-height: 0; border-top: 2px solid #2e7d32;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #2e7d32; margin-bottom: 3px; flex-shrink: 0;">
          Detalle de {{ selectedArticleRow.namearticle }}
        </div>
        <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="nivel3Data"
            [columnDefs]="nivel3ColDefs"
            [gridOptions]="nivel3GridOptions"
            (gridReady)="onNivel3GridReady($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class OrdenesydetallesOcComponent implements OnDestroy {
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);
  private setupOcService = inject(SetupOcService);
  private conditionsPendingService = inject(ConditionsPendingService);
  private signalsService = inject(SignalsService);

  private internalParams: any;
  private gridApi!: GridApi;
  private itemsGridApi!: GridApi;
  private providersLoaded = false;
  private gridReady = false;

  rowData: OcRow[] = [];
  itemsData: any[] = [];
  selectedOcRow: OcRow | null = null;
  providers: any[] = [];
  conditionsOptions: number[] = [];
  hasLocalChanges = false;
  selectedArticleRow: any = null;
  nivel3Data: any[] = [];

  private originalItemsData: any[] = [];
  private changedItemIds = new Set<number>();
  private nivel3GridApi!: GridApi;

  // Cache de datos para tooltip por OC id
  private ocTooltipDataMap: Map<number, OcTooltipData> = new Map();
  // Tooltip flotante DOM element
  private tooltipEl: HTMLDivElement | null = null;

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
      cellStyle: { backgroundColor: '#c8e6c9' },
      onCellClicked: (params: any) => this.onRowClicked(params),
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        div.style.cssText = 'cursor:pointer;';
        div.textContent = params.value || '—';
        const ocId = Number(params.data?.id);
        if (ocId) {
          div.addEventListener('mouseenter', (ev: MouseEvent) => this.showOcTooltip(ev, ocId));
          div.addEventListener('mousemove', (ev: MouseEvent) => this.moveOcTooltip(ev));
          div.addEventListener('mouseleave', () => this.hideOcTooltip());
        }
        return div;
      },
    },
    {
      field: 'providerName',
      headerName: 'Proveedor',
      width: 250,
      tooltipValueGetter: (params) => `${params.data.providerName} (ID: ${params.data.idProvider})`
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
      field: 'numCotizacion',
      headerName: '# Cotizacion',
      width: 130,
    },
    {
      field: 'condicionesPago',
      headerName: 'Condiciones Pago',
      width: 160,
    },
    {
      field: 'totalOc',
      headerName: 'Total x OC',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => {
        const n = Number(p.value);
        return Number.isFinite(n)
          ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
          : '';
      },
    },
    {
      field: 'anticipoOc',
      headerName: 'Anticipo OC',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => {
        const n = Number(p.value);
        return Number.isFinite(n) && n > 0
          ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
          : '';
      },
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
    {
      field: 'conditions',
      headerName: 'Cantidad Entregas',
      width: 140,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: () => ({ values: this.conditionsOptions }),
      valueParser: (p) => { const n = Number(p.newValue); return isNaN(n) ? p.oldValue : n; },
    },
    { field: 'numarticle', headerName: '# Item OC', width: 140, hide: true },
    {
      field: 'namearticle',
      headerName: 'Artículo',
      flex: 2,
      minWidth: 140,
      cellStyle: (p: any) => {
        const cond = Number(p.data?.conditions);
        const min = this.conditionsOptions.length ? this.conditionsOptions[0] : 1;
        return !isNaN(cond) && cond > min
          ? { backgroundColor: '#c8e6c9', cursor: 'pointer' }
          : null;
      },
      onCellClicked: (p: any) => {
        const cond = Number(p.data?.conditions);
        const min = this.conditionsOptions.length ? this.conditionsOptions[0] : 1;
        if (!isNaN(cond) && cond > min) {
          this.openNivel3(p.data);
        }
      },
    },
    { field: 'observation', headerName: 'Producto Externo', flex: 2, minWidth: 150 },
    { field: 'typeoc', headerName: 'Tipo', width: 120, hide: true },
    { field: 'quantity', headerName: 'Cantidad Pedida', width: 130, type: 'numericColumn' },
    { field: 'price', headerName: 'Precio unitario', width: 140, type: 'numericColumn' },
    { field: 'total', headerName: 'Total', width: 120, type: 'numericColumn' },
    {
      field: 'notaFactura',
      headerName: 'Nota / Factura',
      width: 150,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: { values: ['Nota', 'Factura'] },
    },
    { field: 'caducidadMinimaRequerida', headerName: 'Caducidad Minima Requerida', width: 180 },
    { field: 'datepostpone', headerName: 'Fecha Entrega', width: 130,
      valueFormatter: (p) => {
        if (!p.value) return '';
        const date = new Date(p.value);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      }
    },
    { field: 'dateuse', headerName: 'Fecha Entrada Almacén', width: 150 },
    {
      headerName: 'PDF',
      width: 60,
      sortable: false,
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        div.style.cssText = 'text-align: center; cursor: pointer;';
        div.innerHTML = '<i class="bi bi-file-pdf" style="color: #d32f2f; font-size: 1.2rem;" title="Descargar PDF"></i>';
        return div;
      },
    },
  ];

  itemsGridOptions: any = {
    headerHeight: 45,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true, wrapHeaderText: true, autoHeaderHeight: true },
    onCellValueChanged: (event: any) => {
      if (event.colDef.field === 'conditions' && event.data?.id) {
        const { conditions, ...cleanItem } = event.data;
        this.conditionsPendingService.add(event.data.id, cleanItem, Number(event.newValue));
        this.changedItemIds.add(event.data.id);
        this.hasLocalChanges = true;
        event.api.refreshCells({ rowNodes: [event.node], columns: ['namearticle'], force: true });

        const min = this.conditionsOptions.length ? this.conditionsOptions[0] : 1;
        const newCond = Number(event.newValue);
        if (event.data === this.selectedArticleRow) {
          if (newCond <= min) {
            this.closeNivel3();
          } else {
            this.buildNivel3Grid(event.data, true);
          }
        }
      }
    },
  };

  nivel3ColDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'fechaEntrega',
      headerName: 'Fecha Entrega',
      width: 130,
      editable: true,
    },
    {
      field: 'cantidadRecibir',
      headerName: 'Cantidad a Recibir',
      width: 150,
      editable: true,
      type: 'numericColumn',
      valueParser: (p) => { const n = Number(p.newValue); return isNaN(n) ? p.oldValue : n; },
    },
    {
      field: 'notaFactura',
      headerName: 'Nota / Factura',
      flex: 1,
      minWidth: 140,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: { values: ['Nota', 'Factura'] },
    },
    {
      field: 'totalEntrega',
      headerName: 'Total x Entrega',
      width: 140,
      editable: true,
      type: 'numericColumn',
      valueParser: (p) => { const n = Number(p.newValue); return isNaN(n) ? p.oldValue : n; },
    },
    {
      headerName: 'PDF',
      width: 60,
      sortable: false,
      cellRenderer: (_params: any) => {
        const div = document.createElement('div');
        div.style.cssText = 'text-align: center; cursor: pointer;';
        div.innerHTML = '<i class="bi bi-file-pdf" style="color: #d32f2f; font-size: 1.2rem;" title="Descargar PDF"></i>';
        return div;
      },
    },
  ];

  nivel3GridOptions: any = {
    headerHeight: 28,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true },
  };

  agInit(params: any): void {
    this.internalParams = params;
    this.providersLoaded = false;
    this.loadProviders();
    this.loadConditionsRange();
  }

  private loadConditionsRange(): void {
    // Preferimos idReference de la fila (la sucursal de la OC); fallback al sidebar
    const idBranch = this.internalParams?.data?.idReference
      || this.signalsService.getBranchSelectedBySidebar()();
    if (!idBranch) return;
    this.setupOcService.getByBranch(Number(idBranch)).subscribe({
      next: (setup) => {
        if (setup?.entregaMax != null) {
          const min = setup.entregaMin ?? 1;
          const max = setup.entregaMax;
          this.conditionsOptions = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        }
      },
      error: () => {}
    });
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

  onNivel3GridReady(params: GridReadyEvent) {
    this.nivel3GridApi = params.api;
    if (this.nivel3Data.length) {
      this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
    }
  }

  private openNivel3(articleRow: any): void {
    if (this.selectedArticleRow === articleRow) {
      this.closeNivel3();
      return;
    }
    this.selectedArticleRow = articleRow;
    this.buildNivel3Grid(articleRow);
    if (this.itemsGridApi) {
      this.itemsGridApi.forEachNode((node: any) => {
        node.setRowHeight(node.data === articleRow ? undefined : 0);
      });
      this.itemsGridApi.onRowHeightChanged();
    }
  }

  private buildNivel3Grid(articleRow: any, preserve: boolean = false): void {
    const count = Math.max(1, Number(articleRow?.conditions) || 0);
    const existing = preserve ? (this.nivel3Data || []) : [];

    const newData: any[] = [];
    for (let i = 1; i <= count; i++) {
      const prior = existing[i - 1];
      newData.push(prior ?? {
        fechaEntrega: '',
        cantidadRecibir: null,
        notaFactura: '',
        totalEntrega: null,
      });
    }
    this.nivel3Data = newData;

    if (this.nivel3GridApi) {
      this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
    }
  }

  private closeNivel3(): void {
    this.selectedArticleRow = null;
    this.nivel3Data = [];
    if (this.itemsGridApi) {
      this.itemsGridApi.forEachNode((node: any) => node.setRowHeight(undefined));
      this.itemsGridApi.onRowHeightChanged();
    }
  }

  onFirstDataRendered(params: any) {
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.autoSizeAllColumns();
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
            idReq: oc.idReq || oc.id_req || 0,
            numCotizacion: oc.numCotizacion || oc.num_cotizacion || '',
            condicionesPago: oc.condicionesPago || oc.condiciones_pago || '',
            totalOc: Number(oc.total ?? oc.Total ?? 0) || 0,
            anticipoOc: Number(oc.anticipoOc ?? oc.AnticipoOc ?? 0) || 0,
          };
        });

        if (this.gridApi && !this.gridApi.isDestroyed()) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }

        // Pre-cargar datos para tooltip de cada OC (no bloquea el render)
        this.preloadTooltipData();
      },
      error: (error) => {
        console.error('Error loading OCs:', error);
        this.rowData = [];
      },
    });
  }

  /**
   * Pre-carga items de cada OC y de su requisición padre para construir el cache de tooltips.
   * Las cantidades requeridas se obtienen del item con mismo numarticle en la requisición padre.
   */
  private async preloadTooltipData(): Promise<void> {
    this.ocTooltipDataMap.clear();
    const reqItemsCache = new Map<number, any[]>();

    await Promise.all(this.rowData.map(async (oc) => {
      try {
        const ocItems: any[] = await lastValueFrom(this.ocAndReqsService.getReqItems(oc.id));
        const items = Array.isArray(ocItems) ? ocItems : [];

        // Cargar items de la requisición padre (cacheado por idReq)
        let reqItems: any[] = [];
        const idReq = Number(oc.idReq || 0);
        if (idReq > 0) {
          if (reqItemsCache.has(idReq)) {
            reqItems = reqItemsCache.get(idReq) || [];
          } else {
            try {
              const r: any[] = await lastValueFrom(this.ocAndReqsService.getReqItems(idReq));
              reqItems = Array.isArray(r) ? r : [];
              reqItemsCache.set(idReq, reqItems);
            } catch {
              reqItems = [];
              reqItemsCache.set(idReq, []);
            }
          }
        }

        const tooltipItems: TooltipItem[] = items.map((it: any) => {
          const numArt = String(it.numarticle ?? it.numArticle ?? '').trim();
          // Buscar el item de la requisición padre con mismo numarticle para obtener cantidad requerida
          const parentItem = numArt
            ? reqItems.find((r: any) => String(r.numarticle ?? r.numArticle ?? '').trim() === numArt)
            : null;
          const cantidadReq = parentItem ? Number(parentItem.quantity ?? 0) : 0;
          return {
            articulo: String(it.namearticle ?? it.nameArticle ?? '—'),
            cantidadRequerida: cantidadReq,
            cantidadXProv: Number(it.quantity ?? 0),
          };
        });

        // El TIPO OC real ("COMPRA AUTORIZADA SIN LIMITE", etc.) viene en cada item (detailsreqoc.typeoc),
        // no en la cabecera (que suele ser "INSUMOS"). Usamos el typeoc del primer item.
        const itemTypeOc = items.length > 0
          ? String(items[0].typeoc ?? items[0].typeOc ?? '').trim()
          : '';
        const headerTypeOc = itemTypeOc || (oc.typeoc || '');

        this.ocTooltipDataMap.set(oc.id, {
          typeoc: headerTypeOc,
          items: tooltipItems,
        });
      } catch {
        // Si falla un OC, no bloquear los demás
        this.ocTooltipDataMap.set(oc.id, { typeoc: oc.typeoc || '', items: [] });
      }
    }));
  }

  // ============= TOOLTIP FLOTANTE PARA COLUMNA OC =============

  private showOcTooltip(ev: MouseEvent, ocId: number): void {
    const data = this.ocTooltipDataMap.get(ocId);
    if (!data) {
      // Datos aún no cargados: mostrar mensaje temporal
      this.renderTooltip(ev, { typeoc: 'Cargando...', items: [] });
      return;
    }
    this.renderTooltip(ev, data);
  }

  private renderTooltip(ev: MouseEvent, data: OcTooltipData): void {
    this.hideOcTooltip();

    const div = document.createElement('div');
    div.className = 'oc-floating-tooltip';
    div.style.cssText = `
      position: fixed; z-index: 10100;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      padding: 12px 14px; min-width: 320px; max-width: 480px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px; color: #ffffff; pointer-events: none; line-height: 1.6;
    `;

    // Título bold
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #ffffff;';
    title.textContent = data.typeoc || 'TIPO OC: —';
    div.appendChild(title);

    // Tabla de items
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px;';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="background: rgba(255,255,255,0.15);">
        <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); font-weight: 600;">Artículo</th>
        <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); font-weight: 600; white-space: nowrap;">Cant. Req</th>
        <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); font-weight: 600; white-space: nowrap;">Cant X Prov</th>
      </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (!data.items.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `<td colspan="3" style="padding: 6px; text-align: center; color: rgba(255,255,255,0.7);">Sin artículos</td>`;
      tbody.appendChild(emptyRow);
    } else {
      data.items.forEach((it, idx) => {
        const tr = document.createElement('tr');
        if (idx % 2 === 1) tr.style.background = 'rgba(255,255,255,0.08)';
        const formatNum = (n: number) =>
          Number.isFinite(n) ? n.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '0';
        tr.innerHTML = `
          <td style="padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #ffffff;">${this.escapeHtml(it.articulo)}</td>
          <td style="padding: 4px 6px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);">${formatNum(it.cantidadRequerida)}</td>
          <td style="padding: 4px 6px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1); color: #ffffff; font-weight: 600;">${formatNum(it.cantidadXProv)}</td>`;
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    div.appendChild(table);

    document.body.appendChild(div);
    this.tooltipEl = div;
    this.positionTooltip(ev);
  }

  private moveOcTooltip(ev: MouseEvent): void {
    if (this.tooltipEl) this.positionTooltip(ev);
  }

  private positionTooltip(ev: MouseEvent): void {
    if (!this.tooltipEl) return;
    const margin = 14;
    const rect = this.tooltipEl.getBoundingClientRect();

    // Posición horizontal: a la derecha del cursor, fallback a la izquierda
    let left = ev.clientX + margin;
    if (left + rect.width > window.innerWidth) {
      left = ev.clientX - rect.width - margin;
    }
    if (left < 4) left = 4;

    // Posición vertical: ARRIBA del cursor por defecto (para no tapar la tabla de items inferior)
    // Si no cabe arriba, mostrar abajo
    let top = ev.clientY - rect.height - margin;
    if (top < 4) {
      top = ev.clientY + margin;
    }
    if (top + rect.height > window.innerHeight) {
      top = Math.max(4, window.innerHeight - rect.height - 4);
    }

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  }

  private hideOcTooltip(): void {
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  revertLocalChanges(): void {
    this.changedItemIds.forEach((id) => this.conditionsPendingService.remove(id));
    this.changedItemIds.clear();
    this.hasLocalChanges = false;
    this.itemsData = JSON.parse(JSON.stringify(this.originalItemsData));
    this.closeNivel3();
    if (this.itemsGridApi) {
      this.itemsGridApi.setGridOption('rowData', this.itemsData);
    }
  }

  ngOnDestroy(): void {
    this.hideOcTooltip();
  }

  onRowClicked(event: any) {
    const row = event.data as OcRow;
    this.closeNivel3();
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
        this.itemsData = (Array.isArray(items) ? items : []).map((it: any) => ({
          ...it,
          conditions: it.diasCondicionCompra ?? 1,
          typeoc: row.typeoc || '',
        }));
        this.originalItemsData = JSON.parse(JSON.stringify(this.itemsData));
        this.changedItemIds.clear();
        this.hasLocalChanges = false;
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
