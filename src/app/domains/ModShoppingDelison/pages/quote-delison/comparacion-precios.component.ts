import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, Input, Output, EventEmitter, TemplateRef, ViewChild, Renderer2, RendererFactory2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { UsersService } from 'app/services/users.service';
import { AutorizacionMontoService } from 'app/services/autorizacion-monto.service';
import { SetupService } from 'app/services/setup.service';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { CurrencyService } from 'app/services/currency.service';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';
import { EmpaqueDescripcionService, ProveedorPresentaciones } from 'app/services/empaque-descripcion.service';
import { resolverUnidadArticulo, denomsDeProveedor, UnidadArticulo } from 'app/domains/ModWarehouse/components/requisitionsdelison/presentaciones-unidad.helper';
import { CantidadProveedorPanelComponent } from './cantidad-proveedor-panel.component';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, Subscription, take, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';


@Component({
  selector: 'app-comparacion-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ItemCommentsCellRendererComponent, CantidadProveedorPanelComponent],
  template: `
    <div class="comparacion-container">
      <div class="cmp-header">
        <div class="cmp-titlewrap">
          <h5 class="cmp-title">Comparación de Precios por Proveedor</h5>
          <div class="cmp-badges">
            <span *ngIf="departmentName" class="pill pill-dept">{{ departmentName }}</span>
            <span *ngIf="requisitionFolio" class="pill">{{ requisitionFolio }}</span>
            <span *ngIf="cotizacionFolio" class="pill">{{ cotizacionFolio }}</span>
            <!-- Estado OC -->
            <span class="pill" [class.pill-open]="!ocGenerada" [class.pill-closed]="ocGenerada">
              <i [class]="ocGenerada ? 'bi bi-lock-fill' : 'bi bi-unlock-fill'"></i>
              {{ ocGenerada ? 'CERRADA' : 'ABIERTA' }}
            </span>
            <!-- Pares Pedimento → OC generadas -->
            <span *ngFor="let par of ocPairs" class="pill pill-oc">
              <i class="bi bi-file-earmark-check"></i>
              {{ par.pedimento }} → {{ par.oc }}
            </span>
          </div>
        </div>
        <button type="button" class="btn-close cmp-close" (click)="closed.emit()"></button>
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
          <div class="actions cmp-toolbar d-flex align-items-center gap-2" style="margin-left: auto;">
            <span *ngIf="hasConflictingTipoOc"
                  style="font-size:11px; color:#b71c1c; font-weight:600; display:flex; align-items:center; gap:4px; max-width:320px;">
              <i class="bi bi-exclamation-triangle-fill"></i>
              Un artículo tiene proveedores con tipo OC mixto (rechazo + autorización).
            </span>
            <button
              type="button"
              class="btn btn-sm btn-success position-relative"
              (click)="saveOnly()"
              [disabled]="rowData.length === 0 || !hasUnsavedChanges || ocGenerada || hasConflictingTipoOc"
              [title]="ocGenerada ? 'Comparación cerrada' : hasConflictingTipoOc ? 'Resuelve el conflicto de Tipo OC antes de guardar' : ''">
              Guardar
              <span
                class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                *ngIf="hasUnsavedChanges && !ocGenerada && !hasConflictingTipoOc">
              </span>
            </button>

            <span
              (mouseenter)="showGenerarOcTooltip($event)"
              (mouseleave)="hideGenerarOcTooltip()"
              style="display: inline-block;">
              <button
                type="button"
                class="btn btn-sm btn-primary position-relative"
                (click)="generateOC()"
                [disabled]="rowData.length === 0 || ocGenerada || !savedAtLeastOnce || hasUnsavedChanges || userHasNoNivelMonto || ocAmountExceedsUserLevel"
                [style.pointer-events]="(rowData.length === 0 || ocGenerada || !savedAtLeastOnce || hasUnsavedChanges || userHasNoNivelMonto || ocAmountExceedsUserLevel) ? 'none' : 'auto'">
                <i class="bi bi-file-earmark-check me-1"></i>Generar OC
              </button>
            </span>

            <button
              type="button"
              class="btn btn-sm btn-danger"
              (click)="finalizeReq()"
              [disabled]="rowData.length === 0 || ocGenerada || !allTipoOcNegative || !requisitionId"
              [title]="ocGenerada ? 'Comparación cerrada' : !allTipoOcNegative ? 'Solo se habilita cuando todos los Tipo OC son negativos (COMPRA NO AUTORIZADA, CAMBIO DE ESPECIFICACIONES o ARTICULO NO AUTORIZADO)' : 'Finalizar requisición sin generar órdenes de compra'">
              <i class="bi bi-x-octagon me-1"></i>Finalizar Req
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
        <div *ngIf="ocGenerada" class="cmp-banner-closed">
          <i class="bi bi-lock-fill"></i>
          CERRADA — Órdenes de compra generadas. Esta comparación no puede modificarse.
        </div>

        <div class="cmp-gridwrap" style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
          <ag-grid-angular
            #agGrid
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="gridRowData"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            [localeText]="AG_GRID_LOCALE_ES"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
            (gridSizeChanged)="onGridSizeChanged()"
            (rowDataUpdated)="onRowDataUpdated()"
            (cellValueChanged)="onCellValueChanged($event)"
            (cellMouseOver)="onCellMouseOver($event)"
            (cellMouseOut)="onCellMouseOut($event)"
            (columnResized)="onColumnResized()"
            style="width: 100%; flex: 0 0 auto;">
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

    <!-- Modal: Cantidad x Prov. por presentaciones (bultos/cajas/etc.) -->
    <app-cantidad-proveedor-panel
      *ngIf="cantidadPanelOpen"
      [articleName]="cantidadPanelArticle"
      [proveedorName]="cantidadPanelProveedor"
      [unidad]="cantidadPanelUnidad"
      [esPieza]="cantidadPanelEsPieza"
      [minCompra]="cantidadPanelMinCompra"
      [cantidadRequerida]="cantidadPanelRequerida"
      [yaAsignadoOtros]="cantidadPanelAsignadoOtros"
      [cantidadActual]="cantidadPanelActual"
      [presentaciones]="cantidadPanelDenoms"
      (seleccionar)="onCantidadPanelSeleccionar($event)"
      (cerrar)="closeCantidadPanel()">
    </app-cantidad-proveedor-panel>

  `,
  styles: [`
    .comparacion-container {
      /* Paleta minimalista (neutros tintados en frío + acentos contenidos) */
      --bg: oklch(0.978 0.004 255);
      --surface: oklch(0.995 0.002 255);
      --surface-2: oklch(0.965 0.005 255);
      --surface-3: oklch(0.945 0.006 255);
      --border: oklch(0.905 0.006 255);
      --border-strong: oklch(0.84 0.008 255);
      --text: oklch(0.34 0.022 262);
      --text-muted: oklch(0.55 0.016 262);
      --accent: oklch(0.55 0.13 256);
      --accent-700: oklch(0.47 0.13 256);
      --accent-50: oklch(0.965 0.022 256);
      --ok-50: oklch(0.965 0.03 152);
      --ok-100: oklch(0.93 0.055 152);
      --ok-200: oklch(0.88 0.07 152);
      --ok-700: oklch(0.46 0.1 152);
      --danger: oklch(0.55 0.16 25);
      --danger-50: oklch(0.96 0.032 25);

      padding: 18px 20px;
      background: var(--bg);
      border-radius: 12px;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: auto;
      color: var(--text);
    }

    /* ── Header ── */
    .cmp-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .cmp-titlewrap { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
    .cmp-title {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 650;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .cmp-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .cmp-close { opacity: 0.45; transition: opacity 0.15s ease; flex-shrink: 0; }
    .cmp-close:hover { opacity: 0.85; }

    /* ── Pills de estado ── */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--surface-3);
      color: var(--text-muted);
      border: 1px solid var(--border);
      text-transform: uppercase;
      white-space: nowrap;
      line-height: 1.4;
    }
    .pill i { font-size: 0.66rem; }
    .pill-dept { background: oklch(0.952 0.024 292); color: oklch(0.46 0.12 292); border-color: oklch(0.9 0.04 292); }
    .pill-open { background: var(--ok-50); color: var(--ok-700); border-color: var(--ok-200); }
    .pill-closed { background: var(--danger-50); color: var(--danger); border-color: oklch(0.9 0.05 25); }
    .pill-oc { background: oklch(0.96 0.03 62); color: oklch(0.5 0.11 62); border-color: oklch(0.9 0.05 62); text-transform: none; }

    /* ── Toolbar ── */
    .article-toolbar-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .cmp-toolbar .btn {
      border-radius: 9px;
      font-weight: 600;
      font-size: 0.78rem;
      padding: 7px 15px;
      box-shadow: none !important;
      letter-spacing: 0.01em;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .cmp-toolbar .btn i { font-size: 0.8rem; }
    .cmp-toolbar .btn:focus, .cmp-toolbar .btn:active { box-shadow: none !important; }
    /* Generar OC = CTA sólido (acento) */
    .cmp-toolbar .btn-primary { background: var(--accent); border: 1px solid var(--accent); color: #fff; }
    .cmp-toolbar .btn-primary:hover:not(:disabled) { background: var(--accent-700); border-color: var(--accent-700); color: #fff; }
    /* Guardar = tonal verde */
    .cmp-toolbar .btn-success { background: var(--ok-50); border: 1px solid var(--ok-200); color: var(--ok-700); }
    .cmp-toolbar .btn-success:hover:not(:disabled) { background: var(--ok-100); border-color: var(--ok-200); color: var(--ok-700); }
    /* Finalizar Req = ghost danger */
    .cmp-toolbar .btn-danger { background: transparent; border: 1px solid transparent; color: var(--danger); }
    .cmp-toolbar .btn-danger:hover:not(:disabled) { background: var(--danger-50); border-color: transparent; color: var(--danger); }
    /* Deshacer = ghost neutral */
    .cmp-toolbar .btn-warning { background: transparent; border: 1px solid var(--border); color: var(--text-muted); }
    .cmp-toolbar .btn-warning:hover:not(:disabled) { background: var(--surface-3); border-color: var(--border-strong); color: var(--text); }
    .cmp-toolbar .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Banner CERRADA ── */
    .cmp-banner-closed {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--danger-50);
      color: var(--danger);
      border: 1px solid oklch(0.9 0.05 25);
      border-radius: 10px;
      font-weight: 650;
      font-size: 0.85rem;
      letter-spacing: 0.04em;
      padding: 9px 16px;
      margin-bottom: 10px;
    }

    /* ── Grid (ag-theme-quartz) refinado ── */
    :host ::ng-deep .comparacion-container .ag-theme-quartz {
      --ag-background-color: var(--surface);
      --ag-odd-row-background-color: var(--surface);
      --ag-header-background-color: var(--surface-2);
      --ag-header-foreground-color: var(--text-muted);
      --ag-foreground-color: var(--text);
      --ag-border-color: var(--border);
      --ag-row-border-color: var(--border);
      --ag-header-column-separator-display: none;
      --ag-header-column-resize-handle-display: none;
      --ag-font-size: 12px;
      --ag-header-height: 38px;
      --ag-row-height: 34px;
      --ag-cell-horizontal-padding: 12px;
      --ag-row-hover-color: var(--accent-50);
      --ag-selected-row-background-color: var(--accent-50);
      --ag-input-focus-border-color: var(--accent);
      --ag-wrapper-border-radius: 0;
    }
    :host ::ng-deep .comparacion-container .ag-theme-quartz .ag-root-wrapper { border: none; }
    :host ::ng-deep .comparacion-container .ag-theme-quartz .ag-header {
      border-bottom: 1px solid var(--border-strong);
    }
    :host ::ng-deep .comparacion-container .ag-theme-quartz .ag-header-cell-text {
      font-weight: 650;
      letter-spacing: 0.03em;
      font-size: 0.66rem;
      text-transform: uppercase;
    }

    /* Card que envuelve grid + footer para un borde y esquinas limpias */
    .cmp-gridwrap {
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      background: var(--surface);
      box-shadow: 0 1px 2px oklch(0.5 0.02 262 / 0.05);
    }

    /* ── Footer "Total x Pedimento" ── */
    .cmp-footer {
      display: flex;
      align-items: stretch;
      flex-shrink: 0;
      height: 38px;
      font-size: 0.72rem;
      border-top: 1px solid var(--border);
    }
    .cmp-footer-label {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      background: var(--ok-50);
      color: var(--ok-700);
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.62rem;
      text-align: center;
    }
    .cmp-footer-value {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      background: var(--ok-100);
      color: var(--ok-700);
      font-weight: 700;
      font-size: 0.78rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .cmp-footer-spacer {
      flex: 0 0 auto;
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
        inset 0 -1px 0 var(--border-strong),
        inset 1px 0 0 var(--border),
        inset -1px 0 0 var(--border);
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
  private customersService = inject(CustomersService);
  private itemCommentsService = inject(ItemCommentsService);
  private signalsService = inject(SignalsService);
  private cdr = inject(ChangeDetectorRef);
  private ngbModal = inject(NgbModal);
  private materialsService = inject(MaterialsService);
  private usersService = inject(UsersService);
  private autorizacionMontoService = inject(AutorizacionMontoService);
  private setupService = inject(SetupService);
  private prefixSetupService = inject(PrefixSetupService);
  private currencyService = inject(CurrencyService);
  private empaqueService = inject(EmpaqueDescripcionService);

  // Fase 2: catálogo de monedas para mostrar la abreviatura junto a Costo Unit/Total (Opción A, sin convertir).
  private monedasMap = new Map<number, string>();
  private defaultCurrencyId: number | null = null;

  // Presentaciones por artículo (idSupplie) + unidad base resuelta (regla piezas>1 → pz, si no kg/L).
  private presentacionesByArticulo = new Map<number, ProveedorPresentaciones[]>();
  private unidadByArticulo = new Map<number, UnidadArticulo>();

  // Modal de "Cantidad x Prov." por presentaciones.
  cantidadPanelOpen = false;
  cantidadPanelRow: any = null;
  cantidadPanelArticle = '';
  cantidadPanelProveedor = '';
  cantidadPanelUnidad = '';
  cantidadPanelEsPieza = false;
  cantidadPanelMinCompra = 0;
  cantidadPanelRequerida = 0;
  cantidadPanelAsignadoOtros = 0;
  cantidadPanelActual = 0;
  cantidadPanelDenoms: { base: number; descripcion: string; unidad: string }[] = [];
  private ivaPercent: number = 0;
  private renderer: Renderer2;
  private gridApi!: GridApi;
  private codigosExternos: Map<number, Map<number, string>> = new Map();
  // ✅ Slots dinámicos N proveedores (no más A/B/C). Map<idProvider, {slotIndex, cotizId, folio}>
  private providerSlotMap = new Map<number, { slotIndex: number; cotizId: number; folio: string; idCondicionPago: number | null }>();
  // Map<slotIndex, folio_COTIZ> — slotIndex secuencial 1..N por orden de creación ASC
  private slotFolioMap   = new Map<number, string>();
  private commentSub?: Subscription;
  private tooltipEl: HTMLElement | null = null;
  private generarOcTooltipEl: HTMLElement | null = null;

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
  @Input() deptPrefijoFromReq: string = '';
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
  savedAtLeastOnce = false;
  loading = false;
  error: string | null = null;

  /** Nivel de autorización de monto del usuario actual (id de autorizacion_monto).
   *  null = usuario sin nivel asignado → botón "Generar OC" deshabilitado siempre. */
  private userNivelMontoId: number | null = null;
  /** Monto máximo autorizado para el usuario. null = "Sin límite" (autorización abierta). */
  private userMontoMax: number | null = null;
  /** Monto mínimo del rango autorizado para el usuario (no se valida actualmente, sólo referencia). */
  private userMontoMin: number = 0;
  /** Flag para saber si ya cargamos el nivel del usuario (evita habilitar botón antes de tiempo). */
  private nivelMontoLoaded: boolean = false;

  get hasConflictingTipoOc(): boolean {
    const REJECTION = ['CAMBIO DE ESPECIFICACIONES', 'ARTICULO NO AUTORIZADO'];
    const byArticulo = new Map<number, any[]>();
    for (const row of this.rowData) {
      const id = Number(row.articuloItemId ?? 0);
      if (!byArticulo.has(id)) byArticulo.set(id, []);
      byArticulo.get(id)!.push(row);
    }
    for (const rows of byArticulo.values()) {
      if (rows.length <= 1) continue;
      const hasRejection = rows.some(r => REJECTION.includes(r.tipoOc));
      const hasOther     = rows.some(r => r.tipoOc && !REJECTION.includes(r.tipoOc) && r.tipoOc !== 'SELECCIONE UNA OPCION');
      if (hasRejection && hasOther) return true;
    }
    return false;
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  readonly tipoOcOptions = [
    'SELECCIONE UNA OPCION',
    'COMPRA INMEDIATA',
    'COMPRA AUTORIZADA EN OTRA FECHA',
    'COMPRA AUTORIZADA SIN LIMITE',
    'COMPRA NO AUTORIZADA',
    'CAMBIO DE ESPECIFICACIONES',
    'ARTICULO NO AUTORIZADO'
  ];

  /** Tipos OC positivos que exigen "Cantidad x Prov." >= "Compra Mínima" (excluye "SIN LIMITE"). */
  private readonly POSITIVE_LIMITED_TYPES = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];

  ngOnInit() {
    this.commentSub = this.itemCommentsService.commentSaved$.subscribe(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    });
    this.loadUserNivelMonto();
    this.loadMonedas();
    this.loadComparisonData();
  }

  /** Fase 2: carga catálogo de monedas (type=CURRENCY) y resuelve la default (MXN). */
  private loadMonedas(): void {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
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
        this.gridApi?.refreshCells({ columns: ['costoUnitario', 'costoTotal', 'costoXCompraMinima'], force: true });
      },
      error: () => { this.monedasMap = new Map(); this.defaultCurrencyId = null; }
    });
  }

  /** Abreviatura de la moneda de una fila (o 'MXN' si no resuelve). */
  private currencyAbbr(idCurrency: any): string {
    const id = (idCurrency !== undefined && idCurrency !== null) ? Number(idCurrency) : this.defaultCurrencyId;
    return (id != null ? this.monedasMap.get(Number(id)) : '') || 'MXN';
  }

  /**
   * Carga el nivel de autorización de monto del usuario actual.
   * - Si el usuario tiene `nivelMonto` (id de autorizacion_monto), busca el rango montoMin/montoMax.
   * - Si `nivelMonto` es null → no podrá generar OC nunca (tooltip lo explicará).
   * - Si el monto total de la OC supera `montoMax` → no podrá generar OC (tooltip pide ayuda a supervisión).
   * No se altera ningún flujo existente: sólo se agregan datos para una validación adicional.
   */
  private loadUserNivelMonto(): void {
    const idUser = this.signalsService.idUser?.() ?? 0;
    const idCompany = this.signalsService.getRootSelectedBySidebar()() ?? 0;
    if (!idUser || !idCompany) {
      // Sin contexto no podemos validar; dejamos como "sin nivel" para deshabilitar el botón con mensaje claro.
      this.userNivelMontoId = null;
      this.userMontoMax = null;
      this.userMontoMin = 0;
      this.nivelMontoLoaded = true;
      return;
    }

    this.usersService.getUserById(idUser).subscribe({
      next: (resp: any) => {
        const userData = resp?.data ?? resp ?? {};
        const nivelId = userData?.nivelMonto;
        this.userNivelMontoId = (nivelId == null || nivelId === 0) ? null : Number(nivelId);

        if (this.userNivelMontoId == null) {
          this.userMontoMax = null;
          this.userMontoMin = 0;
          this.nivelMontoLoaded = true;
          return;
        }

        this.autorizacionMontoService.getByCompany(idCompany).subscribe({
          next: (niveles: any) => {
            const list = Array.isArray(niveles) ? niveles : [];
            const nivel = list.find((n: any) => Number(n.id) === Number(this.userNivelMontoId));
            if (nivel) {
              this.userMontoMin = Number(nivel.montoMin) || 0;
              this.userMontoMax = (nivel.montoMax == null) ? null : Number(nivel.montoMax);
            } else {
              // Nivel asignado pero no encontrado en catálogo → trátalo como sin nivel.
              this.userNivelMontoId = null;
              this.userMontoMax = null;
              this.userMontoMin = 0;
            }
            this.nivelMontoLoaded = true;
          },
          error: () => {
            this.userMontoMax = null;
            this.userMontoMin = 0;
            this.nivelMontoLoaded = true;
          }
        });
      },
      error: () => {
        this.userNivelMontoId = null;
        this.userMontoMax = null;
        this.userMontoMin = 0;
        this.nivelMontoLoaded = true;
      }
    });
  }

  /** Indica si el usuario no tiene nivel de autorización de monto asignado. */
  get userHasNoNivelMonto(): boolean {
    return this.nivelMontoLoaded && this.userNivelMontoId == null;
  }

  /** Indica si el monto total de la OC excede el nivel autorizado del usuario. */
  get ocAmountExceedsUserLevel(): boolean {
    if (!this.nivelMontoLoaded || this.userNivelMontoId == null) return false;
    if (this.userMontoMax == null) return false; // Sin límite
    return (this.pinnedTotal || 0) > Number(this.userMontoMax);
  }

  /** Tooltip dinámico para el botón "Generar OC" según el estado actual. */
  get generarOcTooltip(): string {
    if (this.ocGenerada) return 'Comparación cerrada';
    if (this.userHasNoNivelMonto) return 'No tienes asignado un nivel para compras';
    if (this.ocAmountExceedsUserLevel) return 'Tu nivel de liberación no es suficiente para generar OC, pide ayuda a supervisión administrativa';
    if (!this.savedAtLeastOnce || this.hasUnsavedChanges) return 'Guarda los cambios antes de generar OC';
    return 'Generar Orden(es) de Compra';
  }

  /** Indica si el tooltip del botón "Generar OC" representa una restricción (mensaje rojo/alerta). */
  get isGenerarOcRestriction(): boolean {
    return this.ocGenerada || this.userHasNoNivelMonto || this.ocAmountExceedsUserLevel ||
           !this.savedAtLeastOnce || this.hasUnsavedChanges;
  }

  /** Título del tooltip estilizado según el contexto (autorización vs. acción normal). */
  get generarOcTooltipTitle(): string {
    if (this.ocGenerada) return 'Comparación cerrada';
    if (this.userHasNoNivelMonto) return 'Sin nivel de autorización';
    if (this.ocAmountExceedsUserLevel) return 'Nivel insuficiente';
    if (!this.savedAtLeastOnce || this.hasUnsavedChanges) return 'Cambios pendientes';
    return 'Generar Orden(es) de Compra';
  }

  showGenerarOcTooltip(event: MouseEvent): void {
    this.hideGenerarOcTooltip();

    const message = this.generarOcTooltip;
    if (!message) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.generarOcTooltipEl = this.renderer.createElement('div');
    this.renderer.setStyle(this.generarOcTooltipEl, 'position', 'fixed');
    this.renderer.setStyle(this.generarOcTooltipEl, 'z-index', '10001');
    this.renderer.setStyle(this.generarOcTooltipEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.generarOcTooltipEl, 'min-width', '260px');
    this.renderer.setStyle(this.generarOcTooltipEl, 'max-width', '380px');
    this.renderer.setStyle(this.generarOcTooltipEl, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');
    this.renderer.setStyle(this.generarOcTooltipEl, 'border-radius', '8px');
    this.renderer.setStyle(this.generarOcTooltipEl, 'box-shadow', '0 8px 24px rgba(0,0,0,0.4)');
    this.renderer.setStyle(this.generarOcTooltipEl, 'padding', '12px 16px');
    this.renderer.setStyle(this.generarOcTooltipEl, 'color', '#ffffff');
    this.renderer.setStyle(this.generarOcTooltipEl, 'font-size', '12px');
    this.renderer.setStyle(this.generarOcTooltipEl, 'line-height', '1.6');

    const title = this.renderer.createElement('div');
    this.renderer.setStyle(title, 'font-weight', '600');
    this.renderer.setStyle(title, 'font-size', '13px');
    this.renderer.setStyle(title, 'margin-bottom', '6px');
    this.renderer.setStyle(title, 'color', '#ffffff');
    this.renderer.appendChild(title, this.renderer.createText(this.generarOcTooltipTitle));
    this.renderer.appendChild(this.generarOcTooltipEl, title);

    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'color', 'rgba(255,255,255,0.92)');
    this.renderer.appendChild(body, this.renderer.createText(message));
    this.renderer.appendChild(this.generarOcTooltipEl, body);

    this.renderer.appendChild(document.body, this.generarOcTooltipEl);

    // Posicionar debajo del botón, alineado a la derecha si no cabe a la izquierda
    const tooltipWidth = this.generarOcTooltipEl!.offsetWidth || 280;
    const viewportWidth = window.innerWidth;
    let leftPos = rect.left;
    if (leftPos + tooltipWidth + 10 > viewportWidth) {
      leftPos = Math.max(10, rect.right - tooltipWidth);
    }
    this.renderer.setStyle(this.generarOcTooltipEl, 'top', `${rect.bottom + 8}px`);
    this.renderer.setStyle(this.generarOcTooltipEl, 'left', `${leftPos}px`);
  }

  hideGenerarOcTooltip(): void {
    if (this.generarOcTooltipEl) {
      this.renderer.removeChild(document.body, this.generarOcTooltipEl);
      this.generarOcTooltipEl = null;
    }
  }

  ngOnDestroy() {
    this.commentSub?.unsubscribe();
    this.hideArticuloTooltip();
    this.hideGenerarOcTooltip();
  }

  private loadComparisonData() {
    if (!this.cotizacionId) {
      this.error = 'No se pudo identificar el pedimento';
      return;
    }

    this.loading = true;
    this.error = null;

    const idBranch = this.idBranchFromReq || this.signalsService.getBranchSelectedBySidebar()();
    if (idBranch) {
      this.setupService.getWarehouseSetupByBranch(idBranch).subscribe({
        next: (d: any) => { this.ivaPercent = d?.iva ?? 0; },
        error: () => { this.ivaPercent = 0; }
      });
    }

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
          const auxLoads: Promise<void>[] = [this.loadCodigosExternos(), this.loadPresentaciones()];
          if (this.requisitionId) auxLoads.push(this.loadExistingOcFolios());
          await Promise.all(auxLoads);
        } catch (err) {
          console.warn('[Comparacion] Error cargando datos auxiliares:', err);
        }

        // Fallback para data existente: si hay OCs reales cargadas en ocPairs,
        // el pedimento está cerrado aunque locked=false en BD (datos anteriores al fix).
        if (!this.ocGenerada && this.ocPairs.length > 0) {
          this.ocGenerada = true;
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

  /**
   * Carga las presentaciones (Nivel 3) de cada artículo del pedimento y resuelve su unidad base
   * (regla piezas>1 → pz, si no kg/L) validando consistencia. Alimenta el modal de Cantidad x Prov.
   */
  private async loadPresentaciones(): Promise<void> {
    this.presentacionesByArticulo.clear();
    this.unidadByArticulo.clear();
    const ids = Array.from(new Set(
      (this.articulos || [])
        .map((a: any) => Number(a.idSupplie) || 0)
        .filter((id: number) => id > 0)
    ));
    if (ids.length === 0) return;
    const results = await lastValueFrom(
      forkJoin(ids.map(id =>
        this.empaqueService.getPresentacionesByMaterial(id).pipe(
          map(data => ({ id, data: Array.isArray(data) ? data : [] })),
          catchError(() => of({ id, data: [] as ProveedorPresentaciones[] }))
        )
      ))
    ).catch(() => [] as { id: number; data: ProveedorPresentaciones[] }[]);
    for (const r of (results || [])) {
      this.presentacionesByArticulo.set(r.id, r.data);
      this.unidadByArticulo.set(r.id, resolverUnidadArticulo(r.data));
    }
  }

  /** ¿La fila usa el modal de presentaciones? (artículo con presentaciones consistentes + proveedor con denoms) */
  private rowUsaModalPresentaciones(row: any): boolean {
    const idSupplie = Number(row?.idSupplie) || 0;
    const provId = Number(row?.proveedorId) || 0;
    if (idSupplie <= 0 || provId <= 0) return false;
    const unidad = this.unidadByArticulo.get(idSupplie);
    if (!unidad || !unidad.tienePresentaciones || !unidad.consistente) return false;
    const provs = this.presentacionesByArticulo.get(idSupplie) || [];
    const prov = provs.find(p => Number(p.idProvider) === provId);
    return !!prov && denomsDeProveedor(prov).length > 0;
  }

  /** Abre el modal de Cantidad x Prov. con el contexto del artículo/proveedor y el restante. */
  private openCantidadPanel(row: any): void {
    const idSupplie = Number(row?.idSupplie) || 0;
    const provId = Number(row?.proveedorId) || 0;
    const unidad = this.unidadByArticulo.get(idSupplie);
    const provs = this.presentacionesByArticulo.get(idSupplie) || [];
    const prov = provs.find(p => Number(p.idProvider) === provId);
    if (!unidad || !prov) return;

    const articuloItemId = Number(row?.articuloItemId ?? 0);
    const sumOtros = this.rowData
      .filter(r => Number(r.articuloItemId ?? 0) === articuloItemId && r !== row)
      .reduce((acc, r) => acc + (Number(r.cantidadConceptualizada) || 0), 0);

    this.cantidadPanelRow = row;
    this.cantidadPanelArticle = row?.articulo || '';
    this.cantidadPanelProveedor = row?.proveedorNombre || `Proveedor ${provId}`;
    this.cantidadPanelUnidad = unidad.unidad;
    this.cantidadPanelEsPieza = unidad.esPieza;
    this.cantidadPanelMinCompra = Number(prov.minCompra) || 0;
    this.cantidadPanelRequerida = Number(row?.cantidadComprar) || 0;
    this.cantidadPanelAsignadoOtros = sumOtros;
    this.cantidadPanelActual = Number(row?.cantidadConceptualizada) || 0;
    this.cantidadPanelDenoms = denomsDeProveedor(prov);
    this.cantidadPanelOpen = true;
  }

  onCantidadPanelSeleccionar(ev: { cantidad: number; texto: string }): void {
    const row = this.cantidadPanelRow;
    this.cantidadPanelOpen = false;
    if (!row) { this.cantidadPanelRow = null; return; }
    row.cantidadConceptualizada = Number(ev.cantidad) || 0;
    row.costoTotal = this.lineTotal(row.costoUnitario, row.cantidadConceptualizada);
    this.hasUnsavedChanges = true;
    this.savedAtLeastOnce = false;
    this.gridApi?.refreshCells({ force: true });
    this.updatePinnedBottomRow();
    this.cantidadPanelRow = null;
  }

  closeCantidadPanel(): void {
    this.cantidadPanelOpen = false;
    this.cantidadPanelRow = null;
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

  /**
   * Extrae el prefijo de sucursal del folio de la requisición.
   * Folio típico: "BOD15-001" → "BOD15". Si lleva tipo (REQ-/COTIZ-/OC-), también lo limpia.
   * Usado para construir folios de OC: OC-{branchPrefix}-P{ped}-PRO{idProvider}.
   */
  private extractBranchPrefix(folio: string | null | undefined): string {
    if (!folio) return 'NOPREF';
    let prefix = String(folio).replace(/^(REQ-|COTIZ-|OC-|CO-)/i, '');
    prefix = prefix.replace(/-(\d+)$/, '$1');
    return prefix || 'NOPREF';
  }

  private async loadCotizSlots(): Promise<void> {
    try {
      const cotizData: any = await lastValueFrom(
        this.ocAndReqsService.getOcAndReqs('delison', this.cotizacionId, 'COTIZ')
      );
      const cotizList: any[] = Array.isArray(cotizData) ? cotizData : [];
      this.providerSlotMap.clear();
      this.slotFolioMap.clear();
      // ✅ Asignar slotIndex secuencial por orden de creación ASC (sin slots vacíos)
      const sortedCotizs = cotizList
        .filter((c: any) => Number(c.idProvider) > 0)
        .sort((a: any, b: any) => Number(a.id) - Number(b.id));
      sortedCotizs.forEach((cotiz: any, idx: number) => {
        const slotIndex = idx + 1;
        const folio = cotiz.folio || `Pedimento-${slotIndex}`;
        const idProvider = Number(cotiz.idProvider);
        if (!this.providerSlotMap.has(idProvider)) {
          this.providerSlotMap.set(idProvider, {
            slotIndex, cotizId: cotiz.id, folio,
            // Condición de pago del slot COTIZ → se copia a la OC al generarla.
            idCondicionPago: cotiz.idCondicionPago ?? cotiz.id_condicion_pago ?? null,
          });
        }
        if (!this.slotFolioMap.has(slotIndex)) {
          this.slotFolioMap.set(slotIndex, folio);
        }
      });
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
          // ✅ Mapear OC → pedimento usando idProvider (vía providerSlotMap, ya cargado)
          const idProv = Number(oc.idProvider);
          const slot = idProv > 0 ? this.providerSlotMap.get(idProv) : undefined;
          if (!slot) return null; // OC de otro pedimento, no aplica aquí
          const pedimento = slot.folio || '';
          this.proveedoresConOc.add(idProv);
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
    slot: { slotIndex: number; cotizId: number; folio: string; idCondicionPago?: number | null },
    rows: any[]
  ): Promise<string> {
    const idRoot   = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = this.idBranchFromReq || this.signalsService.getBranchSelectedBySidebar()();
    // ✅ Nueva nomenclatura: OC-{branchPrefix}-{prefixCotiz}{ped}-PRO{idProvider}
    const reqFolio        = this.requisitionFolio || `REQ-${this.requisitionId}`;
    const branchPrefix    = this.extractBranchPrefix(reqFolio);
    const pedimentoMatch  = this.cotizacionFolio.match(/(\d+)/);
    const pedimentoNumber = pedimentoMatch ? parseInt(pedimentoMatch[1], 10) : slot.slotIndex;
    // Cargar prefijos configurados para esta sucursal:
    //  - prefix_cotiz sustituye la literal "P"
    //  - prefix_oc sustituye la literal "OC"
    //  - consecutive_oc_proveedor define la cantidad de iniciales del proveedor (1-5)
    let pedimentoPrefix = 'P';
    let ocPrefix = 'OC';
    let providerInitials = 3;
    try {
      const ps = await lastValueFrom(this.prefixSetupService.getPrefixSetup('branch', Number(idBranch)));
      if (ps?.prefixCotiz?.trim()) pedimentoPrefix = ps.prefixCotiz.trim();
      if (ps?.prefixOc?.trim()) ocPrefix = ps.prefixOc.trim();
      if (ps?.consecutiveOcProveedor && ps.consecutiveOcProveedor > 0) providerInitials = ps.consecutiveOcProveedor;
    } catch {
      // fallback a defaults si la carga falla
    }
    const providerCode    = (provName || '').trim().toUpperCase().slice(0, providerInitials) || 'PRO';
    // Prefijo del departamento (ej. "EF") entre sucursal y pedimento → OC-JIC7-EF-P1-VEY1425.
    // Siempre existe porque la COTIZ no se pudo crear sin él (validación en detalle-items-proveedor).
    const deptSeg         = (this.deptPrefijoFromReq || '').trim().toUpperCase();
    const folio           = `${ocPrefix}-${branchPrefix}-${deptSeg ? deptSeg + '-' : ''}${pedimentoPrefix}${pedimentoNumber}-${providerCode}${provId}`;

    const dateCreate = new Date().toISOString().split('T')[0];
    const ocPayload = {
      idRoot,
      folio,
      typeReference: 'branch',
      idReference:   idBranch || 0,
      idReq:         this.requisitionId || 0,
      dateCreate,
      idProvider:    provId,
      solicit:       provName.substring(0, 50),
      idDepartament: this.idDepartamentFromReq || 0,
      delivery:      'NO APLICA',
      deliveryTime:  '1 DAY',
      typeOc:        'INSUMOS',
      idPayment:     0,
      idCurrency:    0,
      // Copiar la condición de pago de la COTIZ (crédito/anticipo) a la OC, para que
      // la Hoja de Gastos la lea directo de la OC (botón Crédito / flujo de anticipo).
      idCondicionPago: slot.idCondicionPago ?? null,
      type:          'OC',
      datesupply:    new Date().toISOString().split('T')[0],
      active:        true
    };

    const created: any = await lastValueFrom(this.ocAndReqsService.addOcAndReq(ocPayload));
    const newOcId = Number(created?.id ?? created?.data?.id ?? 0);
    if (!newOcId || newOcId <= 0) throw new Error('No se obtuvo id del OC');

    const details = rows.map((row: any) => {
      const weeks = parseInt(String(row.tiempoEntrega)) || 0;
      const d = new Date(dateCreate);
      if (weeks > 0) d.setDate(d.getDate() + weeks * 7);
      const datePostpone = weeks > 0 ? d.toISOString().split('T')[0] : '';
      // "COMPRA AUTORIZADA SIN LIMITE" → quantity = 0 (sin límite, sin fallback a cantidadComprar)
      const isSinLimite = row.tipoOc === 'COMPRA AUTORIZADA SIN LIMITE';
      const quantity = isSinLimite
        ? 0
        : (Number(row.cantidadConceptualizada) > 0 ? Number(row.cantidadConceptualizada) : Number(row.cantidadComprar) || 0);
      // Opción B: guardar el precio BASE (sin IVA). row.costoUnitario viene inflado con IVA
      // cuando masIva (display de la comparación); el IVA se aplica al mostrar/PDF, no se almacena.
      const ivaFactor = 1 + (this.ivaPercent || 0) / 100;
      const precioBase = row.masIva && ivaFactor > 0
        ? (Number(row.costoUnitario) || 0) / ivaFactor
        : (Number(row.costoUnitario) || 0);
      return {
        idMovement:   newOcId,
        idSupplie:    row.idSupplie || 0,
        idProvider:   provId,
        nameProvider: provName,
        quantity,
        price:        precioBase,
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
        masIva:        !!row.masIva,   // propaga el "+ IVA" de la cotización a la OC (se ve en Captura de Gastos)
        idCurrency:    row.idCurrency ?? null,   // Fase 2: hereda la moneda de la COTIZ a la OC
        // Nace NO liberado: el almacén no lo lee hasta marcar "Liberar para almacén" en Selección de OC.
        liberarAlmacen: false,
        comment:       '',
        datePostpone
      };
    });

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
    // Datos cargados desde backend ya están persistidos: equivalente a haber guardado.
    // Permite habilitar "Generar OC" al reabrir el modal sin exigir un Guardar redundante.
    // Se resetea a false en onCellValueChanged si el usuario edita algo.
    this.savedAtLeastOnce = true;
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
      const masIvasPorProv = articulo.masIvas || {};
      const monedasPorProv = articulo.monedas || {};   // Fase 2: moneda del precio por proveedor (NULL = MXN)
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
        const masIva = !!(masIvasPorProv[provId] ?? masIvasPorProv[provId.toString()] ?? false);
        const idCurrency = monedasPorProv[provId] ?? monedasPorProv[provId.toString()] ?? null;
        const costoUnitarioDisplay = masIva ? costoUnitario * (1 + this.ivaPercent / 100) : costoUnitario;
        const costoTotal = this.lineTotal(costoUnitarioDisplay, cantidadConceptualizada);
        const costoXCompraMinima = costoUnitario * compraMinima;

        const providerCodigosMap = this.codigosExternos.get(provId) || new Map();
        const codigoExternoProveedor = providerCodigosMap.get(idSupplie) || '';

        rows.push({
          articuloItemId,
          slotItemId,
          idSupplie,
          proveedorId: provId,
          proveedorNombre: prov.nombre ?? prov.name ?? (provId ? `Proveedor ${provId}` : '—'),
          proveedorEstado: prov.state ?? prov.estado ?? '',
          proveedorCiudad: prov.city ?? prov.ciudad ?? '',
          proveedorTelefono: prov.phone ?? prov.telefono ?? prov.telefonoPrincipal ?? '',
          cantidadComprar,
          nuevoRecurrente: articulo.recurrent ?? articulo.nuevoRecurrente ?? prov.recurrent ?? '—',
          articulo: articulo.nombre ?? articulo.article ?? '',
          numArticle: rawNumArticle,
          numArticuloInterno: rawNumArticle,
          numArticuloExterno:
            codigoExternoProveedor || (articulo.codigoExterno ?? articulo.numArticuloExterno ?? articulo.observation ?? ''),
          prioridad: articulo.typePriority ?? articulo.prioridad ?? 'NORMAL',
          caducidadMinimaRequerida: articulo.caducidadMinimaRequerida ?? articulo.caducidad ?? articulo.expiration ?? '',
          tiempoEntrega: tiemposEntregaPorProv[provId] ?? tiemposEntregaPorProv[provId.toString()] ?? '',
          compraMinima,
          costoUnitario: costoUnitarioDisplay,
          costoTotal,
          costoXCompraMinima,
          masIva,
          idCurrency,
          comentario,
          tipoOc,
          cantidadConceptualizada,
          __isBlockStart: idx === 0,
          __blockRowSpan: blockSize
        });
      });
    }

    this.rowData = rows;
    this.syncGridRowData();
  }

  private pushRowDataToGridIfReady(_alsoSchedule: boolean) {
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.syncGridRowData();
        this.gridApi.setGridOption('rowData', this.gridRowData);
        this.updatePinnedBottomRow();
      }
    }, 0);
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
    if (this.rowData?.length) {
      this.syncGridRowData();
      this.gridApi.setGridOption('rowData', this.gridRowData);
      this.updatePinnedBottomRow();
    }
  }

  onFirstDataRendered(_params: any) {
    setTimeout(() => {
      this.updateFooterWidths();
    }, 100);
  }

  onRowDataUpdated() {}

  onColumnResized() {
    this.updateFooterWidths();
  }

  onGridSizeChanged() {
    this.updateFooterWidths();
  }

  public pinnedTotal: number = 0;
  public pinnedTotalDisplay: string = '$0.00 MXN';
  public footerLabelWidth: number = 135;
  public footerValueWidth: number = 105;
  public footerEndWidth: number = 88;

  /** Datos que ve el grid = filas reales + un renglón extra de total ("Total x Pedimento") al final.
   *  El renglón de total NO está en `this.rowData` (no afecta cálculos/guardado), solo en el grid. */
  public gridRowData: any[] = [];

  /** Reconstruye `gridRowData` anexando el renglón de total tras las filas reales. */
  private syncGridRowData(): void {
    this.gridRowData = this.rowData.length > 0
      ? [...this.rowData, { __isTotal: true }]
      : [];
  }

  private updatePinnedBottomRow() {
    // Mantener row.costoTotal en sync (defensivo) y sumar con el mismo cálculo de la celda.
    let total = 0;
    for (const r of this.rowData) {
      r.costoTotal = this.computeCostoTotalForRow(r);
      total += r.costoTotal;
    }
    this.pinnedTotal = total;
    // Display por moneda (Opción A, sin convertir): subtotales agrupados por moneda.
    this.pinnedTotalDisplay = this.buildTotalsByCurrencyDisplay(this.rowData);
    // Refrescar el renglón de total para que muestre el monto recalculado.
    this.gridApi?.refreshCells({ force: true });
  }

  /**
   * Total(es) por moneda para el footer "Total x Pedimento". Agrupa el costo total por moneda
   * (no convierte). 1 moneda → "$X.XX MXN"; varias → "$X.XX MXN / $Y.YY USD" con orden estable
   * (la moneda default/MXN primero, luego alfabético por abreviatura).
   */
  private buildTotalsByCurrencyDisplay(rows: any[]): string {
    const sums = new Map<number, number>();
    for (const r of rows) {
      const id = (r?.idCurrency !== undefined && r?.idCurrency !== null)
        ? Number(r.idCurrency)
        : (this.defaultCurrencyId ?? -1);
      sums.set(id, (sums.get(id) || 0) + this.computeCostoTotalForRow(r));
    }
    if (sums.size === 0) return `$0.00 ${this.currencyAbbr(this.defaultCurrencyId)}`;
    const entries = Array.from(sums.entries()).sort((a, b) => {
      if (a[0] === this.defaultCurrencyId) return -1;
      if (b[0] === this.defaultCurrencyId) return 1;
      return this.currencyAbbr(a[0]).localeCompare(this.currencyAbbr(b[0]));
    });
    return entries.map(([id, sum]) => `$${sum.toFixed(2)} ${this.currencyAbbr(id)}`).join(' / ');
  }

  /** Opción A: redondea el costo unitario (ya con IVA si aplica) a 2 decimales ANTES de
   *  multiplicar por la cantidad. Así COSTO TOTAL coincide con la cotización (unit mostrado × cant).
   *  NO se redondea costoUnitario en sí mismo: la generación de OC deriva el precio base
   *  dividiendo costoUnitario / (1+IVA) y necesita el valor sin redondear. */
  private round2(n: any): number { return Math.round((Number(n) || 0) * 100) / 100; }
  private lineTotal(costoUnitario: any, cantidad: any): number {
    return this.round2(costoUnitario) * (Number(cantidad) || 0);
  }

  /**
   * Costo Total de una fila (fuente única para la celda y el footer "Total x Pedimento").
   *  - Tipos positivos limitados / negativos / sin clasificar → costo unitario × CANTIDAD X PROV.
   *  - "COMPRA AUTORIZADA SIN LIMITE": la cantidad por proveedor no aplica (es 0). Para no dejarlo
   *    en $0, la PRIMERA fila sin-límite del artículo cubre el RESTO que no tomaron los positivos:
   *        resto = max(0, CANTIDAD REQUERIDA − Σ cantidad x prov. de positivos limitados)
   *        costo total = costo unitario × resto
   *    Las demás filas sin-límite del mismo artículo quedan en 0 (evita doble conteo).
   *  El costo unitario ya viene con IVA incluido cuando aplica; se usa tal cual.
   */
  private computeCostoTotalForRow(row: any): number {
    if (!row) return 0;
    const unit = this.round2(row.costoUnitario);

    if (row.tipoOc !== 'COMPRA AUTORIZADA SIN LIMITE') {
      return unit * (Number(row.cantidadConceptualizada) || 0);
    }

    // Sin límite: solo la primera fila sin-límite del artículo toma el resto.
    const itemId = Number(row.articuloItemId ?? 0) || 0;
    const rowsArticulo = this.rowData.filter(r => Number(r.articuloItemId ?? 0) === itemId);
    const sinLimiteRows = rowsArticulo.filter(r => r.tipoOc === 'COMPRA AUTORIZADA SIN LIMITE');
    if (sinLimiteRows.length === 0 || sinLimiteRows[0] !== row) return 0;

    const sumPositivas = rowsArticulo
      .filter(r => this.POSITIVE_LIMITED_TYPES.includes(r.tipoOc))
      .reduce((acc, r) => acc + (Number(r.cantidadConceptualizada) || 0), 0);
    const requerida = Number(row.cantidadComprar) || 0;
    const resto = Math.max(0, requerida - sumPositivas);
    return unit * resto;
  }

  private updateFooterWidths() {
    if (!this.gridApi) return;
    const cols = this.gridApi.getColumns?.();
    if (!cols) return;
    for (const col of cols) {
      const field = col.getColDef?.()?.field;
      const w = col.getActualWidth?.() || 0;
      if (w > 0) {
        if (field === 'cantidadConceptualizada') this.footerLabelWidth = w;
        else if (field === 'costoTotal') this.footerValueWidth = w;
        else if (field === 'comentario') this.footerEndWidth = w;
      }
    }
    this.cdr.detectChanges();
  }

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
    this.savedAtLeastOnce = false;
    const field = event.colDef?.field;

    // Detectar cambio a "COMPRA AUTORIZADA SIN LIMITE": forzar cantidad = 0 (sin límite, no aplica cantidad)
    if (field === 'tipoOc' && event.newValue === 'COMPRA AUTORIZADA SIN LIMITE') {
      event.data.cantidadConceptualizada = 0;
      this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
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
        row.costoTotal = this.lineTotal(row.costoUnitario, row.cantidadConceptualizada);
      }
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }
    if (field === 'tipoOc') {
      const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA', 'COMPRA AUTORIZADA SIN LIMITE'];
      const isNegative = !AUTHORIZED.includes(event.newValue);

      if (event.newValue === 'ARTICULO NO AUTORIZADO' || event.newValue === 'CAMBIO DE ESPECIFICACIONES') {
        const articuloItemId = Number(event.data?.articuloItemId ?? 0);
        if (articuloItemId > 0) {
          // Guardar valores anteriores antes de modificar para poder revertir
          const savedValues = new Map<any, { tipoOc: string; cantidad: number }>();
          for (const row of this.rowData) {
            if (Number(row.articuloItemId) === articuloItemId) {
              savedValues.set(row, { tipoOc: row.tipoOc, cantidad: row.cantidadConceptualizada ?? 0 });
              row.tipoOc = event.newValue;
              row.cantidadConceptualizada = 0;
            }
          }
          const affectedNodes: any[] = [];
          this.gridApi?.forEachNode((node: any) => {
            if (Number(node.data?.articuloItemId) === articuloItemId) affectedNodes.push(node);
          });
          this.gridApi?.refreshCells({ rowNodes: affectedNodes, force: true });
          this.updatePinnedBottomRow();

          const numArticle = event.data?.numArticle || event.data?.numArticuloInterno || '';
          if (numArticle && this.requisitionId) {
            this.openNegativeTypeChat(numArticle, event.newValue, () => {
              for (const [row, saved] of savedValues) {
                row.tipoOc = saved.tipoOc;
                row.cantidadConceptualizada = saved.cantidad;
              }
              this.gridApi?.refreshCells({ rowNodes: affectedNodes, force: true });
              this.updatePinnedBottomRow();
            }, undefined, undefined, String(event.data?.articulo ?? ''));
          }
          return;
        }
      }

      if (isNegative) {
        const oldCantidad = event.data.cantidadConceptualizada ?? 0;
        event.data.cantidadConceptualizada = 0;
        // refresh completo: al volverse negativo este proveedor cambia el "resto" del sin-límite hermano.
        this.gridApi?.refreshCells({ force: true });
        this.updatePinnedBottomRow();

        const numArticle = event.data?.numArticle || event.data?.numArticuloInterno || '';
        if (numArticle && this.requisitionId) {
          const needsProviderTab = event.newValue === 'COMPRA NO AUTORIZADA';
          this.openNegativeTypeChat(numArticle, event.newValue, () => {
            event.data.tipoOc = event.oldValue;
            event.data.cantidadConceptualizada = oldCantidad;
            this.gridApi?.refreshCells({ force: true });
            this.updatePinnedBottomRow();
          }, needsProviderTab ? Number(event.data?.proveedorId ?? 0) : undefined,
             needsProviderTab ? String(event.data?.proveedorNombre ?? '') : undefined,
             String(event.data?.articulo ?? ''));
        }
        return;
      }

      // refresh completo: un cambio de tipo OC altera el "resto" del sin-límite del mismo artículo.
      this.gridApi?.refreshCells({ force: true });

      // Auto-rellenar Cantidad x Prov. con la Cantidad Requerida cuando el artículo tiene UN SOLO
      // proveedor y el tipo OC es positivo limitado (NO aplica a "SIN LIMITE"). Sobrescribe el valor previo.
      if (this.POSITIVE_LIMITED_TYPES.includes(event.newValue)) {
        const articuloItemId = Number(event.data?.articuloItemId ?? 0);
        const proveedoresDelArticulo = this.rowData
          .filter(r => Number(r.articuloItemId ?? 0) === articuloItemId).length;
        if (proveedoresDelArticulo === 1) {
          event.data.cantidadConceptualizada = Number(event.data?.cantidadComprar) || 0;
          event.data.costoTotal = this.lineTotal(event.data.costoUnitario, event.data.cantidadConceptualizada);
          this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
          this.updatePinnedBottomRow();
        }
      }

      // Cuando tipoOc cambia a un tipo positivo limitado, verificar que cantidadConceptualizada >= compraMinima
      if (this.POSITIVE_LIMITED_TYPES.includes(event.newValue)) {
        const compraMin = Number(event.data?.compraMinima) || 0;
        const cantActual = Number(event.data?.cantidadConceptualizada) || 0;
        if (compraMin > 0 && cantActual < compraMin) {
          const articuloItemId = Number(event.data?.articuloItemId ?? 0);
          const sumOtros = this.rowData
            .filter(r => Number(r.articuloItemId ?? 0) === articuloItemId && r !== event.data)
            .reduce((acc, r) => acc + (Number(r.cantidadConceptualizada) || 0), 0);
          const cantidadComprar = Number(event.data?.cantidadComprar) || 0;
          const maxAllowed = Math.max(0, cantidadComprar - sumOtros);
          if (maxAllowed < compraMin) {
            event.data.cantidadConceptualizada = 0;
            event.data.costoTotal = this.lineTotal(event.data.costoUnitario, event.data.cantidadConceptualizada);
            this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
            alerts.basicAlert(
              'Cantidad insuficiente',
              `Solo quedan ${maxAllowed.toFixed(2)} piezas por asignar pero se requieren ${compraMin} (compra mínima) para "${event.data?.proveedorNombre ?? 'este proveedor'}". Ajuste la cantidad de los otros proveedores para liberar espacio.`,
              'warning'
            );
          } else {
            event.data.cantidadConceptualizada = compraMin;
            event.data.costoTotal = this.lineTotal(event.data.costoUnitario, event.data.cantidadConceptualizada);
            this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
            alerts.basicAlert(
              'Cantidad ajustada',
              `Con tipo OC "${event.newValue}", la cantidad por proveedor no puede ser menor a la compra mínima (${compraMin}). Se ajustó al mínimo.`,
              'warning'
            );
          }
        }
      }
    }
    if (field === 'cantidadConceptualizada') {
      const cantidadComprar = Number(event.data?.cantidadComprar) || 0;
      const articuloItemId = Number(event.data?.articuloItemId ?? 0);
      const sumOtros = this.rowData
        .filter(r => Number(r.articuloItemId ?? 0) === articuloItemId && r !== event.data)
        .reduce((acc, r) => acc + (Number(r.cantidadConceptualizada) || 0), 0);
      const maxAllowed = Math.max(0, cantidadComprar - sumOtros);

      const rawNum = Number(event.newValue);

      // 1) Excede la cantidad requerida → revertir al valor ORIGINAL (no al mínimo) + mensaje correcto.
      if (Number.isFinite(rawNum) && rawNum > maxAllowed) {
        event.data.cantidadConceptualizada = Number(event.oldValue) || 0;
        event.data.costoTotal = this.lineTotal(event.data.costoUnitario, event.data.cantidadConceptualizada);
        this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
        alerts.basicAlert(
          'Cantidad no permitida',
          `No puedes comprar más de la cantidad requerida (${cantidadComprar}).`,
          'warning'
        );
        this.updatePinnedBottomRow();
        return;
      }

      // 2) Dentro del límite: normalizar y validar compra mínima.
      const cantidadValidada = this.getValidatedCantidadConceptualizada(event.newValue, event.data);
      event.data.cantidadConceptualizada = cantidadValidada;

      // Tipo OC positivo (excepto SIN LIMITE) exige cantidad por proveedor >= compra mínima
      const compraMin = Number(event.data?.compraMinima) || 0;
      const belowMinimo = this.POSITIVE_LIMITED_TYPES.includes(event.data?.tipoOc)
        && compraMin > 0 && cantidadValidada < compraMin;

      if (belowMinimo) {
        if (maxAllowed < compraMin) {
          event.data.cantidadConceptualizada = 0;
          alerts.basicAlert(
            'Cantidad insuficiente',
            `Solo quedan ${maxAllowed.toFixed(2)} piezas por asignar pero se requieren ${compraMin} (compra mínima) para "${event.data?.proveedorNombre ?? 'este proveedor'}". Ajuste la cantidad de los otros proveedores para liberar espacio.`,
            'warning'
          );
        } else {
          event.data.cantidadConceptualizada = compraMin;
          alerts.basicAlert(
            'Cantidad ajustada',
            `Con tipo OC "${event.data.tipoOc}", la cantidad por proveedor no puede ser menor a la compra mínima (${compraMin}). Se ajustó al mínimo.`,
            'warning'
          );
        }
      }

      event.data.costoTotal = this.lineTotal(event.data.costoUnitario, event.data.cantidadConceptualizada);
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }
    if (field === 'costoUnitario' || field === 'compraMinima') {
      const row = event.data;
      const cu = Number(row.costoUnitario) || 0;
      const q = Number(row.cantidadConceptualizada) || 0;
      const cm = Number(row.compraMinima) || 0;
      row.costoTotal = this.round2(cu) * q;
      row.costoXCompraMinima = cu * cm;
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }
    }
    this.updatePinnedBottomRow();
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

    // Validar que filas con tipo OC positivo limitado tengan cantidad >= compra mínima
    for (const row of this.rowData) {
      if (this.POSITIVE_LIMITED_TYPES.includes(row.tipoOc)) {
        const compraMin = Number(row.compraMinima) || 0;
        const cantidad = Number(row.cantidadConceptualizada) || 0;
        if (compraMin > 0 && cantidad < compraMin) {
          alerts.basicAlert(
            'Cantidad insuficiente',
            `El proveedor "${row.proveedorNombre ?? ''}" tiene tipo OC "${row.tipoOc}" pero la cantidad asignada (${cantidad}) es menor a la compra mínima (${compraMin}). Corrija antes de guardar.`,
            'warning'
          );
          if (this.gridApi) this.gridApi.refreshCells({ force: true });
          return;
        }
      }
    }

    await this.patchTypeOcAndQuantityOnly();

    // Persistir el total global del pedimento (suma de Costo Total) en ocandreq.total_pedimento.
    if (this.cotizacionId > 0) {
      await lastValueFrom(
        this.ocAndReqsService.patchTotalPedimento(this.cotizacionId, this.pinnedTotal || 0)
      ).catch(e => console.warn('⚠️ No se pudo guardar total_pedimento:', e));
    }

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    this.savedAtLeastOnce = true;
    alerts.basicAlert('Guardado', 'Registro guardado correctamente', 'success');
  }

  async generateOC() {
    if (this.rowData.length === 0 || this.ocGenerada) return;

    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA', 'COMPRA AUTORIZADA SIN LIMITE'];

    // Items sin tipoOc — pendientes de decisión
    const sinTipo = this.rowData.filter(
      (row: any) => !row.tipoOc || row.tipoOc === '' || row.tipoOc === 'SELECCIONE UNA OPCION'
    );
    const allTotalizado = sinTipo.length === 0;

    // Agrupar filas autorizadas con cantidadConceptualizada > 0 por proveedor.
    // Excepción: "COMPRA AUTORIZADA SIN LIMITE" se incluye aunque la cantidad sea 0
    // (representa una OC sin límite de cantidad).
    const rowsByProvider = new Map<number, any[]>();
    for (const row of this.rowData) {
      const isSinLimite = row.tipoOc === 'COMPRA AUTORIZADA SIN LIMITE';
      if (AUTHORIZED.includes(row.tipoOc) && (isSinLimite || Number(row.cantidadConceptualizada) > 0)) {
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

    // Validar por artículo: la suma de cantidades solicitadas a todos los proveedores
    // no debe ser menor a la cantidad requerida. Si lo es, pedir confirmación.
    // Se excluye "COMPRA AUTORIZADA SIN LIMITE" (cantidad ilimitada, no aplica el tope).
    const porArticulo = new Map<number, { nombre: string; requerida: number; solicitada: number; sinLimite: boolean }>();
    for (const row of this.rowData) {
      if (!AUTHORIZED.includes(row.tipoOc)) continue;
      const key = Number(row.articuloItemId) || 0;
      const entry = porArticulo.get(key) || {
        nombre: row.articulo || 'artículo',
        requerida: Number(row.cantidadComprar) || 0,
        solicitada: 0,
        sinLimite: false,
      };
      entry.solicitada += Number(row.cantidadConceptualizada) || 0;
      if (row.tipoOc === 'COMPRA AUTORIZADA SIN LIMITE') entry.sinLimite = true;
      porArticulo.set(key, entry);
    }
    const faltantes = Array.from(porArticulo.values()).filter(
      (a) => !a.sinLimite && a.requerida > 0 && a.solicitada > 0 && a.solicitada < a.requerida
    );
    if (faltantes.length > 0) {
      const nombres = faltantes.map((a) => `"${a.nombre}"`).join(', ');
      const msg = faltantes.length === 1
        ? `La cantidad que estás solicitando para el artículo ${nombres} es menor a la cantidad requerida. ¿Estás seguro que deseas continuar?`
        : `La cantidad que estás solicitando para los artículos ${nombres} es menor a la cantidad requerida. ¿Estás seguro que deseas continuar?`;
      const confirmFaltante = await alerts.confirmAlert('Cantidad menor a la requerida', msg, 'warning', 'Sí, continuar');
      if (!confirmFaltante.isConfirmed) return;
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

    // Snapshot de proveedores "nuevos" (por_autorizar=true) ANTES de patchRegistros,
    // ya que patchRegistros pone autorizacion=false para proveedores con tipoOc positivo.
    // Solo nos interesan los proveedores que están en rowsByProvider (ya filtrados por AUTORIZADO + cantidad > 0).
    const newProviderIdsForAutofill = new Set<number>();
    try {
      const snapshotChecks = Array.from(rowsByProvider.keys()).map(async (provId) => {
        try {
          const customer: any = await lastValueFrom(this.customersService.getCustomerById(provId));
          const isNew =
            customer?.autorizacion === true || customer?.autorizacion === 1 ||
            customer?.porAutorizar === true || customer?.porAutorizar === 1 ||
            customer?.por_autorizar === true || customer?.por_autorizar === 1;
          if (isNew) newProviderIdsForAutofill.add(provId);
        } catch {
          // Si falla el GET, simplemente no se auto-llena para ese proveedor
        }
      });
      await Promise.all(snapshotChecks);
    } catch (e) {
      console.warn('⚠️ Error al detectar proveedores "nuevos" para auto-llenado:', e);
    }

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
        const pedimento = this.slotFolioMap.get(slot.slotIndex) || slot.folio || `Pedimento-${slot.slotIndex}`;
        generatedPairs.push({ pedimento, oc: folio });
      } catch (e) {
        console.error(`❌ Error generando OC para proveedor ${provId}:`, e);
      }
    }

    if (generatedFolios.length > 0) {
      // Auto-llenado del "Tipo de Proveedor" (Categoría/Familia/Subfamilia) en subfamilyxprovider
      // para proveedores que eran "nuevos" (por_autorizar=true) ANTES de generar OC.
      // Se basa en id_familia/id_subfamilia del material vinculado a cada ítem (artículo "viejo").
      // Wrap en try/catch: si falla, NO bloquea el flujo de OC ya creadas.
      try {
        await this.autoFillTipoProveedorFromOC(rowsByProvider, newProviderIdsForAutofill);
      } catch (e) {
        console.warn('⚠️ Auto-llenado de Tipo de Proveedor falló (no bloqueante):', e);
      }

      await this.updatePorAutorizarAfterOC();
      await this.updateMaterialsAfterOC();

      // Marcar como principal=true al PRIMER proveedor procesado por cada artículo nuevo (PRODUCTO NUEVO).
      // No depende de si el proveedor es nuevo en el sistema, sino de si el artículo es nuevo.
      try {
        const materialsPrincipalSet = new Set<number>();
        for (const [provId, rows] of rowsByProvider) {
          for (const row of rows) {
            const nuevoRec = String(row?.nuevoRecurrente ?? '').toLowerCase();
            if (nuevoRec !== 'nuevo') continue;
            const idSupplie = Number(row?.idSupplie ?? 0);
            if (idSupplie <= 0 || materialsPrincipalSet.has(idSupplie)) continue;
            await lastValueFrom(
              this.ocAndReqsService.patchProveedorXTablaPrincipal(idSupplie, provId, true)
            ).catch(() => {});
            materialsPrincipalSet.add(idSupplie);
          }
        }
      } catch (e) {
        console.warn('⚠️ No se pudo marcar principal en proveedorxtablas:', e);
      }
    }

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
    this.ocGenerada = generatedFolios.length > 0;
    this.ocPairs = generatedPairs;
    for (const [provId] of rowsByProvider) this.proveedoresConOc.add(provId);

    // Bloquear el pedimento individual (cotizacionId) siempre que se genere al menos una OC.
    // Este lock es permanente: no lo toca el auto-corrector de quote-delison (que solo opera sobre el REQUIS).
    if (generatedFolios.length > 0 && this.cotizacionId) {
      await lastValueFrom(
        this.ocAndReqsService.lockRequisition(this.cotizacionId, true)
      ).catch(() => {});
    }

    // Bloquear la requisición padre solo si TODOS los pedimentos ya están terminados.
    // Se usa shouldLockRequisicion para no cerrar prematuramente cuando otros pedimentos siguen abiertos.
    if (this.requisitionId) {
      const shouldLock = await lastValueFrom(
        this.ocAndReqsService.shouldLockRequisicion(this.requisitionId)
      ).catch(() => ({ shouldLock: false }));
      if (shouldLock?.shouldLock) {
        await lastValueFrom(
          this.ocAndReqsService.lockRequisition(this.requisitionId, true)
        ).catch(() => {});
      }
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

  private async patchTypeOcAndQuantityOnly(): Promise<void> {
    for (const row of this.rowData) {
      if (row.slotItemId > 0) {
        await lastValueFrom(
          this.ocAndReqsService.patchTypeOc(row.slotItemId, row.tipoOc || '')
        ).catch(e => console.warn(`⚠️ No se pudo guardar typeOc para slotItem ${row.slotItemId}:`, e));

        await lastValueFrom(
          this.ocAndReqsService.patchCantidadConceptualizada(row.slotItemId, row.cantidadConceptualizada ?? 0)
        ).catch(e => console.warn(`⚠️ No se pudo guardar cantidadConceptualizada:`, e));
      }
    }
  }

  private async patchRegistros(): Promise<void> {
    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA', 'COMPRA AUTORIZADA SIN LIMITE'];
    const NOT_AUTHORIZED = ['COMPRA NO AUTORIZADA', 'CAMBIO DE ESPECIFICACIONES', 'ARTICULO NO AUTORIZADO'];

    // Snapshot de vínculos proveedor×artículo NUEVOS (campo7/por_autorizar = true) ANTES de
    // modificar nada. Solo los vínculos recién ligados a ese artículo deben inactivarse + dejar
    // bandera cuando el Tipo OC es negativo; los vínculos que YA existían (sin bandera) en negativo
    // solo cierran la OC (no se inactivan ni se les pone bandera), porque ya se les había comprado.
    const newLinkPairs = new Set<string>(); // clave: `${proveedorId}:${idSupplie}`
    const provIdsSnapshot = [...new Set(
      this.rowData.filter(r => r.proveedorId > 0 && r.idSupplie > 0).map(r => r.proveedorId)
    )];
    for (const provId of provIdsSnapshot) {
      try {
        const recs: any = await lastValueFrom(this.providersService.getProvidersXTable(provId, 'MATERIAL'));
        const arr: any[] = Array.isArray(recs) ? recs : [];
        for (const rec of arr) {
          const esNuevo = rec?.campo7 === true || rec?.campo7 === 1;
          if (esNuevo && rec?.campo1 != null) {
            newLinkPairs.add(`${provId}:${Number(rec.campo1)}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ No se pudo leer proveedorxtablas del proveedor ${provId} para snapshot:`, e);
      }
    }

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
          // Solo si el vínculo proveedor×artículo es NUEVO (recién ligado, con bandera por autorizar):
          // se inactiva el vínculo y se mantiene la bandera. Si el vínculo YA existía (sin bandera),
          // el negativo solo cierra la OC (patchTypeOc ya registró el tipo) y NO se toca activo/bandera.
          const esVinculoNuevo = newLinkPairs.has(`${row.proveedorId}:${row.idSupplie}`);
          if (esVinculoNuevo) {
            await lastValueFrom(
              this.ocAndReqsService.deactivateProveedorForMaterial(row.idSupplie, row.proveedorId)
            ).catch(e => console.warn(`⚠️ No se pudo desactivar proveedor:`, e));
            await lastValueFrom(
              this.ocAndReqsService.patchProveedorXTablaCampo7(row.idSupplie, row.proveedorId, true)
            ).catch(e => console.warn(`⚠️ No se pudo mantener "Por autorizar" en proveedor negativo:`, e));
          }
        }

        await lastValueFrom(
          this.ocAndReqsService.patchCantidadConceptualizada(row.slotItemId, row.cantidadConceptualizada ?? 0)
        ).catch(e => console.warn(`⚠️ No se pudo guardar cantidadConceptualizada:`, e));
      }
    }

    // Actualizar estado de proveedor en tabla providers según reglas de tipo OC
    const allRowsByProvider = new Map<number, any[]>();
    for (const row of this.rowData) {
      if (row.proveedorId > 0) {
        const list = allRowsByProvider.get(row.proveedorId) || [];
        list.push(row);
        allRowsByProvider.set(row.proveedorId, list);
      }
    }

    for (const [provId, rows] of allRowsByProvider) {
      const hasAnyNegative = rows.some(r => NOT_AUTHORIZED.includes(r.tipoOc));
      const hasAnyPositive = rows.some(r => AUTHORIZED.includes(r.tipoOc));
      if (!hasAnyNegative && !hasAnyPositive) continue;

      try {
        const customer: any = await lastValueFrom(this.customersService.getCustomerById(provId));
        const porAutorizar =
          customer?.autorizacion === true || customer?.autorizacion === 1 ||
          customer?.porAutorizar === true || customer?.porAutorizar === 1 ||
          customer?.por_autorizar === true || customer?.por_autorizar === 1;
        if (!porAutorizar) continue;

        const allNegative = rows.every(r => NOT_AUTHORIZED.includes(r.tipoOc));

        if (allNegative) {
          // Todos negativos → desactivar proveedor (active=false), porAutorizar se mantiene
          await lastValueFrom(
            this.customersService.updateCustomer(provId, { ...customer, active: false, vigente: false })
          ).catch(e => console.warn(`⚠️ No se pudo desactivar proveedor ${provId}:`, e));

          // También desactivar todas las asignaciones de materiales del proveedor en proveedorxtablas
          try {
            const matRecords: any = await lastValueFrom(this.providersService.getProvidersXTable(provId, 'MATERIAL'));
            const records: any[] = Array.isArray(matRecords) ? matRecords : [];
            await Promise.all(
              records.map(rec =>
                lastValueFrom(
                  this.providersService.updateProviderXTable(rec.id, { ...rec, active: false })
                ).catch(e => console.warn(`⚠️ No se pudo desactivar proveedorxtabla ${rec.id}:`, e))
              )
            );
          } catch (e) {
            console.warn(`⚠️ No se pudieron desactivar registros de materiales del proveedor ${provId}:`, e);
          }
        } else {
          // Todo positivo o mixto → proveedor activo, quitar porAutorizar
          await lastValueFrom(
            this.customersService.updateCustomer(provId, { ...customer, autorizacion: false })
          ).catch(e => console.warn(`⚠️ No se pudo quitar porAutorizar del proveedor ${provId}:`, e));
        }
      } catch (e) {
        console.warn(`⚠️ Error al leer/actualizar estado del proveedor ${provId}:`, e);
      }
    }
  }

  /**
   * Auto-llena el "Tipo de Proveedor" (Categoría/Familia/Subfamilia) en `subfamilyxprovider`
   * cuando se genera una OC de un proveedor "nuevo" (por_autorizar=1) con un artículo "viejo"
   * (con familia/subfamilia reales, distintas de PRODUCTO NUEVO).
   *
   * - NO modifica `principal` (queda en false) → no dispara update de `customer.typework`.
   * - NO modifica `por_autorizar` → `updatePorAutorizarAfterOC` lo maneja en su propio flujo.
   * - Evita duplicados consultando `getSubfamilyxProviderByProvider` antes de insertar.
   * - Todas las fallas son no-bloqueantes (log + skip).
   */
  private async autoFillTipoProveedorFromOC(
    rowsByProvider: Map<number, any[]>,
    newProviderIds: Set<number>
  ): Promise<void> {
    if (newProviderIds.size === 0) return;

    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return;

    // 1. Cargar materiales con familia/subfamilia una sola vez
    const materialsMap = new Map<number, { idFamilia: number; idSubfamilia: number }>();
    try {
      const materials: any = await lastValueFrom(this.materialsService.getMaterialsxview(idRoot));
      if (Array.isArray(materials)) {
        for (const m of materials) {
          const mid = Number(m?.id);
          if (Number.isFinite(mid) && mid > 0) {
            materialsMap.set(mid, {
              idFamilia: Number(m?.idFamilia ?? 0) || 0,
              idSubfamilia: Number(m?.idSubfamilia ?? 0) || 0
            });
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ No se pudo cargar materiales para auto-llenado:', e);
      return;
    }

    // IDs de catálogo para "PRODUCTO NUEVO" (FAM-CAT y SUB-FAM en warehouses.dbo.catalog)
    const PRODUCTO_NUEVO_FAM_ID = 1316;
    const PRODUCTO_NUEVO_SUB_ID = 1317;

    // 2. Procesar cada proveedor "nuevo"
    for (const provId of newProviderIds) {
      const rows = rowsByProvider.get(provId);
      if (!rows || rows.length === 0) continue;

      // Obtener subfamilias ya asignadas a este proveedor (para evitar duplicados)
      let existing: any[] = [];
      try {
        const res: any = await lastValueFrom(this.providersService.getSubfamilyxProviderByProvider(provId));
        existing = Array.isArray(res) ? res : [];
      } catch (e) {
        console.warn(`⚠️ No se pudo cargar subfamilyxprovider para proveedor ${provId}:`, e);
        continue;
      }
      const existingSubIds = new Set<number>(
        existing
          .map((r: any) => Number(r?.idSubfamily ?? r?.idSubFamily ?? 0))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      );

      // Si NO hay registros previos para este proveedor, el primer auto-insert debe ser principal=true
      // Si YA hay registros previos, no tocar el principal existente (todos los nuevos = false)
      const hasNoPreviousRecords = existing.length === 0;
      let firstPrincipalInserted = false;

      // Procesar cada fila del proveedor
      for (const row of rows) {
        // Saltar artículos "nuevos" (PRODUCTO NUEVO en columna recurrent del comparativo)
        const nuevoRec = String(row?.nuevoRecurrente ?? '').toLowerCase();
        if (nuevoRec === 'nuevo') continue;

        const idSupplie = Number(row?.idSupplie ?? 0) || 0;
        if (idSupplie <= 0) continue;

        const matInfo = materialsMap.get(idSupplie);
        if (!matInfo) continue;

        // Defensa adicional contra PRODUCTO NUEVO a nivel de catálogo
        if (matInfo.idFamilia === PRODUCTO_NUEVO_FAM_ID) continue;
        if (matInfo.idSubfamilia === PRODUCTO_NUEVO_SUB_ID) continue;

        // Subfamilia inválida → saltar
        if (matInfo.idSubfamilia <= 0) continue;

        // Ya existe esta combinación para este proveedor → saltar
        if (existingSubIds.has(matInfo.idSubfamilia)) continue;

        // Determinar valor de principal: true sólo para el primer registro cuando el proveedor no tenía nada previo
        const shouldBePrincipal = hasNoPreviousRecords && !firstPrincipalInserted;

        // INSERT en subfamilyxprovider
        try {
          await lastValueFrom(
            this.providersService.addSubfamilyxProvider({
              idSubfamily: matInfo.idSubfamilia,
              idProvider: provId,
              vigente: true,
              principal: shouldBePrincipal
            })
          );
          // Marcar como existente para evitar duplicar en el mismo loop
          existingSubIds.add(matInfo.idSubfamilia);
          if (shouldBePrincipal) {
            firstPrincipalInserted = true;

            // Si el insert fue como principal=true, actualizar customer.typework con la concatenación
            // SOLO se ejecuta cuando el proveedor no tenía registros previos (primer registro)
            try {
              const providerTypes: any = await lastValueFrom(this.providersService.getProviderType(provId));
              if (Array.isArray(providerTypes) && providerTypes.length > 0) {
                // Buscar el registro principal (el que acabamos de insertar)
                const principalRow = providerTypes.find((pt: any) =>
                  Number(pt?.idSubfamily ?? pt?.idSubFamily ?? 0) === matInfo.idSubfamilia
                ) || providerTypes.find((pt: any) => pt?.principal === true);

                if (principalRow) {
                  const tipoProveedorConcatenado = `${principalRow.nameParent || ''}/${principalRow.nameSubparent || ''}/${principalRow.nameProduct || ''}`;

                  const customerData: any = await lastValueFrom(this.customersService.getCustomerById(provId));
                  if (customerData) {
                    customerData.typework = tipoProveedorConcatenado;
                    await lastValueFrom(
                      this.customersService.updateCustomer(provId, customerData)
                    );
                  }
                }
              }
            } catch (eTypework) {
              console.warn(`⚠️ No se pudo actualizar typework para proveedor ${provId}:`, eTypework);
            }
          }
        } catch (e) {
          console.warn(`⚠️ No se pudo crear subfamilyxprovider (prov=${provId}, subfam=${matInfo.idSubfamilia}):`, e);
        }
      }
    }
  }

  private openNegativeTypeChat(numArticle: string, tag: string, onRevert: () => void, provId?: number, provName?: string, articleName?: string): void {
    this.itemCommentsService.openChatFor$.next({
      documentType: 'REQ',
      idDocument: this.requisitionId,
      numArticle,
      articleName: articleName || '',
      autoMessage: tag,
      forceComment: true,
      defaultTab: provId ? 'proveedor' : 'articulo',
      providerMessages: provId ? { idProvider: provId, providerName: provName || '' } : undefined
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
    this.syncGridRowData();
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.gridRowData);
      this.updatePinnedBottomRow();
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
    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA', 'COMPRA AUTORIZADA SIN LIMITE'];

    for (const row of this.rowData) {
      const isNewArticle = (row.nuevoRecurrente || '').toLowerCase() === 'nuevo';
      const hasAuthorizedType = AUTHORIZED.includes(row.tipoOc);
      const hasMaterialId = row.idSupplie && row.idSupplie > 0;

      if (isNewArticle && hasAuthorizedType && hasMaterialId) {
        // Partial update: solo aprobamos el producto nuevo (active=true, porAutorizar=false).
        // No enviamos insumo/articulo/idCategory/idFamilia/idSubfamilia/idMedida/idUbication/costos/stock
        // para no sobrescribir datos vigentes del maestro. El backend (MaterialService.Update) hace merge
        // y solo aplica los campos con valor.
        const materialData = {
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

  private async updateMaterialsAfterOC(): Promise<void> {
    const AUTHORIZED = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA', 'COMPRA AUTORIZADA SIN LIMITE'];
    const NOT_AUTHORIZED = ['COMPRA NO AUTORIZADA', 'CAMBIO DE ESPECIFICACIONES', 'ARTICULO NO AUTORIZADO'];

    // SNAPSHOT del por_autorizar REAL de cada material (maestro), leído justo antes de tocar banderas.
    // Las banderas active/por_autorizar solo deben cambiar para artículos que ERAN NUEVOS
    // (por_autorizar=1). Un artículo viejo (ya autorizado) NO debe desactivarse ni re-marcarse por
    // recibir un tipo OC negativo en una requisición. Si el snapshot falla, NO se toca nada.
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return;
    const eraNuevo = new Map<number, boolean>();
    try {
      const materials: any = await lastValueFrom(this.materialsService.getMaterialsxview(idRoot));
      if (Array.isArray(materials)) {
        for (const m of materials) {
          const mid = Number(m?.id);
          if (Number.isFinite(mid) && mid > 0) {
            const nuevo =
              m?.porAutorizar === true || m?.porAutorizar === 1 ||
              m?.por_autorizar === true || m?.por_autorizar === 1;
            eraNuevo.set(mid, nuevo);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ No se pudo leer el snapshot de por_autorizar; no se tocan banderas de materiales:', e);
      return;
    }

    const rowsByMaterial = new Map<number, any[]>();
    for (const row of this.rowData) {
      if (row.idSupplie && row.idSupplie > 0 && row.tipoOc) {
        const list = rowsByMaterial.get(row.idSupplie) || [];
        list.push(row);
        rowsByMaterial.set(row.idSupplie, list);
      }
    }

    for (const [materialId, rows] of rowsByMaterial) {
      // Solo artículos que ERAN NUEVOS (por_autorizar=1). Los viejos no se tocan.
      if (!eraNuevo.get(materialId)) continue;

      const hasAnyPositive = rows.some(r => AUTHORIZED.includes(r.tipoOc));
      const allNegative = rows.every(r => NOT_AUTHORIZED.includes(r.tipoOc));

      if (hasAnyPositive) {
        // Al menos un proveedor POSITIVO → autorizar el material
        await lastValueFrom(
          this.materialsService.updateMaterial(materialId.toString(), { active: true, porAutorizar: false })
        ).catch(e => console.warn(`⚠️ No se pudo autorizar material ${materialId}:`, e));
      } else if (allNegative) {
        // Todos NEGATIVOS → desactivar el material (solo aplica a artículos nuevos)
        await lastValueFrom(
          this.materialsService.updateMaterial(materialId.toString(), { active: false, porAutorizar: true })
        ).catch(e => console.warn(`⚠️ No se pudo desactivar material ${materialId}:`, e));
      }
    }
  }

  onCellMouseOver(event: any): void {
    const field = event.colDef?.field;
    const data = event.data;
    if (!data || data.__isTotal) return;
    const cellEl = event.event?.target as HTMLElement;
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    if (field === 'articulo') {
      this.showArticuloTooltip(rect, data);
    } else if (field === 'proveedorNombre') {
      this.showProveedorTooltip(rect, data);
    }
  }

  onCellMouseOut(event: any): void {
    const field = event.colDef?.field;
    if (field === 'articulo' || field === 'proveedorNombre') {
      this.hideArticuloTooltip();
    }
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
      { label: 'Prioridad:', value: data.prioridad || '—' },
      { label: 'Caducidad Mínima Requerida:', value: data.caducidadMinimaRequerida || '—' }
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

  private showProveedorTooltip(cellRect: DOMRect, data: any): void {
    this.hideArticuloTooltip();

    this.tooltipEl = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipEl, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipEl, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipEl, 'min-width', '220px');
    this.renderer.setStyle(this.tooltipEl, 'max-width', '340px');
    this.renderer.setStyle(this.tooltipEl, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');
    this.renderer.setStyle(this.tooltipEl, 'border-radius', '8px');
    this.renderer.setStyle(this.tooltipEl, 'box-shadow', '0 8px 24px rgba(0,0,0,0.4)');
    this.renderer.setStyle(this.tooltipEl, 'padding', '12px 14px');
    this.renderer.setStyle(this.tooltipEl, 'color', '#ffffff');
    this.renderer.setStyle(this.tooltipEl, 'font-size', '12px');
    this.renderer.setStyle(this.tooltipEl, 'line-height', '1.6');

    const rows = [
      { label: '# Artículo Externo:', value: data.numArticuloExterno || '—' },
      { label: 'Estado:', value: data.proveedorEstado || '—' },
      { label: 'Ciudad:', value: data.proveedorCiudad || '—' },
      { label: 'Teléfono:', value: data.proveedorTelefono || '—' }
    ];

    rows.forEach(({ label, value }, idx) => {
      const row = this.renderer.createElement('div');
      this.renderer.setStyle(row, 'display', 'flex');
      this.renderer.setStyle(row, 'gap', '8px');
      if (idx < rows.length - 1) this.renderer.setStyle(row, 'margin-bottom', '6px');

      const labelEl = this.renderer.createElement('span');
      this.renderer.setStyle(labelEl, 'color', 'rgba(255,255,255,0.8)');
      this.renderer.setStyle(labelEl, 'font-weight', '600');
      this.renderer.setStyle(labelEl, 'min-width', '120px');
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
        rowSpan: (params: any) => params.data?.__isTotal ? 1 : (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: (params: any) => params.data?.__isTotal
          ? { backgroundColor: '#ffffff' }
          : {
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
          if (params.data?.__isTotal) return { backgroundColor: '#ffffff' };
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
        rowSpan: (params: any) => params.data?.__isTotal ? 1 : (params.data?.__isBlockStart ? (params.data.__blockRowSpan || 1) : 0),
        cellStyle: (params: any) => params.data?.__isTotal
          ? { backgroundColor: '#ffffff' }
          : {
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
        cellStyle: (params: any) => params.data?.__isTotal
          ? { backgroundColor: '#ffffff' }
          : { backgroundColor: '#fff9c4', textAlign: 'center', padding: '4px' },
        valueFormatter: (params: any) =>
          params.data?.__isTotal ? '' :
          `$${(Number(params.value) || 0).toFixed(2)} ${this.currencyAbbr(params.data?.idCurrency)}`
      },
      {
        field: 'costoXCompraMinima',
        headerName: 'COSTO X COMPRA MIN.',
        width: 120,
        hide: true,
        suppressColumnsToolPanel: true,
        editable: false,
        cellStyle: { textAlign: 'center', padding: '4px' },
        valueFormatter: (params: any) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '$0.00'
      },
      {
        field: 'tipoOc',
        headerName: 'TIPO OC',
        width: 230,
        minWidth: 200,
        editable: (params: any) => !params.data?.__isTotal && !this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0)),
        singleClickEdit: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorPopup: true,
        cellEditorParams: () => ({
          values: this.tipoOcOptions.filter(opt => opt !== 'SELECCIONE UNA OPCION'),
          searchable: false,
          allowTyping: false,
          valueListMaxWidth: 280,
          valueListMaxHeight: 260
        }),
        tooltipValueGetter: (p: any) => p.data?.tipoOc || '',
        cellStyle: (params: any) => {
          const locked = this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0));
          return { textAlign: 'center', padding: '4px', fontSize: '10px', lineHeight: '1.2',
                   whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                   backgroundColor: locked ? '#eeeeee' : undefined, color: locked ? '#9e9e9e' : undefined };
        }
      },
      {
        field: 'cantidadConceptualizada',
        headerName: 'CANTIDAD X PROV.',
        width: 135,
        editable: (params: any) => {
          if (this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0))) return false;
          // Con presentaciones consistentes → se captura por modal (no editor inline).
          if (this.rowUsaModalPresentaciones(params.data)) return false;
          const tipoOc = params.data?.tipoOc;
          return tipoOc === 'COMPRA INMEDIATA' || tipoOc === 'COMPRA AUTORIZADA EN OTRA FECHA';
        },
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        // Sin `max` aquí a propósito: si el editor capa el valor, el handler nunca ve que excediste
        // y caía en la rama de "ajustar al mínimo". El tope (cantidad requerida) se valida en
        // onCellValueChanged, revirtiendo al valor original con el mensaje correcto.
        cellEditorParams: () => ({
          precision: 2,
          isFloat: true,
          min: 0
        }),
        // Si la fila usa modal, al hacer click abre el panel de presentaciones (Cantidad x Prov).
        onCellClicked: (params: any) => {
          if (this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0))) return;
          const t = params.data?.tipoOc;
          const asignable = t === 'COMPRA INMEDIATA' || t === 'COMPRA AUTORIZADA EN OTRA FECHA';
          if (!asignable) return;
          if (!this.rowUsaModalPresentaciones(params.data)) return;
          this.openCantidadPanel(params.data);
        },
        valueFormatter: (params: any) =>
          params.data?.__isTotal ? 'Total x Pedimento' :
          (params.value != null ? Number(params.value).toFixed(2) : '0.00'),
        cellStyle: (params: any) => {
          if (params.data?.__isTotal) {
            return { textAlign: 'right', padding: '4px', fontWeight: '700', color: '#1b5e20' };
          }
          const locked = this.proveedoresConOc.has(Number(params.data?.proveedorId ?? 0));
          const sinLimite = params.data?.tipoOc === 'COMPRA AUTORIZADA SIN LIMITE';
          if (sinLimite) {
            return { textAlign: 'center', padding: '4px',
                     backgroundColor: '#eeeeee', color: '#9e9e9e' };
          }
          const usaModal = !locked && this.rowUsaModalPresentaciones(params.data);
          return { textAlign: 'center', padding: '4px',
                   cursor: usaModal ? 'pointer' : undefined,
                   backgroundColor: locked ? '#eeeeee' : undefined, color: locked ? '#9e9e9e' : undefined };
        }
      },
      {
        field: 'costoTotal',
        headerName: 'COSTO TOTAL',
        width: 105,
        editable: false,
        // valueGetter calcula en tiempo real desde costoUnitario × cantidadConceptualizada,
        // así no depende de que row.costoTotal esté sincronizado manualmente.
        valueGetter: (params: any) => {
          if (params.data?.__isTotal) return null;
          if (!params.data) return 0;
          // Opción A: round2(unit con IVA) × cantidad. Para sin-límite, la primera fila cubre el resto.
          return this.computeCostoTotalForRow(params.data);
        },
        cellStyle: { backgroundColor: '#c8e6c9', fontWeight: '600', padding: '4px', textAlign: 'center' },
        valueFormatter: (params: any) =>
          params.data?.__isTotal ? this.pinnedTotalDisplay :
          `$${(Number(params.value) || 0).toFixed(2)} ${this.currencyAbbr(params.data?.idCurrency)}`
      },
      {
        field: 'comentario',
        headerName: 'CHAT',
        width: 88,
        editable: false,
        // En la fila de total (pinned) no se muestra el chat.
        cellRendererSelector: (params: any) => params.data?.__isTotal
          ? undefined
          : { component: ItemCommentsCellRendererComponent },
        cellRendererParams: (params: any) => ({
          documentType: 'REQ',
          idDocument: this.requisitionId,
          numArticle: params.data?.numArticle || params.data?.numArticuloInterno || '',
          idProvider: Number(params.data?.proveedorId ?? 0),
          articleName: String(params.data?.articulo ?? ''),
          providerName: String(params.data?.proveedorNombre ?? ''),
          locked: false
        }),
        onCellClicked: (params: any) => {
          const numArticle = params.data?.numArticle || params.data?.numArticuloInterno || '';
          if (!numArticle || !this.requisitionId) return;
          const provId = Number(params.data?.proveedorId ?? 0);
          this.itemCommentsService.openChatFor$.next({
            documentType: 'REQ',
            idDocument: this.requisitionId,
            numArticle,
            articleName: String(params.data?.articulo ?? ''),
            providerMessages: provId > 0
              ? { idProvider: provId, providerName: String(params.data?.proveedorNombre ?? '') }
              : undefined
          });
        },
        cellStyle: { padding: '4px', cursor: 'pointer' }
      }
    ];
    return this._colDefs;
  }

  public gridOptions: any = {
    rowHeight: 40,
    domLayout: 'autoHeight',
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

  /**
   * Tipos OC considerados "negativos" (no generan OC).
   * Se mantiene alineado con la lista NOT_AUTHORIZED usada por patchRegistros() y generateOC().
   */
  private readonly NEGATIVE_TIPO_OC = ['COMPRA NO AUTORIZADA', 'CAMBIO DE ESPECIFICACIONES', 'ARTICULO NO AUTORIZADO'];

  /** True cuando hay filas y todas tienen un tipoOc dentro de NEGATIVE_TIPO_OC. */
  get allTipoOcNegative(): boolean {
    if (!this.rowData || this.rowData.length === 0) return false;
    return this.rowData.every((row: any) => this.NEGATIVE_TIPO_OC.includes(row?.tipoOc));
  }

  /**
   * Finaliza la requisición cuando todos los Tipo OC son negativos.
   * Persiste los Tipo OC, bloquea la requisición y marca la comparación como cerrada.
   * No genera órdenes de compra (todas son negativas) y no toca la lógica de generateOC().
   */
  async finalizeReq(): Promise<void> {
    if (this.ocGenerada) return;
    if (!this.allTipoOcNegative) return;
    if (!this.requisitionId) {
      alerts.basicAlert('Sin requisición', 'No se pudo identificar la requisición a finalizar.', 'error');
      return;
    }

    const result = await alerts.confirmAlert(
      'Finalizar Requisición',
      'Todos los Tipo OC son negativos. Se cerrará la requisición sin generar órdenes de compra. ¿Continuar?',
      'warning',
      'Sí, finalizar'
    );
    if (!result.isConfirmed) return;

    alerts.showLoading('Finalizando requisición', 'Guardando estados y bloqueando la requisición...');

    try {
      await this.patchRegistros();
      await this.updateMaterialsAfterOC();

      // Bloquear el pedimento individual primero
      if (this.cotizacionId) {
        await lastValueFrom(
          this.ocAndReqsService.lockRequisition(this.cotizacionId, true)
        ).catch(e => console.warn('⚠️ No se pudo bloquear el pedimento:', e));
      }

      await lastValueFrom(
        this.ocAndReqsService.lockRequisition(this.requisitionId, true)
      ).catch(e => console.warn('⚠️ No se pudo bloquear la requisición:', e));

      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      this.savedAtLeastOnce  = true;
      this.ocGenerada        = true;

      this.cdr.detectChanges();
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.gridApi.refreshCells({ force: true });
      }

      alerts.closeLoading();
      alerts.basicAlert(
        'Requisición finalizada',
        'La requisición se cerró correctamente. No se generaron órdenes de compra.',
        'success'
      );
    } catch (e) {
      console.error('❌ Error finalizando requisición:', e);
      alerts.closeLoading();
      alerts.basicAlert('Error', 'No se pudo finalizar la requisición. Intenta nuevamente.', 'error');
    }
  }

}
