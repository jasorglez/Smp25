import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { OrdenesydetallesOcComponent } from './ordenesydetallesOc.component';
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

  private internalParams: any;
  private gridApi!: GridApi;

  rowData: any[] = [];
  requisiconFolio: string = '';

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
      valueFormatter: (p) => {
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
  }

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

        // Por cada pedimento, contar sus OCs reales (las mismas que muestra el grid de detalle).
        forkJoin(
          peds.map((p: any) =>
            this.ocAndReqsService.getOcsByPedimento(p.id).pipe(
              map((ocs: any[]) => (Array.isArray(ocs) ? ocs.length : 0)),
              catchError(() => of(0))
            )
          )
        ).subscribe((counts: number[]) => {
          // idReference (sucursal) heredado de la requisición padre — necesario para
          // que el componente de detalle de OCs pueda cargar el rango de Condic. Compra
          // desde setup_oc sin depender del branch del sidebar.
          const idReference = this.internalParams?.data?.idReference
                           ?? this.internalParams?.data?.id_reference
                           ?? this.internalParams?.data?.idBranch
                           ?? null;
          this.rowData = peds.map((p: any, i: number) => ({
            id:        p.id,
            folio:     p.folio || '',
            pedimento: p.pedimento || 0,
            ocNumber:  counts[i] ?? 0,
            totalPedimento: p.totalPedimento ?? p.TotalPedimento ?? 0,
            idCompany: idCompany,
            idReference: idReference,
          }));

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
