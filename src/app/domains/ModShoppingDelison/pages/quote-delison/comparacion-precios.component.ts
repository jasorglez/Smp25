import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProvidersService } from 'app/services/providers.service';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, Subscription } from 'rxjs';

@Component({
  selector: 'app-comparacion-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ItemCommentsCellRendererComponent],
  template: `
    <div class="comparacion-container">
      <h5 class="mb-3">Comparación de Precios por Proveedor</h5>

      <!-- Loading state -->
      <div *ngIf="loading" style="display: flex; align-items: center; justify-content: center; flex: 1; gap: 8px;">
        <div class="spinner-border spinner-border-sm"></div>
        <span>Cargando datos de comparación...</span>
      </div>

      <!-- Error state -->
      <div *ngIf="error && !loading" class="alert alert-danger mb-0">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
      </div>

      <!-- Data loaded -->
      <div *ngIf="!loading && !error && articulos.length > 0" style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
        <!-- Botones de artículos -->
        <div class="article-buttons-row" style="flex-shrink: 0;">
          <div class="article-buttons-scroller">
            <div class="article-buttons">
              <button
                type="button"
                class="btn btn-sm"
                *ngFor="let a of articulos"
                [class.btn-primary]="a.id === selectedArticuloId"
                [class.btn-outline-primary]="a.id !== selectedArticuloId"
                (click)="onSelectArticulo(a.id)">
                {{ a.nombre }}
              </button>
            </div>
          </div>

          <div class="actions d-flex align-items-center gap-2">
            <button
              type="button"
              class="btn btn-sm btn-success position-relative"
              (click)="save()"
              [disabled]="selectedArticuloId === null || !hasUnsavedChanges">
              Guardar
              <span
                class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                *ngIf="hasUnsavedChanges">
              </span>
            </button>

            <button
              type="button"
              class="btn btn-sm btn-warning"
              (click)="revert()"
              [disabled]="selectedArticuloId === null || !hasUnsavedChanges">
              Deshacer
            </button>
          </div>
        </div>

        <!-- Grid: se muestra solo cuando se elige un artículo -->
        <div *ngIf="selectedArticuloId !== null" style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
          <ag-grid-angular
            #agGrid
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="rowData"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            [localeText]="AG_GRID_LOCALE_ES"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
            (rowDataUpdated)="onRowDataUpdated()"
            (cellValueChanged)="onCellValueChanged($event)"
            style="width: 100%; flex: 1 1 auto; min-height: 0;">
          </ag-grid-angular>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && !error && articulos.length === 0" class="alert alert-info mb-0">
        <i class="bi bi-info-circle me-2"></i>No hay artículos para comparar en este pedimento.
      </div>
    </div>
  `,
  styles: [`
    .comparacion-container {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: auto;
    }

    h5 {
      color: #333;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .article-buttons-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .article-buttons-scroller {
      flex: 1 1 auto;
      min-width: 220px;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
    }

    .actions {
      margin-left: auto;
      flex: 0 0 auto;
    }

    .article-buttons {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
    }

    :host ::ng-deep .ag-cell.cell-cantidad-comprar,
    :host ::ng-deep .ag-cell.cell-cantidad-comprar .ag-cell-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    :host ::ng-deep .ag-header-cell.header-cantidad-comprar .ag-header-cell-label {
      justify-content: center;
      width: 100%;
    }
  `]
})
export class ComparacionPreciosComponent implements OnInit, OnDestroy {
  private ocAndReqsService = inject(OcAndReqsService);
  private providersService = inject(ProvidersService);
  private itemCommentsService = inject(ItemCommentsService);
  private cdr = inject(ChangeDetectorRef);
  private params: any;
  private gridApi!: GridApi;
  private cotizacionId: number = 0;
  private requisitionId: number = 0;
  private selectedProviderIds: number[] = [];
  private codigosExternos: Map<number, Map<number, string>> = new Map();
  private commentSub?: Subscription;

  rowData: any[] = [];
  private originalRowData: any[] = [];
  articulos: any[] = [];
  proveedores: any[] = [];

  selectedArticuloId: number | null = null;
  hasUnsavedChanges = false;
  loading = false;
  error: string | null = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  readonly tipoOcOptions = [
    'SELECCIONE UNA OPCION',
    'COMPRA INMEDIATA',
    'COMPRA AUTORIZADA',
    'COMPRA AUTORIZADA EN OTRA FECHA',
    'CAMBIO DE ESPECIFICACIONES',
    'ARTICULO NO AUTORIZADO'
  ];

  ngOnInit() {
    this.commentSub = this.itemCommentsService.commentSaved$.subscribe(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    });
  }

  ngOnDestroy() {
    this.commentSub?.unsubscribe();
  }

  agInit(params: any): void {
    this.params = params;
    this.cotizacionId = params.cotizacionId || params.data?.cotizacionId || params.data?.id || 0;
    this.requisitionId = params.requisitionId || params.data?.requisitionId || 0;
    this.selectedProviderIds = params.selectedProviderIds || [];
    console.log('[Comparacion] agInit - cotizacionId:', this.cotizacionId, 'requisitionId:', this.requisitionId, 'params.data:', params.data);
    this.loadComparisonData();
  }

  refresh(): boolean { return false; }

  private loadComparisonData() {
    if (!this.cotizacionId) {
      this.error = 'No se pudo identificar el pedimento';
      return;
    }

    this.loading = true;
    this.error = null;

    this.ocAndReqsService.getComparisonData(this.cotizacionId).subscribe({
      next: async (data: any) => {
        console.log('[Comparacion] raw response:', JSON.stringify(data));
        let proveedores = data.proveedores || [];
        this.articulos = data.articulos || [];

        // Filtrar proveedores para mostrar solo los seleccionados en nivel 2
        if (this.selectedProviderIds.length > 0) {
          proveedores = proveedores.filter((p: any) =>
            this.selectedProviderIds.includes(p.id)
          );
        }

        this.proveedores = proveedores;

        // Cargar asignaciones de materiales (campo11 = Cód. Externo) para cada proveedor
        try {
          await this.loadCodigosExternos();
        } catch (err) {
          console.warn('[Comparacion] Error cargando códigos externos:', err);
        }

        this.loading = false;

        if (this.articulos.length === 0) {
          this.error = null; // No es error, solo sin datos
        }
      },
      error: (err: any) => {
        console.error('Error cargando datos de comparación:', err);
        this.error = 'Error al cargar los datos de comparación';
        this.loading = false;
        alerts.basicAlert('Error', this.error, 'error');
      }
    });
  }

  private async loadCodigosExternos(): Promise<void> {
    this.codigosExternos.clear();
    for (const prov of this.proveedores) {
      try {
        const assignments = await lastValueFrom(
          this.providersService.getProvidersXTable(prov.id, 'MATERIAL')
        );
        const list = Array.isArray(assignments) ? assignments : [];
        const map = new Map<number, string>();
        list.forEach((a: any) => {
          const campo1 = Number(a.campo1) || 0;
          const campo11 = a.campo11 || '';
          if (campo1 > 0) {
            map.set(campo1, campo11);
          }
        });
        console.log(`[Comparacion] Proveedor ${prov.id} (${prov.nombre}):`, Array.from(map.entries()));
        this.codigosExternos.set(prov.id, map);
      } catch (err) {
        console.warn(`[Comparacion] Error cargando códigos externos para proveedor ${prov.id}:`, err);
        this.codigosExternos.set(prov.id, new Map());
      }
    }
  }

  onSelectArticulo(id: number) {
    if (this.selectedArticuloId === id) {
      this.selectedArticuloId = null;
      this.rowData = [];
      this.originalRowData = [];
      this.hasUnsavedChanges = false;
      if (this.gridApi) {
        setTimeout(() => {
          this.gridApi.setGridOption('rowData', []);
        }, 0);
      }
      return;
    }

    this.selectedArticuloId = id;
    this.buildRowData();
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;

    // Forzar cambio de detección para que Angular renderice la grid
    this.cdr.detectChanges();

    // Esperar a que la grid esté en el DOM y gridApi esté listo
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.scheduleAutoSizeColumns();
      }
    }, 50);
  }

  private buildRowData() {
    const articulo = this.articulos.find(a => a.id === this.selectedArticuloId);
    if (!articulo) {
      this.rowData = [];
      return;
    }

    const preciosPorProv = articulo.precios || {};
    const comprasMinsByProv = articulo.comprasMinimas || {};
    const tiemposEntregaPorProv = articulo.tiemposEntrega || {};
    const cantidadComprar = Number(articulo.cantidad ?? articulo.cantidadComprar ?? 0) || 0;

    // Una fila por proveedor (datos API + fallbacks para campos nuevos)
    this.rowData = this.proveedores.map((prov: any) => {
      const costoUnitario = Number(preciosPorProv[prov.id] ?? preciosPorProv[prov.id.toString()] ?? prov.costoUnitario ?? prov.precio ?? 0) || 0;
      const compraMinima = Number(comprasMinsByProv[prov.id] ?? comprasMinsByProv[prov.id.toString()] ?? articulo.compraMinima ?? 1) || 1;
      console.log(`[Comparacion] prov.id=${prov.id} → compraMinima=${compraMinima}`);
      const costoTotal = costoUnitario * cantidadComprar;
      const costoXCompraMinima = costoUnitario * compraMinima;

      // Obtener Cód. Externo del proveedor para este artículo
      const idSupplie = articulo.idSupplie || 0;
      const providerCodigosMap = this.codigosExternos.get(prov.id) || new Map();
      const codigoExternoProveedor = providerCodigosMap.get(idSupplie) || '';
      console.log(`[Comparacion] Artículo ${articulo.nombre} (idSupplie=${idSupplie}) × Prov ${prov.id}: codigoExterno="${codigoExternoProveedor}"`);

      const rawNumArticle = articulo.numArticle ?? articulo.numArticuloInterno ?? articulo.numarticulo ?? '';
      const rowItem = {
        proveedorId: prov.id,
        proveedorNombre: prov.nombre ?? prov.name ?? '',
        cantidadComprar,
        nuevoRecurrente: articulo.recurrent ?? articulo.nuevoRecurrente ?? prov.recurrent ?? '—',
        articulo: articulo.nombre ?? articulo.article ?? '',
        numArticle: rawNumArticle,
        numArticuloInterno: rawNumArticle,
        numArticuloExterno: codigoExternoProveedor || (articulo.codigoExterno ?? articulo.numArticuloExterno ?? articulo.observation ?? ''),
        prioridad: articulo.typePriority ?? articulo.prioridad ?? 'NORMAL',
        tiempoEntrega: tiemposEntregaPorProv[prov.id] ?? tiemposEntregaPorProv[prov.id.toString()] ?? '',
        compraMinima,
        costoUnitario,
        costoTotal,
        costoXCompraMinima,
        comentario: articulo.comment ?? articulo.comentario ?? '',
        tipoOc: articulo.typeOc ?? articulo.tipoOc ?? this.tipoOcOptions[0] ?? 'SELECCIONE UNA OPCION'
      };
      console.log('Primera fila creada - compraMinima:', rowItem.compraMinima);
      return rowItem;
    });

    console.log('rowData completo:', this.rowData);
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    this.scheduleAutoSizeColumns();
  }

  onFirstDataRendered(_params: any) {
    this.scheduleAutoSizeColumns();
  }

  onRowDataUpdated() {
    this.scheduleAutoSizeColumns();
  }

  /** Reajusta anchos al contenido (incluye texto de encabezados). */
  private scheduleAutoSizeColumns() {
    queueMicrotask(() => {
      setTimeout(() => this.autoAdjustColumns(), 0);
    });
  }

  private autoAdjustColumns() {
    if (!this.gridApi) return;
    const apiAny = this.gridApi as any;
    // false = incluir encabezados en el cálculo (evita títulos cortados en mayúsculas)
    if (typeof apiAny.autoSizeAllColumns === 'function') {
      apiAny.autoSizeAllColumns(false);
      return;
    }
    if (typeof apiAny.autoSizeColumns === 'function') {
      apiAny.autoSizeColumns({ columns: 'all', skipHeader: false });
      return;
    }
    if (typeof apiAny.sizeColumnsToFit === 'function') {
      apiAny.sizeColumnsToFit();
    }
  }

  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;
    const field = event.colDef?.field;
    if (field === 'cantidadComprar') {
      const v = Number(event.newValue);
      const qty = Number.isFinite(v) ? v : 0;
      this.rowData.forEach((row: any) => {
        row.cantidadComprar = qty;
        row.costoTotal = (Number(row.costoUnitario) || 0) * qty;
      });
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }
    if (field === 'costoUnitario' || field === 'compraMinima') {
      const row = event.data;
      const cu = Number(row.costoUnitario) || 0;
      const q = Number(row.cantidadComprar) || 0;
      const cm = Number(row.compraMinima) || 0;
      row.costoTotal = cu * q;
      row.costoXCompraMinima = cu * cm;
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }
    }
  }

  save() {
    if (this.selectedArticuloId === null) return;
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Guardado', 'Selección de proveedores guardada', 'success');
  }

  revert() {
    if (this.selectedArticuloId === null) return;
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'cantidadComprar',
        headerName: 'CANTIDAD A COMPRAR',
        minWidth: 120,
        editable: (params: any) => params.node?.rowIndex === 0,
        cellEditor: 'agNumberCellEditor',
        cellClass: 'cell-cantidad-comprar',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => {
          const api = params.api;
          const idx = params.node?.rowIndex;
          const n = api?.getDisplayedRowCount?.() ?? this.rowData?.length ?? 0;
          if (n <= 0) return 1;
          return idx === 0 ? n : 0;
        },
        cellStyle: { padding: '8px', backgroundColor: '#e8f4fd' },
        wrapText: true
      },
      {
        field: 'proveedorNombre',
        headerName: 'PROVEEDOR',
        minWidth: 140,
        cellStyle: { backgroundColor: '#e3f2fd', fontWeight: '500', padding: '8px' }
      },
      {
        field: 'nuevoRecurrente',
        headerName: 'NUEVO RECURRENTE',
        minWidth: 130,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'articulo',
        headerName: 'ARTICULO',
        minWidth: 150,
        hide: true,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'numArticuloInterno',
        headerName: '# ARTICULO INTERNO',
        minWidth: 130,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'numArticuloExterno',
        headerName: '# ARTICULO EXTERNO',
        minWidth: 130,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'prioridad',
        headerName: 'PRIORIDAD',
        minWidth: 100,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'tiempoEntrega',
        headerName: 'TIEMPO DE ENTREGA',
        minWidth: 120,
        editable: true,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'compraMinima',
        headerName: 'COMPRA MINIMA',
        minWidth: 110,
        editable: true,
        type: 'numericColumn',
        cellStyle: { textAlign: 'right', padding: '8px' }
      },
      {
        field: 'costoUnitario',
        headerName: 'COSTO UNITARIO',
        minWidth: 120,
        editable: true,
        type: 'numericColumn',
        cellStyle: { backgroundColor: '#fff9c4', textAlign: 'right', padding: '8px' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'costoTotal',
        headerName: 'COSTO TOTAL',
        minWidth: 120,
        editable: false,
        cellStyle: { backgroundColor: '#c8e6c9', fontWeight: '600', padding: '8px', textAlign: 'right' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'costoXCompraMinima',
        headerName: 'COSTO X COMPRA MINIMA',
        minWidth: 150,
        editable: false,
        cellStyle: { textAlign: 'right', padding: '8px' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'comentario',
        headerName: 'COMENTAR',
        minWidth: 100,
        editable: false,
        cellRenderer: ItemCommentsCellRendererComponent,
        cellRendererParams: (params: any) => ({
          documentType: 'REQ',
          idDocument: this.requisitionId,
          numArticle: params.data?.numArticle || params.data?.numArticuloInterno || '',
          locked: false
        }),
        onCellClicked: (params: any) => {
          const numArticle = params.data?.numArticle || params.data?.numArticuloInterno || '';
          if (!numArticle || !this.requisitionId) return;
          this.itemCommentsService.openChatFor$.next({
            documentType: 'REQ',
            idDocument: this.requisitionId,
            numArticle
          });
        },
        cellStyle: { padding: '8px', cursor: 'pointer' }
      },
      {
        field: 'tipoOc',
        headerName: 'TIPO OC',
        minWidth: 220,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({ values: this.tipoOcOptions }),
        cellEditorPopup: true,
        cellStyle: { textAlign: 'left', padding: '8px' }
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 40,
    // AG Grid 32: tamaño inicial según contenido de celdas y encabezados
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 90
    },
    // Obligatorio para que colDef.rowSpan fusione celdas (sin esto cada fila sigue mostrando su propia celda)
    suppressRowTransform: true,
    animateRows: false,
    singleClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    suppressClickEdit: false,
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: false,
      minWidth: 90
    },
    suppressCellFocus: false
  };
}
