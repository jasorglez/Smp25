import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { OrdenesydetallesOcComponent } from './ordenesydetallesOc.component';
import { CurrencyService } from 'app/services/currency.service';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-pedimentos-x-requisicion',
  standalone: true,
  imports: [CommonModule, AgGridAngular, OrdenesydetallesOcComponent],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column;
                box-sizing: border-box; overflow: hidden;">

      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">Pedimentos de {{ requisiconFolio }}</strong>
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
export class PedimentosXRequisicionComponent {
  private ocAndReqsService = inject(OcAndReqsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private currencyService = inject(CurrencyService);

  // Catálogo de monedas para el "$ Total x Pedimento" por moneda (Opción A, sin convertir).
  private monedasMap = new Map<number, string>();
  private defaultCurrencyId: number | null = null;

  private internalParams: any;
  private gridApi!: GridApi;

  rowData: any[] = [];
  requisiconFolio: string = '';

  /** Carga catálogo de monedas (type=CURRENCY) y resuelve la default (MXN). */
  private loadMonedas(idCompany: number): void {
    if (!idCompany) return;
    this.currencyService.getCurrencies(idCompany).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data?.catalog ?? []);
        this.monedasMap = new Map<number, string>();
        let mxnId: number | null = null;
        (list || []).forEach((c: any) => {
          const id = Number(c.id);
          const abrev = (c.valueAddition || '').toString().trim();
          const nombre = c.description || '';
          this.monedasMap.set(id, abrev || nombre);
          if (mxnId === null && (abrev.toUpperCase() === 'MXN' || /peso|mexic/i.test(nombre))) mxnId = id;
        });
        this.defaultCurrencyId = mxnId ?? (list?.[0]?.id != null ? Number(list[0].id) : null);
        if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.refreshCells({ force: true });
      },
      error: () => { this.monedasMap = new Map(); this.defaultCurrencyId = null; }
    });
  }

  /** Abreviatura de una moneda (o 'MXN' si no resuelve). */
  private currencyAbbr(idCurrency: any): string {
    const id = (idCurrency !== undefined && idCurrency !== null) ? Number(idCurrency) : this.defaultCurrencyId;
    return (id != null ? this.monedasMap.get(Number(id)) : '') || 'MXN';
  }

  /**
   * "$ Total x Pedimento" por moneda. Agrupa el total de las OCs del pedimento por su moneda
   * (no convierte). 1 moneda → "$X.XX MXN"; varias → "$X.XX MXN / $Y.YY USD" (default/MXN primero).
   */
  private buildTotalsByCurrencyDisplay(ocs: any[]): string {
    const sums = new Map<number, number>();
    for (const oc of (ocs || [])) {
      const id = (oc?.idCurrency !== undefined && oc?.idCurrency !== null)
        ? Number(oc.idCurrency)
        : (this.defaultCurrencyId ?? -1);
      sums.set(id, (sums.get(id) || 0) + (Number(oc?.total ?? oc?.Total) || 0));
    }
    if (sums.size === 0) return `$0.00 ${this.currencyAbbr(this.defaultCurrencyId)}`;
    const entries = Array.from(sums.entries()).sort((a, b) => {
      if (a[0] === this.defaultCurrencyId) return -1;
      if (b[0] === this.defaultCurrencyId) return 1;
      return this.currencyAbbr(a[0]).localeCompare(this.currencyAbbr(b[0]));
    });
    return entries.map(([id, sum]) =>
      `$${sum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.currencyAbbr(id)}`
    ).join(' / ');
  }

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'pedimento',
      headerName: 'Pedimento',
      width: 160,
      editable: false,
      valueFormatter: (p) => p.value ? `Pedimento ${p.value}` : '—',
      cellStyle: { backgroundColor: '#c8e6c9', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', color: '#2e7d32' },
      onCellClicked: (event: any) => {
        const isExpanding = !event.node.expanded;
        if (isExpanding) {
          event.api.forEachNode((node: any) => {
            if (node.id !== event.node.id) {
              node.setExpanded(false);
              node.setRowHeight(0);
            }
          });
          event.api.onRowHeightChanged();
        } else {
          event.api.forEachNode((node: any) => node.setRowHeight(undefined));
          event.api.onRowHeightChanged();
        }
        event.node.setExpanded(isExpanding);
      }
    },
    {
      field: 'ocNumber',
      headerName: '# OC',
      width: 130,
      editable: false,
      cellStyle: { fontWeight: 'bold', textAlign: 'center' },
    },
    {
      field: 'totalPedimento',
      headerName: '$ Total x Pedimento',
      width: 180,
      editable: false,
      // Subtotales por moneda (Opción A): "$X.XX MXN / $Y.YY USD" si hay mezcla; una sola si no.
      valueFormatter: (p) => {
        if (p.data?.totalPedimentoDisplay) return p.data.totalPedimentoDisplay;
        const n = Number(p.value) || 0;
        return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      cellStyle: { fontWeight: 'bold', textAlign: 'right', backgroundColor: '#e8f5e9', color: '#1b5e20' },
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 28,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 700,
    isRowMaster: () => true,
    detailCellRendererSelector: () => ({ component: OrdenesydetallesOcComponent }),
    detailCellRendererParams: {
      getDetailRowData: (p: any) => p.successCallback([])
    },
    defaultColDef: { resizable: true, sortable: true },
  };

  agInit(params: any): void {
    this.internalParams = params;
    this.requisiconFolio = params?.data?.reqFolio || params?.data?.folio || '';
    // onGridReady cargará los datos
  
    this.cdr.detectChanges();}

  refresh(params: any): boolean {
    this.internalParams = params;
    return true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  private loadData() {
    const idRequisicion = this.internalParams?.data?.id;
    const idCompany     = this.internalParams?.data?.idCompany;

    if (!idRequisicion) {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', []);
      }
      return;
    }

    this.loadMonedas(Number(idCompany) || 0);

    this.ocAndReqsService.getPedimentosByRequisicion(idRequisicion).subscribe({
      next: (pedimentos: any[]) => {
        const peds = Array.isArray(pedimentos) ? pedimentos : [];

        if (peds.length === 0) {
          this.rowData = [];
          if (this.gridApi && !this.gridApi.isDestroyed()) {
            this.gridApi.setGridOption('rowData', []);
          }
          return;
        }

        // Por cada pedimento, traer sus OCs reales (para contar y para los subtotales por moneda).
        forkJoin(
          peds.map((p: any) =>
            this.ocAndReqsService.getOcsByPedimento(p.id).pipe(
              map((ocs: any[]) => (Array.isArray(ocs) ? ocs : [])),
              catchError(() => of([] as any[]))
            )
          )
        ).subscribe((ocsPerPed: any[][]) => {
          // idReference (sucursal) heredado de la requisición padre — necesario para
          // que el componente de detalle de OCs pueda cargar el rango de Condic. Compra
          // desde setup_oc sin depender del branch del sidebar.
          const idReference = this.internalParams?.data?.idReference
                           ?? this.internalParams?.data?.id_reference
                           ?? this.internalParams?.data?.idBranch
                           ?? null;
          this.rowData = peds.map((p: any, i: number) => {
            const ocs = ocsPerPed[i] || [];
            return {
              id:        p.id,
              folio:     p.folio || '',
              pedimento: p.pedimento || 0,
              ocNumber:  ocs.length,
              totalPedimento: p.totalPedimento ?? p.TotalPedimento ?? 0,
              // Subtotales por moneda (Opción A): suma de Total x OC agrupada por moneda.
              totalPedimentoDisplay: this.buildTotalsByCurrencyDisplay(ocs),
              idCompany: idCompany,
              idReference: idReference,
            };
          });

          if (this.gridApi && !this.gridApi.isDestroyed()) {
            this.gridApi.setGridOption('rowData', this.rowData);
            this.gridApi.autoSizeAllColumns();
          }
        });
      },
      error: () => {
        this.rowData = [];
      },
    });
  }
}
