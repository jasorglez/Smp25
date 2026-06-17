import { Component, inject, OnDestroy, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom, Subscription } from 'rxjs';
import { CompraRapidaArticuloTooltipComponent } from './compra-rapida-articulo-tooltip.component';
import { EntradaDocumentsOverlayService } from 'app/services/entrada-documents-overlay.service';
import { IntandoutDocumentsService } from 'app/services/intandoutDocuments.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { ClasificacionCascadaComponent } from 'app/domains/ModShoppingDelison/pages/quote-delison/clasificacion-cascada.component';
import { StyledTooltipComponent } from 'app/shared/styled-tooltip/styled-tooltip.component';

@Component({
  selector: 'app-compra-rapida-detalle',
  standalone: true,
  imports: [CommonModule, AgGridAngular, ClasificacionCascadaComponent],
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
  styles: [
    `:host { display: block; height: 100%; overflow: hidden; }`,
    `::ng-deep .nupnpn-row { background-color: #ffebee !important; }`
  ]
})
export class CompraRapidaDetalleComponent implements OnDestroy {
  private overlayService = inject(EntradaDocumentsOverlayService);
  private readonly cdr = inject(ChangeDetectorRef);
  private intandoutDocumentsService = inject(IntandoutDocumentsService);
  signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private materialsService = inject(MaterialsService);

  private gridApi!: GridApi;
  private countSub?: Subscription;
  rowData: any[] = [];
  reqFolio = '';
  hasUnsavedChanges = false;

  catCategorias: any[] = [];
  catFamilias: any[] = [];
  catSubfamilias: any[] = [];

  colDefs: ColDef[] = [
    {
      field: 'folioCr', headerName: 'Folio CR', width: 150, pinned: 'left',
      // CR-{sucursal sin guion}-{prefijo depto}. Se completa con proveedor+id al pagar en Hoja de Gastos.
      cellStyle: { fontWeight: '600', color: '#2e7d32' },
    },
    { field: 'department', headerName: 'Departamento que solicita', width: 200 },
    { field: 'solicitedBy', headerName: 'Solicitado por', width: 180 },
    { field: 'recurrent', headerName: 'Recurrente', width: 130 },
    { field: 'proveedor', headerName: 'Proveedor', width: 160 },
    {
      field: 'article',
      headerName: 'Artículo',
      flex: 1,
      minWidth: 160,
      tooltipValueGetter: (p: any) => p.data?.article || '',
      tooltipComponent: 'compraRapidaArticuloTooltip',
    },
    {
      field: 'numArticle',
      headerName: '# Artículo',
      width: 160,
      cellStyle: (p: any) => String(p.value || '').toUpperCase().startsWith('NUPNPN')
        ? { cursor: 'pointer', backgroundColor: '#fff9e6', textDecoration: 'underline', color: '#b8860b' }
        : null,
      cellRenderer: (p: any) => {
        const val = String(p.value ?? '');
        if (val.toUpperCase().startsWith('NUPNPN')) {
          const chevron = p.node?.expanded ? '▼' : '▶';
          return `<span style="margin-right:4px;">${chevron}</span>${val}`;
        }
        return val;
      },
      onCellClicked: (e: any) => {
        const val = String(e.data?.numArticle || '').toUpperCase();
        if (!val.startsWith('NUPNPN')) return;
        const willExpand = !e.node.expanded;
        if (willExpand) {
          this.gridApi.forEachNode((other: any) => {
            if (other.id !== e.node.id) other.setRowHeight(0);
          });
          e.node.setExpanded(true);
        } else {
          e.node.setExpanded(false);
          this.gridApi.forEachNode((other: any) => other.setRowHeight(undefined));
        }
        this.gridApi.onRowHeightChanged();
        this.gridApi.refreshCells({ rowNodes: [e.node], columns: ['numArticle'], force: true });
      }
    },
    { field: 'quantity', headerName: 'Cantidad Requerida', width: 160, type: 'numericColumn' },
    {
      field: 'price', headerName: 'P. Unitario', width: 150, type: 'numericColumn',
      // Muestra precio en MXN. Tooltip azul con precio original si moneda ≠ MXN.
      valueFormatter: (p: any) => {
        if (p.value == null || p.value === '' || Number(p.value) <= 0) return '';
        return Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + ' MXN';
      },
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => {
        const moneda = p.data?.moneda || 'MXN';
        if (moneda === 'MXN') return null;
        const orig = Number(p.data?.precioUnitarioOriginal ?? 0);
        if (orig <= 0) return null;
        return `Precio original\n${orig.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
      },
    },
    {
      field: 'cantidadEntradaAlmacen', headerName: 'Cantidad entrada almacén', width: 180, type: 'numericColumn',
      valueFormatter: (p: any) => (p.value != null && p.value !== '') ? Number(p.value).toLocaleString('es-MX') : '',
    },
    {
      field: 'totalCr', headerName: 'Total CR', width: 150, type: 'numericColumn',
      // Costo total ya convertido a MXN (monto_mxn = pago × TC). Se llena al pagar la CR.
      cellStyle: { fontWeight: '600', color: '#2e7d32' },
      valueFormatter: (p: any) => (p.value != null && p.value !== '' && Number(p.value) > 0)
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + ' MXN'
        : '',
    },
    { field: 'comment', headerName: 'Comentarios', flex: 1, minWidth: 160 },
    {
      headerName: 'PDF',
      colId: 'pdf',
      width: 70,
      sortable: false,
      onCellClicked: (params: any) => {
        const crId = params.data?.crId;
        if (!crId) return;
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
    popupParent: typeof document !== 'undefined' ? document.body : null,
    defaultColDef: { resizable: true, sortable: true },
    rowClassRules: {
      'nupnpn-row': (params: any) => String(params.data?.numArticle || '').toUpperCase().startsWith('NUPNPN'),
    },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
    masterDetail: true,
    isRowMaster: (data: any) => String(data?.numArticle || '').toUpperCase().startsWith('NUPNPN'),
    detailCellRenderer: ClasificacionCascadaComponent,
    getRowHeight: (p: any) => p?.node?.detail ? 200 : undefined,
    context: { componentParent: this },
  };

  agInit(params: any): void {
    this.reqFolio = params?.data?.reqFolio || '';
    this.rowData = params?.data?.items || [];
    this.hasUnsavedChanges = false;
    this.loadPdfCounts();
    this.cargarCatalogosClasificacion();
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
  
    this.cdr.detectChanges();}

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  marcarClasifModificado(): void {
    this.hasUnsavedChanges = true;
  }

  async guardarClasificaciones(): Promise<void> {
    const rows = this.rowData.filter((r: any) => r.__clasifPendiente && r.idSupplie > 0);
    if (!rows.length) return;
    for (const row of rows) {
      try {
        const resp: any = await lastValueFrom(this.materialsService.updateMaterial(String(row.idSupplie), {
          idCategory: row.clasifCategoria,
          idFamilia: row.clasifFamilia,
          idSubfamilia: row.clasifSubfamilia
        }));
        const nuevoInsumo = resp?.insumo || resp?.Insumo;
        if (nuevoInsumo) row.numArticle = nuevoInsumo;
        delete row.__clasifPendiente;
      } catch (e) {
        console.error('Error reclasificando material', row.idSupplie, e);
      }
    }
    this.hasUnsavedChanges = false;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.forEachNode((node: any) => {
        node.setExpanded(false);
        node.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.refreshCells({ force: true });
    }
    // Notificar al padre para que recalcule el badge NUPNPN
    this.signalsService.triggerNupnpnRecheck();
  }

  private cargarCatalogosClasificacion(): void {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;
    const tieneBits = (x: any) =>
      (x?.valueAdditionBit === true || x?.valueAdditionBit === 1) ||
      (x?.valueAdditionBit3 === true || x?.valueAdditionBit3 === 1);
    this.catalogsService.getCatalogs(idCompany, 'CATEGORY').subscribe({
      next: (d: any[]) => this.catCategorias = (Array.isArray(d) ? d : []).filter(tieneBits),
      error: () => this.catCategorias = []
    });
    this.catalogsService.getCatalogs(idCompany, 'FAM-CAT').subscribe({
      next: (d: any[]) => this.catFamilias = (Array.isArray(d) ? d : []).filter(tieneBits),
      error: () => this.catFamilias = []
    });
    this.catalogsService.getCatalogs(idCompany, 'SUB-FAM').subscribe({
      next: (d: any[]) => this.catSubfamilias = (Array.isArray(d) ? d : []).filter(tieneBits),
      error: () => this.catSubfamilias = []
    });
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
