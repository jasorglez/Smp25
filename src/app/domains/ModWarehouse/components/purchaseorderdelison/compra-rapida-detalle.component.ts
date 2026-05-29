import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom, Subscription } from 'rxjs';
import { CompraRapidaArticuloTooltipComponent } from './compra-rapida-articulo-tooltip.component';
import { EntradaDocumentsOverlayService } from 'app/services/entrada-documents-overlay.service';
import { IntandoutDocumentsService } from 'app/services/intandoutDocuments.service';

@Component({
  selector: 'app-compra-rapida-detalle',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">Compras Rápidas de {{ reqFolio }}</strong>
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
export class CompraRapidaDetalleComponent implements OnDestroy {
  private overlayService = inject(EntradaDocumentsOverlayService);
  private intandoutDocumentsService = inject(IntandoutDocumentsService);
  private gridApi!: GridApi;
  private countSub?: Subscription;
  rowData: any[] = [];
  reqFolio = '';

  colDefs: ColDef[] = [
    { field: 'department', headerName: 'Departamento que solicita', width: 200 },
    { field: 'solicitedBy', headerName: 'Solicitado por', width: 180 },
    { field: 'recurrent', headerName: 'Recurrente', width: 130 },
    {
      field: 'article',
      headerName: 'Artículo',
      flex: 1,
      minWidth: 160,
      tooltipValueGetter: (p: any) => p.data?.article || '',
      tooltipComponent: 'compraRapidaArticuloTooltip',
    },
    { field: 'numArticle', headerName: '# Artículo', width: 140 },
    { field: 'quantity', headerName: 'Cantidad Requerida', width: 160, type: 'numericColumn' },
    { field: 'caducidadMinimaRequerida', headerName: 'Cad. Min. Req', width: 140 },
    { field: 'comment', headerName: 'Comentarios', flex: 1, minWidth: 160 },
    {
      headerName: 'PDF',
      colId: 'pdf',
      width: 70,
      sortable: false,
      onCellClicked: (params: any) => {
        const crId = params.data?.crId;
        if (!crId) return;
        // Documentos compartidos con el nivel 4 de almacén molienda (misma llave CR).
        this.overlayService.open({ idEntrada: crId, docType: 'compra_rapida' });
      },
      cellRenderer: (params: any) => {
        const crId = params.data?.crId;
        const count = Number(params.data?.pdfCount ?? 0);
        const div = document.createElement('div');
        div.style.cssText = `text-align: center; cursor: ${crId ? 'pointer' : 'not-allowed'};`;
        if (!crId) {
          div.innerHTML = `<i class="bi bi-file-pdf" style="color:#bdbdbd; font-size:1.1rem;" title="Disponible al generar la compra rápida"></i>`;
          return div;
        }
        if (count > 0) {
          div.innerHTML = `
            <span style="display:inline-flex; align-items:center; justify-content:center; gap:2px;">
              <i class="bi bi-file-pdf" style="color:#d32f2f; font-size:1.1rem;"></i>
              <span style="background:#d32f2f; color:#fff; border-radius:10px;
                           font-size:0.65rem; font-weight:700; padding:0 4px;
                           min-width:16px; height:15px; line-height:15px;
                           display:inline-block; text-align:center;">
                ${count > 9 ? '9+' : count}
              </span>
            </span>`;
        } else {
          div.innerHTML = `<i class="bi bi-file-pdf" style="color:#d32f2f; font-size:1.1rem;" title="Ver documentos"></i>`;
        }
        return div;
      },
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 28,
    components: { compraRapidaArticuloTooltip: CompraRapidaArticuloTooltipComponent },
    tooltipShowDelay: 300,
    // Renderiza el tooltip a nivel de document.body para que no lo recorte el overflow del grid.
    popupParent: typeof document !== 'undefined' ? document.body : null,
    defaultColDef: { resizable: true, sortable: true },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  agInit(params: any): void {
    this.reqFolio = params?.data?.reqFolio || '';
    this.rowData = params?.data?.items || [];
    this.loadPdfCounts();
    // Refresco en vivo del conteo cuando se guarda/elimina un documento del CR.
    this.countSub?.unsubscribe();
    this.countSub = this.overlayService.countUpdated$.subscribe(({ idEntrada, count }) => {
      const row = this.rowData.find((r: any) => r.crId === idEntrada);
      if (row) {
        row.pdfCount = count;
        if (this.gridApi && !this.gridApi.isDestroyed()) {
          this.gridApi.refreshCells({ columns: ['pdf'], force: true });
        }
      }
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  private async loadPdfCounts(): Promise<void> {
    const rows = this.rowData.filter((r: any) => r.crId);
    if (!rows.length) return;
    await Promise.all(rows.map(async (row: any) => {
      try {
        const docs = await lastValueFrom(
          this.intandoutDocumentsService.getIntandoutDocumentsById(row.crId, 'compra_rapida')
        ).catch(() => []);
        row.pdfCount = Array.isArray(docs) ? docs.length : 0;
      } catch {
        row.pdfCount = 0;
      }
    }));
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.refreshCells({ columns: ['pdf'], force: true });
    }
  }

  refresh(): boolean { return true; }

  ngOnDestroy(): void {
    this.countSub?.unsubscribe();
  }
}
