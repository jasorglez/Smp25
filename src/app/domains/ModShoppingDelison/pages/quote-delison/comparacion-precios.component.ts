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
import { lastValueFrom, Subscription, take } from 'rxjs';


@Component({
  selector: 'app-comparacion-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ItemCommentsCellRendererComponent],
  template: `
    <div class="comparacion-container">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h5 class="mb-0" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
          Comparación de Precios por Proveedor
          <span *ngIf="departmentName"
                style="background:#6a1b9a; color:#fff; border-radius:4px; padding:2px 8px; font-size:0.82rem; font-weight:700; margin-left:8px; letter-spacing:1px; text-transform: uppercase;">
            {{ departmentName }}
          </span>
          <span *ngIf="requisitionFolio"
                style="background:#2e7d32; color:#fff; border-radius:4px; padding:2px 8px; font-size:0.82rem; font-weight:700; margin-left:8px; letter-spacing:1px;">
            {{ requisitionFolio }}
          </span>
          <span *ngIf="cotizacionFolio"
                style="background:#1565c0; color:#fff; border-radius:4px; padding:2px 8px; font-size:0.82rem; font-weight:700; margin-left:6px; letter-spacing:1px;">
            {{ cotizacionFolio }}
          </span>
          <!-- Estado OC -->
          <span [style.background]="ocGenerada ? '#b71c1c' : '#388e3c'"
                style="color:#fff; border-radius:4px; padding:2px 8px; font-size:0.75rem; font-weight:700; margin-left:6px; letter-spacing:1px; display:inline-flex; align-items:center; gap:4px;">
            <i [class]="ocGenerada ? 'bi bi-lock-fill' : 'bi bi-unlock-fill'" style="font-size:0.7rem;"></i>
            {{ ocGenerada ? 'CERRADA' : 'ABIERTA' }}
          </span>
          <!-- Pares Pedimento → OC generadas -->
          <span *ngFor="let par of ocPairs"
                style="background:#e65100; color:#fff; border-radius:4px; padding:2px 8px; font-size:0.78rem; font-weight:700; margin-left:4px; letter-spacing:0.5px; display:inline-flex; align-items:center; gap:4px;">
            <i class="bi bi-file-earmark-check" style="font-size:0.7rem;"></i>
            {{ par.pedimento }} → {{ par.oc }}
          </span>
        </h5>
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
              (click)="saveOnly()"
              [disabled]="rowData.length === 0 || !hasUnsavedChanges || ocGenerada"
              [title]="ocGenerada ? 'Comparación cerrada' : ''">
              Guardar
              <span
                class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                *ngIf="hasUnsavedChanges && !ocGenerada">
              </span>
            </button>

            <button
              type="button"
              class="btn btn-sm btn-primary position-relative"
              (click)="generateOC()"
              [disabled]="rowData.length === 0 || ocGenerada"
              [title]="ocGenerada ? 'Comparación cerrada' : 'Generar Orden(es) de Compra'">
              <i class="bi bi-file-earmark-check me-1"></i>Generar OC
            </button>

            <button
              type="button"
              class="btn btn-sm btn-warning"
              (click)="revert()"
              [disabled]="rowData.length === 0 || !hasUnsavedChanges || ocGenerada"
              [title]="ocGenerada ? 'Comparación cerrada' : ''">
              Deshacer
            </button>
          </div>
        </div>

        <!-- Banner CERRADA -->
        <div *ngIf="ocGenerada"
             style="flex-shrink: 0; background: #b71c1c; color: #fff; font-weight: 700; font-size: 1rem;
                    letter-spacing: 2px; text-align: center; padding: 8px 16px; border-radius: 6px;
                    margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 10px;">
          <i class="bi bi-lock-fill"></i>
          CERRADA — Órdenes de compra generadas. Esta comparación no puede modificarse.
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

    /* Evitar que al abrir el editor (TIPO OC) se "parta" el contenido en ARTICULO/CANTIDAD */
    :host ::ng-deep .ag-cell.cell-col-articulo .ag-cell-value,
    :host ::ng-deep .ag-cell.cell-col-cantidad-a-comprar .ag-cell-value {
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      min-width: 0 !important;
      width: 100% !important;
      display: block !important;
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
  private slotFolioMap   = new Map<string, string>(); // suffix → folio COTIZ (Pedimento-1, -2, -3)
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
  @Input() cotizacionFolio: string = '';
  @Input() requisitionId: number = 0;
  @Input() requisitionFolio: string = '';
  @Input() selectedProviderIds: number[] = [];
  @Input() idBranchFromReq: number = 0;
  @Input() idDepartamentFromReq: number = 0;
  @Input() departmentName: string = '';
  @Output() closed = new EventEmitter<void>();

  ocGenerada = false;
  ocPairs: { pedimento: string; oc: string }[] = [];
  proveedoresConOc: Set<number> = new Set();

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
        this.ocGenerada = data.locked === true;

        // Filtrar proveedores para mostrar solo los seleccionados en nivel 2
        if (this.selectedProviderIds.length > 0) {
          proveedores = proveedores.filter((p: any) =>
            this.selectedProviderIds.includes(p.id)
          );
        }

        this.proveedores = proveedores;

        // loadCotizSlots PRIMERO: loadExistingOcFolios depende de slotFolioMap
        try {
          await this.loadCotizSlots();
          const auxLoads: Promise<void>[] = [this.loadCodigosExternos()];
          if (this.requisitionId) auxLoads.push(this.loadExistingOcFolios());
          await Promise.all(auxLoads);
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
      this.slotFolioMap.clear();
      for (const cotiz of cotizList) {
        if (!cotiz.idProvider || cotiz.idProvider <= 0) continue;
        const suffix = cotiz.folio?.includes('-A-') ? 'A'
                     : cotiz.folio?.includes('-B-') ? 'B'
                     : cotiz.folio?.includes('-C-') ? 'C' : null;
        if (suffix) {
          if (!this.providerSlotMap.has(cotiz.idProvider)) {
            this.providerSlotMap.set(cotiz.idProvider, { suffix, cotizId: cotiz.id });
          }
          if (!this.slotFolioMap.has(suffix)) {
            this.slotFolioMap.set(suffix, cotiz.folio || `Pedimento-${suffix}`);
          }
        }
      }
    } catch (e) {
      console.warn('[Comparacion] Error cargando slots COTIZ:', e);
    }
  }

  private async loadExistingOcFolios(): Promise<void> {
    try {
      const ocs: any = await lastValueFrom(this.ocAndReqsService.getOcsByRequisition(this.requisitionId));
      const list = Array.isArray(ocs) ? ocs : [];
      this.proveedoresConOc.clear();
      this.ocPairs = list
        .map((oc: any) => {
          const folio = oc.folio || '';
          if (!folio) return null;
          const suffix = folio.includes('-A-') ? 'A' : folio.includes('-B-') ? 'B' : folio.includes('-C-') ? 'C' : '';
          const pedimento = suffix ? (this.slotFolioMap.get(suffix) || `Pedimento-${suffix}`) : '';
          if (Number(oc.idProvider) > 0) this.proveedoresConOc.add(Number(oc.idProvider));
          return { pedimento, oc: folio };
        })
        .filter(Boolean) as { pedimento: string; oc: string }[];
    } catch {
      this.ocPairs = [];
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
    const reqFolio        = this.requisitionFolio || `REQ-${this.requisitionId}`;
    const reqFolioClean   = reqFolio.replace(/-/g, '');
    const pedimentoMatch  = this.cotizacionFolio.match(/(\d+)/);
    const pedimentoNumber = pedimentoMatch ? parseInt(pedimentoMatch[1], 10) : (slot.suffix === 'A' ? 1 : slot.suffix === 'B' ? 2 : 3);
    const provPrefix      = (provName || '').substring(0, 3).toUpperCase() || 'OC';
    const folio           = `OC-${reqFolioClean}-P${pedimentoNumber}-${provPrefix}${provId}`;

    const ocPayload = {
      idRoot,
      folio,
      typeReference: 'branch',
      idReference:   idBranch || 0,
      idReq:         this.requisitionId || 0,
      dateCreate:    new Date().toISOString().split('T')[0],
      idProvider:    provId,
      solicit:       provName.substring(0, 50),
      idDepartament: this.idDepartamentFromReq || 0,
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
      }
    }, 0);
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
    if (this.rowData?.length) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  onFirstDataRendered(_params: any) {}

  onRowDataUpdated() {}

  private getValidatedCantidadConceptualizada(rawValue: any, row: any) {
    const cantidadComprar = Number(row?.cantidadComprar) || 0;
    const cantidadCapturada = Number(rawValue);
    const cantidadNormalizada = Number.isFinite(cantidadCapturada) ? cantidadCapturada : 0;

    const articuloItemId = Number(row?.articuloItemId ?? 0);
    const sumOtros = this.rowData
      .filter(r => Number(r.articuloItemId ?? 0) === articuloItemId && r !== row)
      .reduce((acc, r) => acc + (Number(r.cantidadConceptualizada) || 0), 0);

    const maxAllowed = Math.max(0, cantidadComprar - sumOtros);
    return Math.min(Math.max(cantidadNormalizada, 0), maxAllowed);
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
      const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];
      const isNegative = !AUTHORIZED.includes(event.newValue);

      if (event.newValue === 'ARTICULO NO AUTORIZADO') {
        const articuloItemId = Number(event.data?.articuloItemId ?? 0);
        if (articuloItemId > 0) {
          // Guardar valores anteriores antes de modificar para poder revertir
          const savedValues = new Map<any, { tipoOc: string; cantidad: number }>();
          for (const row of this.rowData) {
            if (Number(row.articuloItemId) === articuloItemId) {
              savedValues.set(row, { tipoOc: row.tipoOc, cantidad: row.cantidadConceptualizada ?? 0 });
              row.tipoOc = 'ARTICULO NO AUTORIZADO';
              row.cantidadConceptualizada = 0;
            }
          }
          const affectedNodes: any[] = [];
          this.gridApi?.forEachNode((node: any) => {
            if (Number(node.data?.articuloItemId) === articuloItemId) affectedNodes.push(node);
          });
          this.gridApi?.refreshCells({ rowNodes: affectedNodes, force: true });

          const numArticle = event.data?.numArticle || event.data?.numArticuloInterno || '';
          if (numArticle && this.requisitionId) {
            this.openNegativeTypeChat(numArticle, event.newValue, () => {
              for (const [row, saved] of savedValues) {
                row.tipoOc = saved.tipoOc;
                row.cantidadConceptualizada = saved.cantidad;
              }
              this.gridApi?.refreshCells({ rowNodes: affectedNodes, force: true });
            });
          }
          return;
        }
      }

      if (isNegative) {
        const oldCantidad = event.data.cantidadConceptualizada ?? 0;
        event.data.cantidadConceptualizada = 0;
        this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });

        const numArticle = event.data?.numArticle || event.data?.numArticuloInterno || '';
        if (numArticle && this.requisitionId) {
          this.openNegativeTypeChat(numArticle, event.newValue, () => {
            event.data.tipoOc = event.oldValue;
            event.data.cantidadConceptualizada = oldCantidad;
            this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
          });
        }
        return;
      }

      this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
    }
    if (field === 'cantidadConceptualizada') {
      const cantidadValidada = this.getValidatedCantidadConceptualizada(event.newValue, event.data);
      event.data.cantidadConceptualizada = cantidadValidada;
      if (cantidadValidada < Number(event.newValue)) {
        const cantidadComprar = Number(event.data?.cantidadComprar) || 0;
        const articuloItemId = Number(event.data?.articuloItemId ?? 0);
        const sumOtros = this.rowData
          .filter(r => Number(r.articuloItemId ?? 0) === articuloItemId && r !== event.data)
          .reduce((acc, r) => acc + (Number(r.cantidadConceptualizada) || 0), 0);
        const maxAllowed = Math.max(0, cantidadComprar - sumOtros);
        alerts.basicAlert(
          'Cantidad inválida',
          `La suma de cantidades por proveedor no puede superar la cantidad requerida (${cantidadComprar}). Máximo permitido para este proveedor: ${maxAllowed.toFixed(2)}.`,
          'warning'
        );
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

  async saveOnly() {
    if (this.rowData.length === 0) return;

    for (const row of this.rowData) {
      const cantidadValidada = this.getValidatedCantidadConceptualizada(row.cantidadConceptualizada, row);
      if (cantidadValidada !== (Number(row.cantidadConceptualizada) || 0)) {
        row.cantidadConceptualizada = cantidadValidada;
        alerts.basicAlert(
          'Cantidad inválida',
          'La suma de cantidades asignadas a los proveedores supera la cantidad requerida del artículo. Se ajustó el valor antes de guardar.',
          'warning'
        );
        if (this.gridApi) this.gridApi.refreshCells({ force: true });
        return;
      }
    }

    await this.patchRegistros();

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Guardado', 'Registro guardado correctamente', 'success');
  }

  async generateOC() {
    if (this.rowData.length === 0 || this.ocGenerada) return;

    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];

    // Items sin tipoOc — pendientes de decisión
    const sinTipo = this.rowData.filter(
      (row: any) => !row.tipoOc || row.tipoOc === '' || row.tipoOc === 'SELECCIONE UNA OPCION'
    );
    const allTotalizado = sinTipo.length === 0;

    // Agrupar filas autorizadas con cantidadConceptualizada > 0 por proveedor
    const rowsByProvider = new Map<number, any[]>();
    for (const row of this.rowData) {
      if (AUTHORIZED.includes(row.tipoOc) && Number(row.cantidadConceptualizada) > 0) {
        const list = rowsByProvider.get(row.proveedorId) || [];
        list.push(row);
        rowsByProvider.set(row.proveedorId, list);
      }
    }

    if (rowsByProvider.size === 0) {
      alerts.basicAlert(
        'Sin filas para generar',
        'No hay filas con tipo autorizado y cantidad asignada. Verifica los tipos de OC y las cantidades por proveedor.',
        'warning'
      );
      return;
    }

    const idBranch = this.idBranchFromReq || this.signalsService.getBranchSelectedBySidebar()();
    if (!idBranch || idBranch <= 0 || idBranch === -9) {
      alerts.basicAlert('Sucursal inválida', 'No se puede generar orden de compra sin una sucursal válida.', 'error');
      return;
    }

    const count = rowsByProvider.size;
    const confirmMsg = allTotalizado
      ? `Se generará${count > 1 ? 'n' : ''} ${count} orden${count > 1 ? 'es' : ''} de compra. Todos los artículos tienen tipo OC — la requisición quedará CERRADA y bloqueada. ¿Continuar?`
      : `Se generará${count > 1 ? 'n' : ''} ${count} orden${count > 1 ? 'es' : ''} de compra. Hay ${sinTipo.length} artículo(s) sin tipo OC — la requisición seguirá abierta. ¿Continuar?`;

    const result = await alerts.confirmAlert(
      count === 1 ? 'Generar Orden de Compra' : 'Generar Órdenes de Compra',
      confirmMsg,
      'question',
      'Sí, generar'
    );
    if (!result.isConfirmed) return;

    alerts.showLoading(
      count === 1 ? 'Generando orden de compra' : 'Generando órdenes de compra',
      count === 1 ? 'Creando la orden de compra, por favor espere...' : `Creando ${count} órdenes de compra, por favor espere...`
    );

    // Guardar registro antes de generar
    await this.patchRegistros();

    const generatedFolios: string[] = [];
    const generatedPairs: { pedimento: string; oc: string }[] = [];
    for (const [provId, rows] of rowsByProvider) {
      const slot = this.providerSlotMap.get(provId);
      if (!slot) { console.warn(`⚠️ Sin slot COTIZ para proveedor ${provId}`); continue; }
      const provName = rows[0]?.proveedorNombre || `Proveedor ${provId}`;
      try {
        const folio = await this.generateOCForSlot(provId, provName, slot, rows);
        generatedFolios.push(folio);
        const pedimento = this.slotFolioMap.get(slot.suffix) || `Pedimento-${slot.suffix}`;
        generatedPairs.push({ pedimento, oc: folio });
      } catch (e) {
        console.error(`❌ Error generando OC para proveedor ${provId}:`, e);
      }
    }

    if (generatedFolios.length > 0) {
      await this.updatePorAutorizarAfterOC();
    }

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    this.ocGenerada = allTotalizado;
    this.ocPairs = generatedPairs;
    for (const [provId] of rowsByProvider) this.proveedoresConOc.add(provId);

    // Bloquear la requisición solo si todos los ítems están totalizados
    if (allTotalizado && this.requisitionId) {
      await lastValueFrom(
        this.ocAndReqsService.lockRequisition(this.requisitionId, true)
      ).catch(() => {});
    }

    this.cdr.detectChanges();
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      this.gridApi.refreshCells({ force: true });
    }
    alerts.closeLoading();

    const titulo = allTotalizado
      ? (generatedFolios.length === 1 ? 'OC Generada — CERRADA' : 'OCs Generadas — CERRADA')
      : (generatedFolios.length === 1 ? 'OC Generada — Pendiente' : 'OCs Generadas — Pendiente');

    const mensaje = allTotalizado
      ? `Órdenes de compra generadas:\n${generatedFolios.join('\n')}\n\n✅ Requisición cerrada y bloqueada.`
      : `Órdenes de compra generadas:\n${generatedFolios.join('\n')}\n\n⚠️ Hay ${sinTipo.length} artículo(s) sin tipo OC. La requisición sigue abierta.`;

    alerts.basicAlert(titulo, mensaje, allTotalizado ? 'success' : 'warning');
  }

  private async patchRegistros(): Promise<void> {
    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];
    const NOT_AUTHORIZED = ['COMPRA NO AUTORIZADA', 'CAMBIO DE ESPECIFICACIONES', 'ARTICULO NO AUTORIZADO'];

    for (const row of this.rowData) {
      if (row.slotItemId > 0) {
        await lastValueFrom(
          this.ocAndReqsService.patchTypeOc(row.slotItemId, row.tipoOc || '')
        ).catch(e => console.warn(`⚠️ No se pudo guardar typeOc para slotItem ${row.slotItemId}:`, e));

        if (AUTHORIZED.includes(row.tipoOc) && row.idSupplie > 0 && row.proveedorId > 0) {
          await lastValueFrom(
            this.ocAndReqsService.patchProveedorXTablaCampo7(row.idSupplie, row.proveedorId, false)
          ).catch(e => console.warn(`⚠️ No se pudo desmarcar "Por autorizar":`, e));
        }

        if (NOT_AUTHORIZED.includes(row.tipoOc) && row.idSupplie > 0 && row.proveedorId > 0) {
          await lastValueFrom(
            this.ocAndReqsService.deactivateProveedorForMaterial(row.idSupplie, row.proveedorId)
          ).catch(e => console.warn(`⚠️ No se pudo desactivar proveedor:`, e));
        }

        await lastValueFrom(
          this.ocAndReqsService.patchCantidadConceptualizada(row.slotItemId, row.cantidadConceptualizada ?? 0)
        ).catch(e => console.warn(`⚠️ No se pudo guardar cantidadConceptualizada:`, e));
      }
    }
  }

  private openNegativeTypeChat(numArticle: string, tag: string, onRevert: () => void): void {
    this.itemCommentsService.openChatFor$.next({
      documentType: 'REQ',
      idDocument: this.requisitionId,
      numArticle,
      autoMessage: tag,
      forceComment: true
    });

    let messageSent = false;
    let subSaved: Subscription;
    let subClosed: Subscription;

    const cleanup = () => {
      subSaved?.unsubscribe();
      subClosed?.unsubscribe();
    };

    subSaved = this.itemCommentsService.commentSaved$.pipe(take(1)).subscribe(() => {
      messageSent = true;
    });

    subClosed = this.itemCommentsService.chatClosed$.pipe(take(1)).subscribe(() => {
      if (!messageSent) onRevert();
      cleanup();
    });
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
        width: 150,
        pinned: 'left',
        lockPinned: true,
        lockPosition: 'left',
        editable: false,
        cellClass: 'cell-cantidad-comprar cell-col-articulo',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: {
          padding: '4px',
          backgroundColor: '#e8f4fd',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      },
      {
        field: 'proveedorNombre',
        headerName: 'PROVEEDOR',
        width: 190,
        cellStyle: (params: any) => {
          const locked = this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0));
          return locked
            ? { backgroundColor: '#eeeeee', fontWeight: '500', padding: '4px', color: '#9e9e9e' }
            : { backgroundColor: '#e3f2fd', fontWeight: '500', padding: '4px' };
        },
        cellRenderer: (params: any) => {
          const name = params.value || '';
          const locked = this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0));
          if (!locked) return name;
          return `<span style="display:flex;align-items:center;gap:5px;">${name}<i class="bi bi-lock-fill" style="color:#9e9e9e;font-size:0.75rem;flex-shrink:0;" title="OC generada"></i></span>`;
        }
      },
      {
        field: 'tiempoEntrega',
        headerName: 'T.ENTREGA X SEM.',
        width: 115,
        editable: false,
        cellStyle: { padding: '4px', textAlign: 'center' }
      },
      {
        field: 'compraMinima',
        headerName: 'COMPRA MINIMA',
        width: 110,
        editable: false,
        type: 'numericColumn',
        cellStyle: { textAlign: 'center', padding: '4px' }
      },
      {
        field: 'cantidadComprar',
        headerName: 'CANTIDAD REQUERIDA',
        width: 125,
        editable: false,
        cellEditor: 'agNumberCellEditor',
        cellClass: 'cell-cantidad-comprar cell-col-cantidad-a-comprar',
        headerClass: 'header-cantidad-comprar',
        rowSpan: (params: any) => (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: {
          padding: '4px',
          backgroundColor: '#e8f4fd',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      },
      {
        field: 'nuevoRecurrente',
        headerName: 'NUEVO RECURRENTE',
        width: 120,
        hide: true
      },
      {
        field: 'numArticuloInterno',
        headerName: '# ART. INTERNO',
        width: 130,
        hide: true
      },
      {
        field: 'numArticuloExterno',
        headerName: '# ART. EXTERNO',
        width: 130,
        hide: true
      },
      {
        field: 'prioridad',
        headerName: 'PRIORIDAD',
        width: 90,
        hide: true
      },
      {
        field: 'costoUnitario',
        headerName: 'COSTO UNITARIO',
        width: 110,
        editable: false,
        type: 'numericColumn',
        cellStyle: { backgroundColor: '#fff9c4', textAlign: 'center', padding: '4px' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'costoTotal',
        headerName: 'COSTO TOTAL',
        width: 105,
        editable: false,
        cellStyle: { backgroundColor: '#c8e6c9', fontWeight: '600', padding: '4px', textAlign: 'center' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'costoXCompraMinima',
        headerName: 'COSTO X COMPRA MIN.',
        width: 120,
        editable: false,
        cellStyle: { textAlign: 'center', padding: '4px' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'comentario',
        headerName: 'CHAT',
        width: 88,
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
        cellStyle: { padding: '4px', cursor: 'pointer' }
      },
      {
        field: 'tipoOc',
        headerName: 'TIPO OC',
        width: 150,
        minWidth: 120,
        editable: (params: any) => !this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0)),
        singleClickEdit: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.tipoOcOptions.filter(opt => opt !== 'SELECCIONE UNA OPCION'),
          searchable: false,
          allowTyping: false
        }),
        tooltipValueGetter: (p: any) => p.data?.tipoOc || '',
        cellStyle: (params: any) => {
          const locked = this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0));
          return { textAlign: 'center', padding: '4px', fontSize: '10px', lineHeight: '1.2',
                   backgroundColor: locked ? '#eeeeee' : undefined, color: locked ? '#9e9e9e' : undefined };
        }
      },
      {
        field: 'cantidadConceptualizada',
        headerName: 'CANTIDAD X PROV.',
        width: 135,
        editable: (params: any) => {
          if (this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0))) return false;
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
        cellStyle: (params: any) => {
          const locked = this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0));
          return { textAlign: 'center', padding: '4px',
                   backgroundColor: locked ? '#eeeeee' : undefined, color: locked ? '#9e9e9e' : undefined };
        }
      }
    ];
    return this._colDefs;
  }

  public gridOptions: any = {
    rowHeight: 40,
    enableBrowserTooltips: true,
    autoSizeStrategy: { type: 'fitGridWidth' },
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
      minWidth: 50,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { textAlign: 'center' }
    },
    suppressCellFocus: false
  };
}
