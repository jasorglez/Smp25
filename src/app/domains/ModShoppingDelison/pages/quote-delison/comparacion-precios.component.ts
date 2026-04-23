import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, AgGridModule, ItemCommentsCellRendererComponent],
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
        <div class="article-toolbar-row" style="flex-shrink: 0;">
          <div class="actions d-flex align-items-center gap-2" style="margin-left: auto;">
            <button
              type="button"
              class="btn btn-sm btn-success position-relative"
              (click)="save()"
              [disabled]="rowData.length === 0 || !hasUnsavedChanges">
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
              [disabled]="rowData.length === 0 || !hasUnsavedChanges">
              Deshacer
            </button>
          </div>
        </div>

        <div style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
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

    .article-toolbar-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      flex-wrap: wrap;
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

    /* columnas con rowSpan: bordes horiz. (entre artículos) y vert. (lados de la celda) */
    :host ::ng-deep .ag-cell.cell-col-articulo,
    :host ::ng-deep .ag-cell.cell-col-cantidad-a-comprar,
    :host ::ng-deep .ag-cell.cell-col-nuevo-recurrente,
    :host ::ng-deep .ag-cell.cell-col-prioridad {
      box-sizing: border-box;
      box-shadow:
        inset 0 -1px 0 rgba(33, 50, 83, 0.25),
        inset 1px 0 0 rgba(33, 50, 83, 0.2),
        inset -1px 0 0 rgba(33, 50, 83, 0.2);
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

  hasUnsavedChanges = false;
  loading = false;
  error: string | null = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  readonly tipoOcOptions = [
    'SELECCIONE UNA OPCION',
    'COMPRA INMEDIATA',
    'COMPRA AUTORIZADA EN OTRA FECHA',
    'COMPRA NO AUTORIZADA',
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
        } else {
          this.rebuildAllRowsAndSync();
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

  private rebuildAllRowsAndSync() {
    this.buildRowDataForAllArticulos();
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    this.cdr.detectChanges();
    this.pushRowDataToGridIfReady(true);
  }

  /**
   * Construye un solo dataset: todos los artículos × proveedores (1 fila por combinación),
   * agrupando visualmente el artículo (y cantidad) con rowSpan.
   */
  private buildRowDataForAllArticulos() {
    const rows: any[] = [];

    const proveedores = Array.isArray(this.proveedores) ? this.proveedores : [];
    const blockSize = proveedores.length > 0 ? proveedores.length : 1;

    for (const articulo of this.articulos || []) {
      const preciosPorProv = articulo.precios || {};
      const comprasMinsByProv = articulo.comprasMinimas || {};
      const tiemposEntregaPorProv = articulo.tiemposEntrega || {};
      const cantidadComprar = Number(articulo.cantidad ?? articulo.cantidadComprar ?? 0) || 0;
      const articuloItemId = Number(articulo.id ?? 0) || 0;
      const idSupplie = articulo.idSupplie || 0;
      const rawNumArticle = articulo.numArticle ?? articulo.numArticuloInterno ?? articulo.numarticulo ?? '';
      const tipoOc =
        articulo.typeOc ?? articulo.tipoOc ?? this.tipoOcOptions[0] ?? 'SELECCIONE UNA OPCION';
      const cantidadConceptualizada = Number(
        articulo.cantidadConceptualizada ?? articulo.cantidad_conceptualizada ?? 0
      );
      const comentario = articulo.comment ?? articulo.comentario ?? '';

      const provList = proveedores.length > 0 ? proveedores : [{ id: 0, nombre: '—' }];

      provList.forEach((prov: any, idx: number) => {
        const provId = Number(prov.id ?? 0) || 0;
        const costoUnitario =
          Number(
            preciosPorProv[provId] ??
              preciosPorProv[provId.toString()] ??
              prov.costoUnitario ??
              prov.precio ??
              0
          ) || 0;
        const compraMinima =
          Number(
            comprasMinsByProv[provId] ??
              comprasMinsByProv[provId.toString()] ??
              articulo.compraMinima ??
              1
          ) || 1;
        const costoTotal = costoUnitario * cantidadComprar;
        const costoXCompraMinima = costoUnitario * compraMinima;

        const providerCodigosMap = this.codigosExternos.get(provId) || new Map();
        const codigoExternoProveedor = providerCodigosMap.get(idSupplie) || '';

        rows.push({
          articuloItemId,
          proveedorId: provId,
          proveedorNombre: prov.nombre ?? prov.name ?? (provId ? `Proveedor ${provId}` : '—'),
          cantidadComprar,
          nuevoRecurrente: articulo.recurrent ?? articulo.nuevoRecurrente ?? prov.recurrent ?? '—',
          articulo: articulo.nombre ?? articulo.article ?? '',
          numArticle: rawNumArticle,
          numArticuloInterno: rawNumArticle,
          numArticuloExterno:
            codigoExternoProveedor || (articulo.codigoExterno ?? articulo.numArticuloExterno ?? articulo.observation ?? ''),
          prioridad: articulo.typePriority ?? articulo.prioridad ?? 'NORMAL',
          tiempoEntrega: tiemposEntregaPorProv[provId] ?? tiemposEntregaPorProv[provId.toString()] ?? '',
          compraMinima,
          costoUnitario,
          costoTotal,
          costoXCompraMinima,
          comentario,
          tipoOc,
          cantidadConceptualizada: Number.isFinite(cantidadConceptualizada) ? cantidadConceptualizada : 0,
          __isBlockStart: idx === 0,
          __blockRowSpan: blockSize
        });
      });
    }

    this.rowData = rows;
  }

  private pushRowDataToGridIfReady(_alsoSchedule: boolean) {
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.scheduleAutoSizeColumns();
      }
    }, 0);
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    if (this.rowData?.length) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.setGridOption('columnDefs', this.colDefs);
    }
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
      const itemId = Number(event.data?.articuloItemId ?? 0) || 0;
      for (const row of this.rowData) {
        if (Number(row.articuloItemId ?? 0) !== itemId) {
          continue;
        }
        row.cantidadComprar = qty;
        row.costoTotal = (Number(row.costoUnitario) || 0) * qty;
      }
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }
    if (field === 'tipoOc') {
      const itemId = Number(event.data?.articuloItemId ?? 0) || 0;
      const val = event.newValue;
      for (const row of this.rowData) {
        if (Number(row.articuloItemId ?? 0) !== itemId) {
          continue;
        }
        row.tipoOc = val;
      }
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }
    if (field === 'cantidadConceptualizada') {
      const itemId = Number(event.data?.articuloItemId ?? 0) || 0;
      const v = Number(event.newValue);
      const val = Number.isFinite(v) ? v : 0;
      for (const row of this.rowData) {
        if (Number(row.articuloItemId ?? 0) !== itemId) {
          continue;
        }
        row.cantidadConceptualizada = val;
      }
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
    if (this.rowData.length === 0) {
      return;
    }
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Guardado', 'Selección de proveedores guardada', 'success');
  }

  revert() {
    if (this.rowData.length === 0) {
      return;
    }
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'articulo',
        headerName: 'ARTICULO',
        minWidth: 120,
        editable: false,
        cellClass: 'cell-cantidad-comprar cell-col-articulo',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: { padding: '8px', backgroundColor: '#e8f4fd' },
        wrapText: true
      },
      {
        field: 'cantidadComprar',
        headerName: 'CANTIDAD A COMPRAR',
        minWidth: 120,
        editable: (params: any) => !!params.data?.__isBlockStart,
        cellEditor: 'agNumberCellEditor',
        cellClass: 'cell-cantidad-comprar cell-col-cantidad-a-comprar',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
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
        editable: false,
        cellClass: 'cell-cantidad-comprar cell-col-nuevo-recurrente',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: { padding: '8px', backgroundColor: '#e8f4fd' },
        wrapText: true
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
        minWidth: 120,
        editable: false,
        cellClass: 'cell-cantidad-comprar cell-col-prioridad',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: { padding: '8px', backgroundColor: '#e8f4fd' },
        wrapText: true
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
        minWidth: 320,
        editable: true,
        singleClickEdit: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.tipoOcOptions.filter(opt => opt !== 'SELECCIONE UNA OPCION'),
          searchable: false,
          allowTyping: false
        },
        cellStyle: { textAlign: 'left', padding: '8px' }
      },
      {
        field: 'cantidadConceptualizada',
        headerName: 'CANTIDAD X PROVEEDOR',
        minWidth: 200,
        editable: (params: any) => {
          const tipoOc = params.data?.tipoOc;
          return tipoOc === 'COMPRA INMEDIATA' || tipoOc === 'COMPRA AUTORIZADA EN OTRA FECHA';
        },
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { precision: 2, isFloat: true },
        valueFormatter: (params: any) =>
          params.value != null ? Number(params.value).toFixed(2) : '0.00',
        cellStyle: { textAlign: 'right', padding: '8px' }
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
    stopEditingWhenCellsLoseFocus: false,
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
