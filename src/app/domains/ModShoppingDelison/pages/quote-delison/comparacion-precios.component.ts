import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, Input, Output, EventEmitter, TemplateRef, ViewChild, Renderer2, RendererFactory2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProvidersService } from 'app/services/providers.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, Subscription } from 'rxjs';


@Component({
  selector: 'app-comparacion-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ItemCommentsCellRendererComponent],
  template: `
    <div class="comparacion-container">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h5 class="mb-0">Comparación de Precios por Proveedor</h5>
        <button type="button" class="btn-close" (click)="closed.emit()"></button>
      </div>

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
              [disabled]="rowData.length === 0 || !hasUnsavedChanges || ocGenerada"
              [title]="ocGenerada ? 'Orden de compra ya fue generada' : ''">
              Guardar
              <span
                class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                *ngIf="hasUnsavedChanges && !ocGenerada">
              </span>
            </button>

            <button
              type="button"
              class="btn btn-sm btn-warning"
              (click)="revert()"
              [disabled]="rowData.length === 0 || !hasUnsavedChanges || ocGenerada"
              [title]="ocGenerada ? 'Orden de compra ya fue generada' : ''">
              Deshacer
            </button>
          </div>
        </div>

        <!-- OC Generated notification -->
        <div *ngIf="ocGenerada" class="alert alert-info mb-3" style="flex-shrink: 0;">
          <i class="bi bi-check-circle me-2"></i>
          <strong>Orden de Compra generada:</strong> Esta comparación ya ha sido procesada y no puede ser modificada.
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
            (cellMouseOver)="onCellMouseOver($event)"
            (cellMouseOut)="onCellMouseOut($event)"
            style="width: 100%; flex: 1 1 auto; min-height: 0;">
          </ag-grid-angular>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && !error && articulos.length === 0" class="alert alert-info mb-0">
        <i class="bi bi-info-circle me-2"></i>No hay artículos para comparar en este pedimento.
      </div>
    </div>

    <!-- Overlay para modal de fecha -->
    <div *ngIf="showDatePicker" class="date-picker-overlay">
      <div class="date-picker-modal">
        <div class="modal-header">
          <h5 class="modal-title">Seleccionar Fecha de Compra</h5>
          <button type="button" class="btn-close" (click)="closeDatePicker()"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Fecha:</label>
            <input type="date" class="form-control" [(ngModel)]="selectedDate">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="closeDatePicker()">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="confirmDatePicker()">Guardar</button>
        </div>
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

    /* Centrar todos los encabezados por defecto */
    :host ::ng-deep .ag-header-cell-label {
      justify-content: center;
    }
    :host ::ng-deep .ag-header-cell-text {
      text-align: center;
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

    .date-picker-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    }

    .date-picker-modal {
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
      min-width: 350px;
      z-index: 100000;
    }

    .modal-header {
      padding: 1.25rem;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      margin: 0;
    }

    .modal-body {
      padding: 1.25rem;
    }

    .modal-footer {
      padding: 1.25rem;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `]
})
export class ComparacionPreciosComponent implements OnInit, OnDestroy {
  private ocAndReqsService = inject(OcAndReqsService);
  private providersService = inject(ProvidersService);
  private itemCommentsService = inject(ItemCommentsService);
  private signalsService = inject(SignalsService);
  private cdr = inject(ChangeDetectorRef);
  private ngbModal = inject(NgbModal);
  private materialsService = inject(MaterialsService);
  private renderer: Renderer2;
  private gridApi!: GridApi;
  private codigosExternos: Map<number, Map<number, string>> = new Map();
  private providerSlotMap = new Map<number, { suffix: string; cotizId: number }>();
  private commentSub?: Subscription;
  private tooltipEl: HTMLElement | null = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  @ViewChild('fechaModal') fechaModal!: TemplateRef<any>;

  selectedDate: string = '';
  private currentRowBeingEdited: any = null;
  private dateModalRef?: NgbModalRef;
  showDatePicker: boolean = false;

  @Input() cotizacionId: number = 0;
  @Input() requisitionId: number = 0;
  @Input() selectedProviderIds: number[] = [];
  @Input() idBranchFromReq: number = 0;
  @Output() closed = new EventEmitter<void>();

  ocGenerada = false;

  rowData: any[] = [];
  private originalRowData: any[] = [];
  articulos: any[] = [];
  proveedores: any[] = [];
  // Cache para que AG Grid no re-renderice columnas en cada CD
  private _colDefs: ColDef[] | null = null;

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
    this.loadComparisonData();
  }

  ngOnDestroy() {
    this.commentSub?.unsubscribe();
    this.hideArticuloTooltip();
  }

  private loadComparisonData() {
    if (!this.cotizacionId) {
      this.error = 'No se pudo identificar el pedimento';
      return;
    }

    this.loading = true;
    this.error = null;

    this.ocAndReqsService.getComparisonData(this.cotizacionId).subscribe({
      next: async (data: any) => {
        let proveedores = data.proveedores || [];
        this.articulos = data.articulos || [];

        // Filtrar proveedores para mostrar solo los seleccionados en nivel 2
        if (this.selectedProviderIds.length > 0) {
          proveedores = proveedores.filter((p: any) =>
            this.selectedProviderIds.includes(p.id)
          );
        }

        this.proveedores = proveedores;

        // Cargar asignaciones de materiales (campo11 = Cód. Externo) y slots COTIZ en paralelo
        try {
          await Promise.all([this.loadCodigosExternos(), this.loadCotizSlots()]);
        } catch (err) {
          console.warn('[Comparacion] Error cargando datos auxiliares:', err);
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
        this.codigosExternos.set(prov.id, map);
      } catch (err) {
        console.warn(`[Comparacion] Error cargando códigos externos para proveedor ${prov.id}:`, err);
        this.codigosExternos.set(prov.id, new Map());
      }
    }
  }

  private async loadCotizSlots(): Promise<void> {
    try {
      const cotizData: any = await lastValueFrom(
        this.ocAndReqsService.getOcAndReqs('delison', this.cotizacionId, 'COTIZ')
      );
      const cotizList: any[] = Array.isArray(cotizData) ? cotizData : [];
      this.providerSlotMap.clear();
      for (const cotiz of cotizList) {
        if (!cotiz.idProvider || cotiz.idProvider <= 0) continue;
        const suffix = cotiz.folio?.includes('-A-') ? 'A'
                     : cotiz.folio?.includes('-B-') ? 'B'
                     : cotiz.folio?.includes('-C-') ? 'C' : null;
        if (suffix && !this.providerSlotMap.has(cotiz.idProvider)) {
          this.providerSlotMap.set(cotiz.idProvider, { suffix, cotizId: cotiz.id });
        }
      }
    } catch (e) {
      console.warn('[Comparacion] Error cargando slots COTIZ:', e);
    }
  }

  private async generateOCForSlot(
    provId: number,
    provName: string,
    slot: { suffix: string; cotizId: number },
    rows: any[]
  ): Promise<string> {
    const idRoot   = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = this.idBranchFromReq || this.signalsService.getBranchSelectedBySidebar()();
    const folio    = `OC-${this.cotizacionId}-${slot.suffix}-${Date.now()}`;

    const ocPayload = {
      idRoot,
      folio,
      typeReference: 'branch',
      idReference:   idBranch || 0,
      idReq:         this.requisitionId || 0,
      dateCreate:    new Date().toISOString().split('T')[0],
      idProvider:    provId,
      solicit:       provName.substring(0, 50),
      idDepartament: 0,
      delivery:      'NO APLICA',
      deliveryTime:  '1 DAY',
      typeOc:        'INSUMOS',
      idPayment:     0,
      idCurrency:    0,
      type:          'OC',
      datesupply:    new Date().toISOString().split('T')[0],
      active:        true
    };

    const created: any = await lastValueFrom(this.ocAndReqsService.addOcAndReq(ocPayload));
    const newOcId = Number(created?.id ?? created?.data?.id ?? 0);
    if (!newOcId || newOcId <= 0) throw new Error('No se obtuvo id del OC');

    const details = rows.map((row: any) => ({
      idMovement:   newOcId,
      idSupplie:    row.idSupplie || 0,
      idProvider:   provId,
      nameProvider: provName,
      quantity:     Number(row.cantidadConceptualizada) > 0 ? Number(row.cantidadConceptualizada) : Number(row.cantidadComprar) || 0,
      price:        Number(row.costoUnitario) || 0,
      type:         'OC',
      tiempoEntrega: row.tiempoEntrega || '',
      compraMinima:  Number(row.compraMinima) || 1,
      autorizado:    true,
      active:        true,
      recurrent:     row.nuevoRecurrente || 'Recurrente',
      nameArticle:   row.articulo || '',
      numArticle:    String(row.numArticuloInterno || ''),
      observation:   row.numArticuloExterno || '',
      typeOc:        row.tipoOc || '',
      comment:       '',
      datePostpone:  null
    }));

    for (const detail of details) {
      await lastValueFrom(this.ocAndReqsService.addReqItem(detail));
    }

    const totalSum = details.reduce((s, d) => s + d.quantity * d.price, 0);
    await lastValueFrom(this.ocAndReqsService.setCountItem(newOcId, details.length)).catch(() => {});
    await lastValueFrom(this.ocAndReqsService.setTotal(newOcId, totalSum)).catch(() => {});

    return folio;
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
      const cantidadesPorProv = articulo.cantidades || {};
      const slotItemIdsPorProv = articulo.slotItemIds || {};
      const tiposOcPorProv = articulo.tiposOc || {};
      const cantidadComprar = Number(articulo.cantidad ?? articulo.cantidadComprar ?? 0) || 0;
      const articuloItemId = Number(articulo.id ?? 0) || 0;
      const idSupplie = articulo.idSupplie || 0;
      const rawNumArticle = articulo.numArticle ?? articulo.numArticuloInterno ?? articulo.numarticulo ?? '';
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
        const cantidadConceptualizada =
          Number(cantidadesPorProv[provId] ?? cantidadesPorProv[provId.toString()] ?? 0) || 0;
        const slotItemId =
          Number(slotItemIdsPorProv[provId] ?? slotItemIdsPorProv[provId.toString()] ?? 0) || 0;
        const tipoOc =
          tiposOcPorProv[provId] ?? tiposOcPorProv[provId.toString()] ?? 'SELECCIONE UNA OPCION';
        const costoTotal = costoUnitario * cantidadComprar;
        const costoXCompraMinima = costoUnitario * compraMinima;

        const providerCodigosMap = this.codigosExternos.get(provId) || new Map();
        const codigoExternoProveedor = providerCodigosMap.get(idSupplie) || '';

        rows.push({
          articuloItemId,
          slotItemId,
          idSupplie,
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
          cantidadConceptualizada,
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
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.scheduleAutoSizeColumns();
      }
    }, 0);
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
    if (this.rowData?.length) {
      this.gridApi.setGridOption('rowData', this.rowData);
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

  private getValidatedCantidadConceptualizada(rawValue: any, row: any) {
    const cantidadComprar = Number(row?.cantidadComprar) || 0;
    const cantidadCapturada = Number(rawValue);
    const cantidadNormalizada = Number.isFinite(cantidadCapturada) ? cantidadCapturada : 0;

    return Math.min(Math.max(cantidadNormalizada, 0), cantidadComprar);
  }

  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;
    const field = event.colDef?.field;

    // Detectar cambio a "COMPRA AUTORIZADA EN OTRA FECHA"
    if (field === 'tipoOc' && event.newValue === 'COMPRA AUTORIZADA EN OTRA FECHA') {
      this.currentRowBeingEdited = event.data;
      this.selectedDate = event.data.datePostpone ? String(event.data.datePostpone).substring(0, 10) : '';
      this.openDateModal();
      return;
    }

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
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }
    }
    if (field === 'cantidadConceptualizada') {
      const cantidadValidada = this.getValidatedCantidadConceptualizada(event.newValue, event.data);
      event.data.cantidadConceptualizada = cantidadValidada;
      if (Number(event.newValue) > Number(event.data?.cantidadComprar ?? 0)) {
        alerts.basicAlert(
          'Cantidad inválida',
          'La cantidad por proveedor no puede ser mayor a la cantidad a comprar.',
          'warning'
        );
      }
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
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

  async save() {
    if (this.rowData.length === 0) return;

    for (const row of this.rowData) {
      const cantidadValidada = this.getValidatedCantidadConceptualizada(row.cantidadConceptualizada, row);
      if (cantidadValidada !== (Number(row.cantidadConceptualizada) || 0)) {
        row.cantidadConceptualizada = cantidadValidada;
        alerts.basicAlert(
          'Cantidad inválida',
          'Existe una cantidad por proveedor mayor a la cantidad a comprar. Se ajustó antes de guardar.',
          'warning'
        );
        if (this.gridApi) {
          this.gridApi.refreshCells({ force: true });
        }
        return;
      }
    }

    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];
    const NOT_AUTHORIZED = ['COMPRA NO AUTORIZADA', 'CAMBIO DE ESPECIFICACIONES', 'ARTICULO NO AUTORIZADO'];

    // Verificar si hay OCs autorizadas para generar
    const hasAuthorizedRows = this.rowData.some((row: any) =>
      AUTHORIZED.includes(row.tipoOc) && Number(row.cantidadConceptualizada) > 0
    );

    if (hasAuthorizedRows) {
      // Mostrar confirmación antes de generar
      const result = await alerts.confirmAlert(
        'Generar Orden de Compra',
        'Vas a generar la orden de compra. Una vez generada, ya no podrás modificar la información de esta comparación. ¿Deseas continuar?',
        'question',
        'Sí, continuar'
      );

      if (!result.isConfirmed) {
        return;
      }
    }

    // 1. Guardar typeOc por slot COTIZ (independiente por proveedor)
    for (const row of this.rowData) {
      if (row.slotItemId > 0) {
        await lastValueFrom(
          this.ocAndReqsService.patchTypeOc(row.slotItemId, row.tipoOc || '')
        ).catch(e =>
          console.warn(`⚠️ No se pudo guardar typeOc para slotItem ${row.slotItemId}:`, e)
        );

        // Si el tipo es positivo, desmarcar "Por autorizar" en proveedorxtablas
        if (AUTHORIZED.includes(row.tipoOc) && row.idSupplie > 0 && row.proveedorId > 0) {
          await lastValueFrom(
            this.ocAndReqsService.patchProveedorXTablaCampo7(row.idSupplie, row.proveedorId, false)
          ).catch(e =>
            console.warn(`⚠️ No se pudo desmarcar "Por autorizar" para material ${row.idSupplie} proveedor ${row.proveedorId}:`, e)
          );
        }

        // Si el tipo es NEGATIVO, desactivar proveedor y sucursales para este material
        if (NOT_AUTHORIZED.includes(row.tipoOc) && row.idSupplie > 0 && row.proveedorId > 0) {
          await lastValueFrom(
            this.ocAndReqsService.deactivateProveedorForMaterial(row.idSupplie, row.proveedorId)
          ).catch(e =>
            console.warn(`⚠️ No se pudo desactivar proveedor para material ${row.idSupplie} proveedor ${row.proveedorId}:`, e)
          );
        }
      }
    }

    // 1.5. Guardar cantidadConceptualizada en cada item del slot COTIZ
    for (const row of this.rowData) {
      if (row.slotItemId > 0) {
        await lastValueFrom(
          this.ocAndReqsService.patchCantidadConceptualizada(row.slotItemId, row.cantidadConceptualizada ?? 0)
        ).catch(e =>
          console.warn(`⚠️ No se pudo guardar cantidadConceptualizada para slotItem ${row.slotItemId}:`, e)
        );
      }
    }

    // 2. Generar OC por slot si hay filas autorizadas con cantidadConceptualizada > 0
    const rowsByProvider = new Map<number, any[]>();
    for (const row of this.rowData) {
      if (AUTHORIZED.includes(row.tipoOc) && Number(row.cantidadConceptualizada) > 0) {
        const list = rowsByProvider.get(row.proveedorId) || [];
        list.push(row);
        rowsByProvider.set(row.proveedorId, list);
      }
    }

    const generatedFolios: string[] = [];

    if (rowsByProvider.size > 0) {
      const idBranch = this.idBranchFromReq || this.signalsService.getBranchSelectedBySidebar()();

      if (!idBranch || idBranch <= 0 || idBranch === -9) {
        alerts.basicAlert(
          'Sucursal inválida',
          'No se puede generar orden de compra sin una sucursal válida. Por favor, verifique la requisición.',
          'error'
        );
        return;
      }

      const count = rowsByProvider.size;
      const loadingTitle = count === 1 ? 'Generando orden de compra' : 'Generando órdenes de compra';
      const loadingText = count === 1
        ? 'Creando la orden de compra, por favor espere...'
        : `Creando ${count} órdenes de compra, por favor espere...`;
      alerts.showLoading(loadingTitle, loadingText);
    }

    for (const [provId, rows] of rowsByProvider) {
      const slot = this.providerSlotMap.get(provId);
      if (!slot) { console.warn(`⚠️ Sin slot COTIZ para proveedor ${provId}`); continue; }
      const provName = rows[0]?.proveedorNombre || `Proveedor ${provId}`;
      try {
        const folio = await this.generateOCForSlot(provId, provName, slot, rows);
        generatedFolios.push(folio);
      } catch (e) {
        console.error(`❌ Error generando OC para proveedor ${provId}:`, e);
      }
    }

    // Desmarcar porAutorizar para artículos "Nuevo" con OC generada
    if (generatedFolios.length > 0) {
      await this.updatePorAutorizarAfterOC();
    }

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;

    if (generatedFolios.length > 0) {
      this.ocGenerada = true;
      this.cdr.detectChanges();
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
      }
      alerts.closeLoading();
      alerts.basicAlert('OC Generada', `Órdenes de compra generadas:\n${generatedFolios.join('\n')}`, 'success');
    } else {
      alerts.basicAlert('Guardado', 'Tipos de OC guardados correctamente', 'success');
    }
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

  private openDateModal() {
    this.showDatePicker = true;
  }

  closeDatePicker() {
    this.showDatePicker = false;
    this.currentRowBeingEdited = null;
  }

  confirmDatePicker() {
    if (this.currentRowBeingEdited && this.selectedDate) {
      this.currentRowBeingEdited.datePostpone = this.selectedDate;
    }
    this.showDatePicker = false;
    this.currentRowBeingEdited = null;
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }

  private async updatePorAutorizarAfterOC(): Promise<void> {
    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];
    const idRoot = this.signalsService.getRootSelectedBySidebar()();

    for (const row of this.rowData) {
      const isNewArticle = (row.nuevoRecurrente || '').toLowerCase() === 'nuevo';
      const hasAuthorizedType = AUTHORIZED.includes(row.tipoOc);
      const hasMaterialId = row.idSupplie && row.idSupplie > 0;

      if (isNewArticle && hasAuthorizedType && hasMaterialId) {
        const materialData = {
          idCompany: idRoot,
          idBranch: null,
          idCustomer: null,
          insumo: row.articulo || '',
          articulo: row.articulo || '',
          idCategory: null,
          idFamilia: null,
          idSubfamilia: null,
          idMedida: null,
          idUbication: null,
          description: row.articulo || '',
          merma: 0,
          fecha: new Date().toISOString(),
          aplicaResg: false,
          costoMN: 0,
          costoDLL: 0,
          ventaMN: 0,
          ventaDLL: 0,
          stockMin: 0,
          stockMax: 0,
          picture: '',
          typeMaterial: 'CONSUMABLE',
          vigente: true,
          active: true,
          porAutorizar: false
        };

        await lastValueFrom(
          this.materialsService.updateMaterial(row.idSupplie.toString(), materialData)
        ).catch(() => {
          // Error silencioso
        });
      }
    }
  }

  onCellMouseOver(event: any): void {
    if (event.colDef?.field !== 'articulo') return;
    const data = event.data;
    if (!data) return;
    const cellEl = event.event?.target as HTMLElement;
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    this.showArticuloTooltip(rect, data);
  }

  onCellMouseOut(event: any): void {
    if (event.colDef?.field !== 'articulo') return;
    this.hideArticuloTooltip();
  }

  private showArticuloTooltip(cellRect: DOMRect, data: any): void {
    this.hideArticuloTooltip();

    this.tooltipEl = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipEl, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipEl, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipEl, 'min-width', '300px');
    this.renderer.setStyle(this.tooltipEl, 'max-width', '400px');
    this.renderer.setStyle(this.tooltipEl, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');
    this.renderer.setStyle(this.tooltipEl, 'border-radius', '8px');
    this.renderer.setStyle(this.tooltipEl, 'box-shadow', '0 8px 24px rgba(0,0,0,0.4)');
    this.renderer.setStyle(this.tooltipEl, 'padding', '12px 14px');
    this.renderer.setStyle(this.tooltipEl, 'color', '#ffffff');
    this.renderer.setStyle(this.tooltipEl, 'font-size', '12px');
    this.renderer.setStyle(this.tooltipEl, 'line-height', '1.6');

    const rows = [
      { label: 'Nuevo/Recurrente:', value: data.nuevoRecurrente || '—' },
      { label: '# Artículo Interno:', value: data.numArticuloInterno || '—' },
      { label: '# Artículo Externo:', value: data.numArticuloExterno || '—' },
      { label: 'Prioridad:', value: data.prioridad || '—' }
    ];

    const title = this.renderer.createElement('div');
    this.renderer.setStyle(title, 'font-weight', '600');
    this.renderer.setStyle(title, 'font-size', '13px');
    this.renderer.setStyle(title, 'margin-bottom', '8px');
    this.renderer.appendChild(title, this.renderer.createText('Información del Artículo'));
    this.renderer.appendChild(this.tooltipEl, title);

    rows.forEach(({ label, value }, idx) => {
      const row = this.renderer.createElement('div');
      this.renderer.setStyle(row, 'display', 'flex');
      this.renderer.setStyle(row, 'gap', '8px');
      if (idx < rows.length - 1) this.renderer.setStyle(row, 'margin-bottom', '6px');

      const labelEl = this.renderer.createElement('span');
      this.renderer.setStyle(labelEl, 'color', 'rgba(255,255,255,0.8)');
      this.renderer.setStyle(labelEl, 'font-weight', '600');
      this.renderer.setStyle(labelEl, 'min-width', '140px');
      this.renderer.setStyle(labelEl, 'flex-shrink', '0');
      this.renderer.appendChild(labelEl, this.renderer.createText(label));
      this.renderer.appendChild(row, labelEl);

      const valueEl = this.renderer.createElement('span');
      this.renderer.appendChild(valueEl, this.renderer.createText(value));
      this.renderer.appendChild(row, valueEl);

      this.renderer.appendChild(this.tooltipEl!, row);
    });

    this.renderer.appendChild(document.body, this.tooltipEl);
    this.renderer.setStyle(this.tooltipEl, 'top', `${cellRect.top}px`);
    this.renderer.setStyle(this.tooltipEl, 'left', `${cellRect.right + 10}px`);
  }

  private hideArticuloTooltip(): void {
    if (this.tooltipEl) {
      this.renderer.removeChild(document.body, this.tooltipEl);
      this.tooltipEl = null;
    }
  }

  get colDefs(): ColDef[] {
    if (this._colDefs) return this._colDefs;
    this._colDefs = [
      {
        field: 'articulo',
        headerName: 'ARTICULO',
        minWidth: 120,
        pinned: 'left',
        lockPinned: true,
        lockPosition: 'left',
        editable: false,
        cellClass: 'cell-cantidad-comprar cell-col-articulo',
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
        field: 'tiempoEntrega',
        headerName: 'T. ENTREGA X SEMANA',
        minWidth: 120,
        editable: false,
        cellStyle: { padding: '8px' }
      },
      {
        field: 'compraMinima',
        headerName: 'COMPRA MINIMA',
        minWidth: 110,
        editable: false,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center', padding: '8px' }
      },
      {
        field: 'cantidadComprar',
        headerName: 'CANTIDAD REQUERIDA',
        minWidth: 120,
        editable: false,
        cellEditor: 'agNumberCellEditor',
        cellClass: 'cell-cantidad-comprar cell-col-cantidad-a-comprar',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: { padding: '8px', backgroundColor: '#e8f4fd' },
        wrapText: true
      },
      {
        field: 'nuevoRecurrente',
        headerName: 'NUEVO RECURRENTE',
        minWidth: 130,
        hide: true
      },
      {
        field: 'numArticuloInterno',
        headerName: '# ARTICULO INTERNO',
        minWidth: 130,
        hide: true
      },
      {
        field: 'numArticuloExterno',
        headerName: '# ARTICULO EXTERNO',
        minWidth: 130,
        hide: true
      },
      {
        field: 'prioridad',
        headerName: 'PRIORIDAD',
        minWidth: 120,
        hide: true
      },
      {
        field: 'costoUnitario',
        headerName: 'COSTO UNITARIO',
        minWidth: 120,
        editable: false,
        type: 'numericColumn',
        cellStyle: { backgroundColor: '#fff9c4', textAlign: 'center', padding: '8px' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'costoTotal',
        headerName: 'COSTO TOTAL',
        minWidth: 120,
        editable: false,
        cellStyle: { backgroundColor: '#c8e6c9', fontWeight: '600', padding: '8px', textAlign: 'center' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'costoXCompraMinima',
        headerName: 'COSTO X COMPRA MINIMA',
        minWidth: 150,
        editable: false,
        cellStyle: { textAlign: 'center', padding: '8px' },
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
        // Función para leer opciones actuales sin regenerar colDefs
        cellEditorParams: () => ({
          values: this.tipoOcOptions.filter(opt => opt !== 'SELECCIONE UNA OPCION'),
          searchable: false,
          allowTyping: false
        }),
        cellStyle: { textAlign: 'center', padding: '8px' }
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
        cellEditorParams: (params: any) => ({
          precision: 2,
          isFloat: true,
          min: 0,
          max: Number(params.data?.cantidadComprar) || 0
        }),
        valueFormatter: (params: any) =>
          params.value != null ? Number(params.value).toFixed(2) : '0.00',
        cellStyle: { textAlign: 'center', padding: '8px' }
      }
    ];
    return this._colDefs;
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
      minWidth: 90,
      cellStyle: { textAlign: 'center' }
    },
    suppressCellFocus: false
  };
}
