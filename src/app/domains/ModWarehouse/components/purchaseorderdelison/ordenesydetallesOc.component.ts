import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CustomersService } from 'app/services/customers.service';
import { SetupOcService } from 'app/services/setup-oc.service';
import { SetupService } from 'app/services/setup.service';
import { ConditionsPendingService } from 'app/services/conditions-pending.service';
import { SignalsService } from 'app/services/signals.service';
import { EntregaOcService } from 'app/services/entrega-oc.service';
import { EntregasPendingService } from 'app/services/entregas-pending.service';
import { lastValueFrom, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { EntradaDocumentsOverlayService } from 'app/services/entrada-documents-overlay.service';
import { IntandoutDocumentsService } from 'app/services/intandoutDocuments.service';
import { EntradaMoliendaService } from 'app/services/entrada-molienda.service';

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
  close?: boolean;
  __allItemsBlocked?: boolean;
}

interface TooltipItem {
  articulo: string;
  cantidadRequerida: number;
  cantidadXProv: number;
  cantidadEntregas: number;
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
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; position: relative;">
      <div *ngIf="alertMessage"
           style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 999;
                  background: #b71c1c; color: #fff; padding: 4px 16px; border-radius: 20px;
                  font-size: 0.78rem; font-weight: 600; white-space: nowrap;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.25); pointer-events: none;">
        {{ alertMessage }}
      </div>
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
           [style.flex]="itemsFlexSize"
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
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; flex-shrink: 0;">
          <span style="font-size: 0.78rem; font-weight: bold; color: #2e7d32;">Detalle de {{ selectedArticleRow.namearticle }}</span>
          <div style="display: flex; gap: 4px;">
            <button (click)="addNivel3Row()"
                    style="font-size: 0.7rem; padding: 1px 7px; border: 1px solid #2e7d32; border-radius: 4px;
                           background: #e8f5e9; color: #2e7d32; cursor: pointer; line-height: 1.6;">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button (click)="deleteNivel3Row()" [disabled]="nivel3Data.length <= 1"
                    style="font-size: 0.7rem; padding: 1px 7px; border: 1px solid #b71c1c; border-radius: 4px;
                           background: #ffebee; color: #b71c1c; cursor: pointer; line-height: 1.6;">
              <i class="bi bi-trash"></i> Eliminar
            </button>
            <button [disabled]="!hasNivel3Changes"
                    (click)="revertNivel3Changes()"
                    style="font-size: 0.7rem; padding: 1px 7px; border: 1px solid #e67e22; border-radius: 4px;
                           background: #fff3e0; color: #e67e22; cursor: pointer; line-height: 1.6;">
              <i class="bi bi-arrow-counterclockwise"></i> Deshacer
            </button>
          </div>
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
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    :host ::ng-deep .item-blocked-row .ag-cell:not([col-id="itemspdf"]) { background-color: #ffebee !important; color: #b71c1c !important; }
  `]
})
export class OrdenesydetallesOcComponent implements OnDestroy {
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);
  private setupOcService = inject(SetupOcService);
  private setupService = inject(SetupService);
  private ivaPercent = 0;   // IVA% de la sucursal (setup almacén) para aplicar a precio/total cuando mas_iva
  private conditionsPendingService = inject(ConditionsPendingService);
  private signalsService = inject(SignalsService);
  private entregaOcService = inject(EntregaOcService);
  private entregasPendingService = inject(EntregasPendingService);
  private entradaDocumentsOverlayService = inject(EntradaDocumentsOverlayService);
  private intandoutDocumentsService = inject(IntandoutDocumentsService);
  private entradaMoliendaService = inject(EntradaMoliendaService);

  private entregasPendingSub: Subscription;
  private conditionsPendingSub: Subscription;
  private countSub?: Subscription;

  constructor() {
    // Cuando se vacían las conditions pendientes (guardado global), quitar color rosa
    // de filas COMPRA AUTORIZADA EN OTRA FECHA cuya fecha fue efectivamente editada.
    this.conditionsPendingSub = this.conditionsPendingService.hasPending$.subscribe((has) => {
      if (!has && this.itemsData.length > 0) {
        let needsRefresh = false;
        this.itemsData.forEach((row: any) => {
          // Al guardarse, la fecha pendiente queda confirmada de forma persistente.
          if (row.__pendingDateSave) {
            row.__pendingDateSave = false;
            row.datepostponeConfirmada = true;
            needsRefresh = true;
          }
        });
        if (needsRefresh && this.itemsGridApi && !this.itemsGridApi.isDestroyed()) {
          // Forzar re-evaluación de cellStyle en toda la grilla (más robusto que por nodo/columna)
          this.itemsGridApi.refreshCells({ force: true });
        }
      }
    });

    // Cuando se vacían las entregas pendientes (guardado global desde el nivel 1),
    // se sincroniza el estado local del nivel 5.
    this.entregasPendingSub = this.entregasPendingService.hasPending$.subscribe((has) => {
      if (!has) {
        this.hasNivel3Changes = false;
        if (this.selectedArticleRow) {
          this.originalNivel3Data = JSON.parse(JSON.stringify(this.nivel3Data));
          // Tras guardar: el conteo real ya es nivel3Data.length. Actualizamos
          // entregasCount (que el formatter usa para el delta) y la baseline de
          // entregasCount para que un Deshacer posterior no regrese al estado pre-Guardar.
          this.selectedArticleRow.entregasCount = this.nivel3Data.length;
          this.selectedArticleRow.__originalEntregasCount = this.nivel3Data.length;
          if (this.itemsGridApi) {
            this.itemsGridApi.forEachNode((node: any) => {
              if (node.data === this.selectedArticleRow) {
                this.itemsGridApi.refreshCells({ rowNodes: [node], force: true });
              }
            });
          }
        }
      }
    });

    // Sincroniza el conteo de PDFs cuando el modal de documentos notifica un cambio.
    this.countSub = this.entradaDocumentsOverlayService.countUpdated$.subscribe(({ idEntrada, count }) => {
      // Nivel 3 (entregas)
      const nivel3Row = this.nivel3Data.find((r: any) => r.id === idEntrada);
      if (nivel3Row) {
        nivel3Row.pdfCount = count;
        if (this.nivel3GridApi && !this.nivel3GridApi.isDestroyed()) {
          this.nivel3GridApi.refreshCells({ columns: ['pdf'], force: true });
        }
      }
      // Items (busca por __entregaId o por id directo)
      const itemRow = this.itemsData.find((r: any) =>
        (r.__entregaId != null && r.__entregaId === idEntrada) || r.id === idEntrada
      );
      if (itemRow) {
        itemRow.pdfCount = count;
        if (this.itemsGridApi && !this.itemsGridApi.isDestroyed()) {
          this.itemsGridApi.refreshCells({ columns: ['itemspdf'], force: true });
        }
      }
    });
  }

  private internalParams: any;
  private gridApi!: GridApi;
  private itemsGridApi!: GridApi;
  private providersLoaded = false;
  private gridReady = false;

  rowData: OcRow[] = [];
  itemsData: any[] = [];
  selectedOcRow: OcRow | null = null;

  get itemsFlexSize(): string {
    if (this.selectedArticleRow) return '0 0 130px';
    // title bar ≈ 28px + ag-header ≈ 32px + per row 42px + padding 16px, cap at 500px
    const h = Math.min(200 + this.itemsData.length * 42, 500);
    return `0 0 ${h}px`;
  }
  providers: any[] = [];
  conditionsOptions: number[] = [];
  hasLocalChanges = false;
  selectedArticleRow: any = null;
  nivel3Data: any[] = [];

  private originalItemsData: any[] = [];
  private changedItemIds = new Set<number>();
  private nivel3GridApi!: GridApi;
  private originalNivel3Data: any[] = [];
  hasNivel3Changes = false;
  selectedNivel3Row: any = null;
  alertMessage = '';
  private alertTimeout: any;

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
      cellStyle: (params: any) => params.data?.__allItemsBlocked === true
        ? { backgroundColor: '#ffebee' }   // OC con todos los ítems cerrados → fondo rojizo
        : { backgroundColor: '#c8e6c9' },
      onCellClicked: (params: any) => this.onRowClicked(params),
      cellRenderer: (params: any) => {
        const isClosed = params.data?.__allItemsBlocked === true;
        const div = document.createElement('div');
        div.style.cssText = `cursor:pointer; display:flex; align-items:center; gap:5px; ${isClosed ? 'color:#b71c1c;' : ''}`;
        const text = document.createElement('span');
        text.textContent = params.value || '—';
        div.appendChild(text);
        if (isClosed) {
          const lock = document.createElement('i');
          lock.className = 'bi bi-lock-fill';
          lock.style.cssText = 'color:#b71c1c; font-size:0.85rem; flex-shrink:0;';
          lock.title = 'Orden de Compra cerrada';
          div.appendChild(lock);
        }
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
      // Bloqueada si: el ítem está cerrado, ya tiene entregas guardadas (cambiar N
      // desalinearía lo persistido) o el tipo OC es "COMPRA AUTORIZADA SIN LIMITE".
      editable: (p: any) => !p.data?.__blocked
        && !((p.data?.entregasCount ?? 0) > 0)
        && p.data?.typeoc !== 'COMPRA AUTORIZADA SIN LIMITE',
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: () => ({ values: this.conditionsOptions }),
      valueParser: (p) => { const n = Number(p.newValue); return isNaN(n) ? p.oldValue : n; },
      valueFormatter: (p: any) => {
        // `conditions` (p.value) = plan original elegido en el dropdown.
        // `entregasCount` = conteo real de entregas (vivas en BD o pending in-session).
        // Mostramos delta cuando hay entregas (locked); si no hay, valor plano.
        const planned = Number(p.value ?? 0);
        const real = Number(p.data?.entregasCount ?? 0);
        if (real === 0) return String(planned);
        const delta = real - planned;
        if (delta > 0) return `${planned} + ${delta}`;
        if (delta < 0) return `${planned} - ${Math.abs(delta)}`;
        return String(planned);
      },
      cellStyle: (p: any) => ((p.data?.entregasCount ?? 0) > 0 || p.data?.typeoc === 'COMPRA AUTORIZADA SIN LIMITE')
        ? { backgroundColor: '#eeeeee', color: '#9e9e9e', cursor: 'not-allowed' }
        : null,
    },
    { field: 'typeoc', headerName: 'Tipo OC', width: 160, editable: false },
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
      cellRenderer: (p: any) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; gap:5px;';
        const span = document.createElement('span');
        span.textContent = p.value || '';
        div.appendChild(span);
        if (p.data?.__blocked) {
          const lock = document.createElement('i');
          lock.className = 'bi bi-lock-fill';
          lock.style.cssText = 'color:#b71c1c; font-size:0.85rem; flex-shrink:0;';
          lock.title = 'Artículo cerrado';
          div.appendChild(lock);
        }
        return div;
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
    {
      field: 'quantity',
      headerName: 'Cantidad Pedida',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p: any) => {
        const qty = Number(p.value ?? 0);
        const suma = Number(p.data?.__sumaCantidadRecibir ?? 0);
        if (suma > 0) return `${qty} / ${suma}`;
        return String(qty);
      },
    },
    {
      field: 'price',
      headerName: 'Precio unitario',
      width: 140,
      type: 'numericColumn',
      // Precio guardado = BASE. Si la línea tiene IVA, se muestra con IVA REDONDEADO a 2 dec.
      valueGetter: (p: any) => {
        const base = Number(p.data?.price) || 0;
        const v = p.data?.masIva ? base * (1 + this.ivaPercent / 100) : base;
        return Math.round(v * 100) / 100;
      },
      valueFormatter: (p) => {
        const n = Number(p.value);
        return Number.isFinite(n) && n > 0
          ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
          : '';
      },
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      type: 'numericColumn',
      // Total = precio unitario con IVA REDONDEADO a 2 dec × cantidad (para que cuadre con el precio mostrado).
      valueGetter: (p: any) => {
        const base = Number(p.data?.price) || 0;
        const qty = Number(p.data?.quantity) || 0;
        const factor = p.data?.masIva ? (1 + this.ivaPercent / 100) : 1;
        const unit = Math.round(base * factor * 100) / 100;
        return unit * qty;
      },
      valueFormatter: (p) => {
        const n = Number(p.value);
        return Number.isFinite(n) && n > 0
          ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
          : '';
      },
    },
    {
      field: 'notaFactura',
      headerName: 'Nota / Factura',
      width: 150,
      editable: (p: any) => !p.data?.__blocked && Number(p.data?.conditions ?? 1) <= 1,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: { values: ['Nota', 'Factura'] },
      // Devolver siempre estilo explícito: si se retorna null, AG Grid no limpia
      // de forma fiable el gris aplicado cuando conditions vuelve a <= 1.
      cellStyle: (p: any) => Number(p.data?.conditions ?? 1) > 1
        ? { backgroundColor: '#eeeeee', color: '#9e9e9e', cursor: 'not-allowed' }
        : { backgroundColor: '', color: '', cursor: '' },
    },
    { field: 'caducidadMinimaRequerida', headerName: 'Caducidad Minima Requerida', width: 180 },
    {
      field: 'datepostpone',
      headerName: 'Fecha Entrega',
      width: 130,
      editable: (p: any) => !p.data?.__blocked && p.data?.typeoc === 'COMPRA AUTORIZADA EN OTRA FECHA',
      cellDataType: 'dateString',
      cellEditor: 'agDateStringCellEditor',
      cellStyle: (p: any) => {
        // Retornar siempre backgroundColor explícito: si se devuelve null, AG Grid
        // no limpia de forma fiable el rosa aplicado previamente.
        // Rosa mientras: es el tipo y NO está confirmada de forma persistente (BD),
        // o hay una edición de fecha sin guardar todavía en esta sesión.
        const isTipo = p.data?.typeoc === 'COMPRA AUTORIZADA EN OTRA FECHA';
        const pink = isTipo && (!p.data?.datepostponeConfirmada || p.data?.__pendingDateSave);
        return { backgroundColor: pink ? '#fce4ec' : '' };
      },
      valueFormatter: (p) => {
        if (!p.value) return '';
        // Parsea directamente del string ISO para evitar conversión de timezone
        const iso = String(p.value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
        const date = new Date(p.value);
        return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
      },
    },
    {
      headerName: 'PDF',
      colId: 'itemspdf',
      width: 70,
      sortable: false,
      cellStyle: (p: any) => p.data?.__entregaId == null
        ? { backgroundColor: '#eeeeee', cursor: 'not-allowed' }
        : null,
      onCellClicked: (params: any) => {
        if (params.data?.__entregaId == null) return;
        this.entradaDocumentsOverlayService.open({ idEntrada: params.data.__entregaId, docType: params.data.__docType ?? 'entrega', readOnly: params.data?.__blocked === true });
      },
      cellRenderer: (params: any) => {
        const locked = params.data?.__entregaId == null;
        const count = Number(params.data?.pdfCount ?? 0);
        const div = document.createElement('div');
        div.style.cssText = `text-align: center; cursor: ${locked ? 'not-allowed' : 'pointer'}; pointer-events: ${locked ? 'none' : 'auto'};`;
        if (locked) {
          div.innerHTML = `<i class="bi bi-file-pdf" style="color:#bdbdbd; font-size:1.2rem;" title="Disponible al generar entrada en almacén"></i>`;
        } else if (count > 0) {
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
          div.innerHTML = `<i class="bi bi-file-pdf" style="color:#d32f2f; font-size:1.2rem;" title="Ver documentos"></i>`;
        }
        return div;
      },
    },
    {
      field: 'fechaEntradaAlmacen',
      headerName: 'Fecha Entrada Almacén',
      width: 160,
      editable: false,
      cellStyle: { backgroundColor: '#f5f5f5', color: '#757575' },
      // Con más de una entrega los datos de almacén se manejan por entrega (nivel 5) → '—'
      valueFormatter: (p) => Number(p.data?.conditions ?? 1) > 1 ? '—' : this.formatFechaDmy(p.value),
    },
    {
      field: 'cantidadEntradaAlmacen',
      headerName: 'Cantidad Entrada Almacén',
      width: 180,
      type: 'numericColumn',
      editable: false,
      valueFormatter: (p) => {
        if (Number(p.data?.conditions ?? 1) > 1) return '—';
        const v = Number(p.value ?? 0);
        return Number.isFinite(v) && v > 0 ? v.toLocaleString('es-MX') : '';
      },
      cellStyle: { backgroundColor: '#e3f2fd', color: '#0d47a1', fontWeight: '600' },
    },
  ];

  itemsGridOptions: any = {
    headerHeight: 45,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true, wrapHeaderText: true },
    rowClassRules: {
      'item-blocked-row': (p: any) => p.data?.__blocked === true,
    },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
    onCellValueChanged: (event: any) => {
      if (event.colDef.field === 'datepostpone') {
        // Normaliza cualquier formato de fecha a YYYY-MM-DD para comparación segura
        const toIso = (s: any): string => {
          if (!s) return '';
          const str = String(s).trim();
          const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
          return str.substring(0, 10);
        };
        const original = toIso(event.data?.__originalDatepostpone);
        const newDate = toIso(event.newValue);
        if (original && (!newDate || newDate <= original)) {
          event.data.datepostpone = event.oldValue ?? original;
          event.api.refreshCells({ rowNodes: [event.node], columns: ['datepostpone'], force: true });
          this.showInlineAlert('La fecha debe ser mayor a la fecha original');
          return;
        }
        // Guardar siempre en formato YYYY-MM-DD
        if (newDate) event.data.datepostpone = newDate;
        // Flag temporal: mantiene el rosa hasta que se guarde.
        event.data.__pendingDateSave = true;

        // Si el nivel 5 está abierto para este mismo ítem (COMPRA AUTORIZADA EN OTRA FECHA),
        // reflejar la nueva fecha en las filas que aún tenían la fecha base anterior (sin editar).
        if (this.selectedArticleRow === event.data
            && event.data.typeoc === 'COMPRA AUTORIZADA EN OTRA FECHA') {
          const oldBase = toIso(event.oldValue);
          let changed = false;
          this.nivel3Data.forEach((r: any) => {
            if (toIso(r.fechaEntrega) === oldBase) {
              r.fechaEntrega = newDate;
              changed = true;
            }
          });
          if (changed && this.nivel3GridApi && !this.nivel3GridApi.isDestroyed()) {
            this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
          }
        }

        const { conditions, ...rest } = event.data;
        // La confirmación SÍ se persiste en backend; la fila visible queda rosa hasta guardar.
        const cleanItem = { ...rest, datepostponeConfirmada: true };
        this.conditionsPendingService.add(event.data.id, cleanItem, Number(conditions));
        this.changedItemIds.add(event.data.id);
        this.hasLocalChanges = true;
        return;
      }
      if (event.colDef.field === 'notaFactura' && event.data?.id) {
        const { conditions, ...rest } = event.data;
        const cleanItem: any = { ...rest };
        if (event.data.__pendingDateSave) cleanItem.datepostponeConfirmada = true;
        this.conditionsPendingService.add(event.data.id, cleanItem, Number(conditions ?? 1));
        this.changedItemIds.add(event.data.id);
        this.hasLocalChanges = true;
        return;
      }
      if (event.colDef.field === 'conditions' && event.data?.id) {
        const newCond = Number(event.newValue);
        // Con más de una entrega la Nota/Factura se maneja por entrega (nivel 5),
        // así que se limpia el valor a nivel ítem.
        if (newCond > 1 && event.data.notaFactura) {
          event.data.notaFactura = '';
          event.api.refreshCells({ rowNodes: [event.node], columns: ['notaFactura'], force: true });
        }
        const { conditions, ...rest } = event.data;
        const cleanItem: any = { ...rest };
        // Si hay una edición de fecha pendiente, preservar la confirmación al guardar condiciones.
        if (event.data.__pendingDateSave) cleanItem.datepostponeConfirmada = true;
        this.conditionsPendingService.add(event.data.id, cleanItem, Number(event.newValue));
        this.changedItemIds.add(event.data.id);
        this.hasLocalChanges = true;
        event.api.refreshCells({ rowNodes: [event.node], columns: ['namearticle', 'notaFactura', 'fechaEntradaAlmacen', 'cantidadEntradaAlmacen'], force: true });

        const min = this.conditionsOptions.length ? this.conditionsOptions[0] : 1;
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
      editable: (p) => !p.data?.close && !p.data?.fechaEntradaAlmacen,
      cellDataType: 'dateString',
      cellEditor: 'agDateStringCellEditor',
      cellStyle: (p) => (p.data?.close || p.data?.fechaEntradaAlmacen)
        ? { backgroundColor: '#f5f5f5', color: '#9e9e9e' }
        : null,
      valueFormatter: (p) => this.formatFechaDmy(p.value),
    },
    {
      field: 'cantidadRecibir',
      headerName: 'Cantidad a Recibir',
      width: 150,
      editable: (p) => !p.data?.close,
      type: 'numericColumn',
      cellStyle: (p) => p.data?.close ? { backgroundColor: '#f5f5f5', color: '#9e9e9e' } : null,
      valueParser: (p) => { const n = Number(p.newValue); return isNaN(n) ? p.oldValue : n; },
    },
    {
      field: 'totalEntrega',
      headerName: 'Total x Entrega',
      width: 140,
      editable: false,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#eeeeee', color: '#424242' },
      valueFormatter: (p) => {
        const n = Number(p.value);
        return Number.isFinite(n) && n > 0
          ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
          : '';
      },
    },
    {
      field: 'notaFactura',
      headerName: 'Nota / Factura',
      flex: 1,
      minWidth: 140,
      editable: (p) => !p.data?.close,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: { values: ['Nota', 'Factura'] },
      cellStyle: (p) => p.data?.close ? { backgroundColor: '#f5f5f5', color: '#9e9e9e' } : null,
    },
    {
      headerName: 'PDF',
      colId: 'pdf',
      width: 70,
      sortable: false,
      onCellClicked: (params: any) => {
        const idEntrada = params.data?.id;
        // Bloqueado hasta que haya entrada en almacén (fecha + cantidad)
        const hasAlmacen = !!params.data?.fechaEntradaAlmacen && Number(params.data?.cantidadEntradaAlmacen) > 0;
        if (!idEntrada || !hasAlmacen) return;
        this.entradaDocumentsOverlayService.open({ idEntrada, readOnly: params.data?.close === true });
      },
      cellRenderer: (params: any) => {
        const idEntrada = params.data?.id;
        const hasAlmacen = !!params.data?.fechaEntradaAlmacen && Number(params.data?.cantidadEntradaAlmacen) > 0;
        const count = Number(params.data?.pdfCount ?? 0);
        const div = document.createElement('div');
        // Sin entrada en almacén → ícono gris bloqueado (no clickeable)
        if (!idEntrada || !hasAlmacen) {
          div.style.cssText = 'text-align: center; cursor: not-allowed; pointer-events: none;';
          div.innerHTML = `<i class="bi bi-file-pdf" style="color: #bdbdbd; font-size: 1.1rem;" title="Disponible al registrar la entrada en almacén"></i>`;
          return div;
        }
        div.style.cssText = 'text-align: center; cursor: pointer;';
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
    {
      field: 'fechaEntradaAlmacen',
      headerName: 'Fecha Entrada Almacén',
      width: 160,
      editable: false,
      cellStyle: { backgroundColor: '#f5f5f5', color: '#757575' },
      valueFormatter: (p) => this.formatFechaDmy(p.value),
    },
    {
      field: 'cantidadEntradaAlmacen',
      headerName: 'Cantidad Entrada Almacén',
      width: 180,
      type: 'numericColumn',
      editable: false,
      valueFormatter: (p) => {
        const v = Number(p.value ?? 0);
        return Number.isFinite(v) && v > 0 ? v.toLocaleString('es-MX') : '';
      },
      cellStyle: { backgroundColor: '#e3f2fd', color: '#0d47a1', fontWeight: '600' },
    },
  ];

  nivel3GridOptions: any = {
    headerHeight: 28,
    rowHeight: 25,
    rowSelection: 'single',
    defaultColDef: { resizable: true, sortable: true },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
    onSelectionChanged: (event: any) => {
      const rows = event.api.getSelectedRows();
      this.selectedNivel3Row = rows.length ? rows[0] : null;
    },
    onCellValueChanged: (event: any) => {
      if (event.colDef.field === 'fechaEntrega') {
        const rowIndex = event.node.rowIndex ?? 0;
        if (rowIndex > 0) {
          const prevFecha = this.nivel3Data[rowIndex - 1]?.fechaEntrega ?? '';
          const newFecha = event.newValue ?? '';
          if (prevFecha && newFecha <= prevFecha) {
            event.data.fechaEntrega = event.oldValue ?? '';
            event.api.refreshCells({ rowNodes: [event.node], columns: ['fechaEntrega'], force: true });
            this.showInlineAlert('La fecha debe ser mayor a la fila anterior');
            return;
          }
        }
        // Todas las fechas de entrega deben ser únicas
        const newFecha = event.newValue ?? '';
        const hasDuplicate = this.nivel3Data.some((r: any, i: number) =>
          i !== (event.node.rowIndex ?? -1) && r.fechaEntrega === newFecha
        );
        if (hasDuplicate) {
          event.data.fechaEntrega = event.oldValue ?? '';
          event.api.refreshCells({ rowNodes: [event.node], columns: ['fechaEntrega'], force: true });
          this.showInlineAlert('La fecha ya existe en otra fila, todas deben ser diferentes');
          return;
        }
      }
      if (event.colDef.field === 'cantidadRecibir') {
        const cantEntrada = Number(event.data?.cantidadEntradaAlmacen ?? 0);
        const newVal = Number(event.newValue ?? 0);
        if (cantEntrada > 0 && newVal < cantEntrada) {
          event.data.cantidadRecibir = event.oldValue ?? null;
          event.api.refreshCells({ rowNodes: [event.node], columns: ['cantidadRecibir'], force: true });
          this.showInlineAlert(`La cantidad a recibir no puede ser menor a la ya entrada al almacén (${cantEntrada.toLocaleString('es-MX')})`);
          return;
        }
        const maxQty = Number(this.selectedArticleRow?.quantity ?? 0);
        const newSum = this.nivel3Data.reduce((acc, row) => acc + Number(row.cantidadRecibir ?? 0), 0);
        if (newSum > maxQty) {
          event.data.cantidadRecibir = event.oldValue ?? null;
          event.api.refreshCells({ rowNodes: [event.node], columns: ['cantidadRecibir'], force: true });
          this.showInlineAlert(`La cantidad excede la cotización (máx. ${maxQty})`);
          return;
        }
        const price = Number(this.selectedArticleRow?.price ?? 0);
        const qty = Number(event.newValue ?? 0);
        event.data.totalEntrega = Number.isFinite(price * qty) ? price * qty : 0;
        event.api.refreshCells({ rowNodes: [event.node], columns: ['totalEntrega'], force: true });
      }
      if (event?.data) event.data.__touched = true;
      this.hasNivel3Changes = true;
      const idDetail = Number(this.selectedArticleRow?.id);
      if (idDetail) {
        this.entregasPendingService.set(idDetail, this.nivel3Data);
      }
      this.syncSelectedItemQuantityDelta();
    },
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
    // IVA% de la sucursal (setup almacén) — el precio guardado es BASE (Opción B); el IVA se aplica al mostrar.
    this.setupService.getWarehouseSetupByBranch(Number(idBranch)).subscribe({
      next: (d: any) => {
        this.ivaPercent = Number(d?.iva) || 0;
        if (this.itemsGridApi) this.itemsGridApi.refreshCells({ force: true });
      },
      error: () => { this.ivaPercent = 0; }
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
      this.autosizeNivel3();
    }
  }

  private openNivel3(articleRow: any): void {
    if (this.selectedArticleRow === articleRow) {
      this.closeNivel3();
      return;
    }
    if (articleRow.__originalConditions == null) {
      articleRow.__originalConditions = Number(articleRow.conditions ?? 0);
    }
    if (articleRow.__originalEntregasCount == null) {
      articleRow.__originalEntregasCount = Number(articleRow.entregasCount ?? 0);
    }
    this.selectedArticleRow = articleRow;
    this.selectedNivel3Row = null;
    this.loadNivel3Data(articleRow);
    if (this.itemsGridApi) {
      this.itemsGridApi.forEachNode((node: any) => {
        node.setRowHeight(node.data === articleRow ? undefined : 0);
      });
      this.itemsGridApi.onRowHeightChanged();
    }
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private dateToIso(value: any): string {
    if (!value) return this.todayIso();
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return this.todayIso();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return this.todayIso(); }
  }

  private emptyNivel3Row(fechaBase?: string): any {
    const today = this.todayIso();
    return { id: null, fechaEntrega: fechaBase ?? today, cantidadRecibir: null, notaFactura: '', totalEntrega: null, fechaEntradaAlmacen: '' };
  }

  private addDaysToIso(isoDate: string, days: number): string {
    if (!isoDate || days === 0) return isoDate;
    const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return isoDate;
    const d = new Date(+m[1], +m[2] - 1, +m[3] + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Fecha base para las filas del nivel 5. Solo los ítems "COMPRA AUTORIZADA EN OTRA FECHA"
   * heredan la fecha de entrega (datepostpone) del nivel 4; el resto usa la fecha de hoy.
   */
  private nivel3FechaBase(articleRow: any): string {
    return this.dateToIso(articleRow?.datepostpone);
  }

  private autosizeNivel3(): void {
    setTimeout(() => {
      if (this.nivel3GridApi && !this.nivel3GridApi.isDestroyed()) {
        this.nivel3GridApi.autoSizeAllColumns();
      }
    });
  }

  /** Carga las entregas guardadas del ítem. Si ya hay entregas reales, mostramos
   *  exactamente esas (sin scaffold) — el delta vs `conditions` se ve en la
   *  columna Cantidad Entregas. Si no hay ninguna, scaffold `conditions` filas
   *  vacías para que el usuario las llene. */
  private loadNivel3Data(articleRow: any): void {
    const planned = Math.max(1, Number(articleRow?.conditions) || 0);
    const idDetail = Number(articleRow?.id);
    const fechaBase = this.nivel3FechaBase(articleRow);

    if (!idDetail) {
      this.buildNivel3Grid(articleRow);
      this.originalNivel3Data = JSON.parse(JSON.stringify(this.nivel3Data));
      this.hasNivel3Changes = false;
      return;
    }

    this.entregaOcService.getByDetail(idDetail).subscribe({
      next: (saved) => {
        const list = Array.isArray(saved) ? saved : [];
        // Baseline desde BD: lo que se usará para Deshacer.
        const baseline: any[] = list.length > 0
          ? list.map(s => ({
              id: s.id ?? null,
              fechaEntrega: s.fechaEntrega ?? '',
              cantidadRecibir: s.cantidadRecibir ?? null,
              notaFactura: s.notaFactura ?? '',
              totalEntrega: s.totalEntrega ?? null,
              fechaEntradaAlmacen: s.fechaEntradaAlmacen ?? '',
            }))
          : Array.from({ length: planned }, (_, i) => this.emptyNivel3Row(this.addDaysToIso(fechaBase, i)));

        // Mapear close desde BD para que las columnas se bloqueen correctamente
        if (list.length > 0) {
          baseline.forEach((row: any, i: number) => {
            row.close = list[i]?.close ?? false;
          });
        }

        this.originalNivel3Data = baseline;

        // Si en esta sesión hay cambios pendientes (add/delete/edit aún no guardados),
        // mostrarlos en vez del estado de BD. Así un close+reopen no los pierde.
        const pendingRows = this.entregasPendingService.getPendingRows(idDetail);
        if (pendingRows !== undefined) {
          this.nivel3Data = JSON.parse(JSON.stringify(pendingRows));
          this.hasNivel3Changes = true;
        } else {
          this.nivel3Data = JSON.parse(JSON.stringify(baseline));
          this.hasNivel3Changes = false;
        }
        // Registrar el estado visible para que la validación de fechas duplicadas
        // funcione aún cuando el usuario no edite nada (entregas pre-existentes en BD).
        this.entregasPendingService.setVisible(idDetail, this.nivel3Data);
        if (this.nivel3GridApi) {
          this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
          this.autosizeNivel3();
        }
        this.loadNivel3PdfCounts();
        this.loadNivel3EntradaCantidades();
      },
      error: () => {
        this.buildNivel3Grid(articleRow);
        this.originalNivel3Data = JSON.parse(JSON.stringify(this.nivel3Data));
        this.hasNivel3Changes = false;
      },
    });
  }

  private buildNivel3Grid(articleRow: any, preserve: boolean = false): void {
    const count = Math.max(1, Number(articleRow?.conditions) || 0);
    const existing = preserve ? (this.nivel3Data || []) : [];
    const fechaBase = this.nivel3FechaBase(articleRow);

    const newData: any[] = [];
    for (let i = 1; i <= count; i++) {
      const prior = existing[i - 1];
      newData.push(prior ?? this.emptyNivel3Row(this.addDaysToIso(fechaBase, i - 1)));
    }
    this.nivel3Data = newData;

    if (this.nivel3GridApi) {
      this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
      this.autosizeNivel3();
    }
  }

  /** Revierte las entregas del nivel 5 al último estado cargado/guardado y descarta los pendientes. */
  revertNivel3Changes(): void {
    this.nivel3Data = JSON.parse(JSON.stringify(this.originalNivel3Data));
    this.hasNivel3Changes = false;
    if (this.selectedArticleRow?.__originalConditions != null) {
      this.selectedArticleRow.conditions = this.selectedArticleRow.__originalConditions;
      this.refreshConditionsCell();
    }
    // Restaurar entregasCount al valor que tenía antes de Agregar/Eliminar.
    if (this.selectedArticleRow?.__originalEntregasCount != null) {
      this.selectedArticleRow.entregasCount = this.selectedArticleRow.__originalEntregasCount;
    }
    const idDetail = Number(this.selectedArticleRow?.id);
    if (idDetail) {
      this.entregasPendingService.remove(idDetail);
      // Resincronizar visible con la baseline ahora restaurada.
      this.entregasPendingService.setVisible(idDetail, this.nivel3Data);
    }
    if (this.nivel3GridApi) {
      this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
    }
    this.loadNivel3PdfCounts();
    this.loadNivel3EntradaCantidades();
    this.syncSelectedItemQuantityDelta();
  }

  /** Muestra una fecha almacenada (yyyy-MM-dd) como DD/MM/YYYY. */
  private formatFechaDmy(value: any): string {
    if (!value) return '';
    const str = String(value).trim();
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return str;
  }

  private closeNivel3(): void {
    const prevIdDetail = Number(this.selectedArticleRow?.id);
    this.selectedArticleRow = null;
    this.nivel3Data = [];
    this.originalNivel3Data = [];
    this.hasNivel3Changes = false;
    if (prevIdDetail) this.entregasPendingService.clearVisible(prevIdDetail);
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
            close: oc.close ?? oc.Close ?? false,
          };
        });

        if (this.gridApi && !this.gridApi.isDestroyed()) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }

        // Pre-cargar datos para tooltip de cada OC (no bloquea el render)
        this.preloadTooltipData();
        // Calcular en segundo plano si cada OC tiene todos sus ítems bloqueados (candado OC)
        this.loadOcsBlockedState();
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
            cantidadEntregas: Number(it.diasCondicionCompra ?? it.conditions ?? 1),
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
        <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); font-weight: 600; white-space: nowrap;">Cant. Entregas</th>
      </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (!data.items.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `<td colspan="4" style="padding: 6px; text-align: center; color: rgba(255,255,255,0.7);">Sin artículos</td>`;
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
          <td style="padding: 4px 6px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1); color: #ffffff; font-weight: 600;">${formatNum(it.cantidadXProv)}</td>
          <td style="padding: 4px 6px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);">${it.cantidadEntregas > 0 ? it.cantidadEntregas : '—'}</td>`;
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

  private refreshConditionsCell(): void {
    if (!this.itemsGridApi) return;
    this.itemsGridApi.forEachNode((node: any) => {
      if (node.data === this.selectedArticleRow) {
        this.itemsGridApi.refreshCells({ rowNodes: [node], columns: ['conditions'], force: true });
      }
    });
  }

  addNivel3Row(): void {
    if (!this.selectedArticleRow) return;
    const fechaBase = this.dateToIso(this.selectedArticleRow.datepostpone);
    // __touched: true → la fila vacía sí se persiste vía EntregasPendingService.flush
    // (Agregar es acto explícito, no scaffold default).
    this.nivel3Data = [...this.nivel3Data, { ...this.emptyNivel3Row(fechaBase), __touched: true }];
    // `conditions` NO se toca: representa el plan original. El delta visual se
    // calcula contra `entregasCount` (real). Subimos entregasCount localmente
    // para que el formatter refleje el cambio antes del Guardar.
    this.selectedArticleRow.entregasCount = Number(this.selectedArticleRow.entregasCount ?? 0) + 1;
    if (this.nivel3GridApi) this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
    this.refreshConditionsCell();
    this.hasNivel3Changes = true;
    const idDetail = Number(this.selectedArticleRow?.id);
    if (idDetail) {
      this.entregasPendingService.set(idDetail, this.nivel3Data);
      this.entregasPendingService.setVisible(idDetail, this.nivel3Data);
    }
    this.syncSelectedItemQuantityDelta();
  }

  async deleteNivel3Row(): Promise<void> {
    if (!this.selectedArticleRow) return;
    const lastRow = this.nivel3Data[this.nivel3Data.length - 1];
    if (lastRow?.close === true) {
      this.showInlineAlert('No puedes eliminar porque esta entrega ya está cerrada');
      return;
    }
    if (this.nivel3Data.length <= 1) {
      this.showInlineAlert('Debe quedar al menos una fila');
      return;
    }
    const result = await Swal.fire({
      title: '¿Está seguro que quiere borrar una entrega?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b71c1c',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!result.isConfirmed) return;

    const idDetail = Number(this.selectedArticleRow?.id);
    const removed = this.nivel3Data[this.nivel3Data.length - 1];

    // Si la última fila tenía id (era una entrega guardada), borrarla YA del backend.
    // El Eliminar es acción destructiva ya confirmada por el usuario — no se difiere a Guardar.
    if (removed?.id) {
      try {
        // Eliminar documentos asociados primero para evitar registros huérfanos
        const docs = await lastValueFrom(
          this.intandoutDocumentsService.getIntandoutDocumentsById(Number(removed.id), 'entrega')
        ).catch(() => []);
        if (Array.isArray(docs) && docs.length > 0) {
          await Promise.all(
            docs.map((doc: any) =>
              lastValueFrom(this.intandoutDocumentsService.deleteIntandoutDocuments(doc.id)).catch(() => {})
            )
          );
        }
        await lastValueFrom(this.entregaOcService.delete(Number(removed.id)));
      } catch {
        this.showInlineAlert('No se pudo borrar la entrega');
        return;
      }
      // Bajar también el baseline (lo que la BD ya tiene) y el originalEntregasCount.
      this.originalNivel3Data = this.originalNivel3Data.slice(0, -1);
      this.selectedArticleRow.__originalEntregasCount = Math.max(
        0, Number(this.selectedArticleRow.__originalEntregasCount ?? 0) - 1
      );
    }

    // Quitar la fila de la lista local.
    this.nivel3Data = this.nivel3Data.slice(0, -1);
    this.selectedArticleRow.entregasCount = Math.max(
      0, Number(this.selectedArticleRow.entregasCount ?? 0) - 1
    );
    this.selectedNivel3Row = null;
    if (this.nivel3GridApi) this.nivel3GridApi.setGridOption('rowData', this.nivel3Data);
    this.refreshConditionsCell();

    // Sincronizar pending si quedaban otras filas pendientes (no destruir pending de Agregar/edits).
    if (idDetail && this.entregasPendingService.getPendingRows(idDetail) !== undefined) {
      this.entregasPendingService.set(idDetail, this.nivel3Data);
    }
    // Mantener visible en sincronía para validación de fechas duplicadas al guardar.
    if (idDetail) this.entregasPendingService.setVisible(idDetail, this.nivel3Data);
    // hasNivel3Changes ya solo refleja Agregar/edits pendientes; si pending está vacío, no hay nada que guardar.
    this.hasNivel3Changes = idDetail
      ? this.entregasPendingService.getPendingRows(idDetail) !== undefined
      : this.hasNivel3Changes;
    this.syncSelectedItemQuantityDelta();
  }

  private showInlineAlert(msg: string): void {
    clearTimeout(this.alertTimeout);
    this.alertMessage = msg;
    this.alertTimeout = setTimeout(() => { this.alertMessage = ''; }, 2500);
  }

  private async loadItemsPdfCounts(): Promise<void> {
    const rowsWithId = this.itemsData.filter((r: any) => r.id && Number(r.conditions ?? 1) <= 1);
    if (!rowsWithId.length) return;
    const idOc = this.selectedOcRow?.id ?? null;
    await Promise.all(rowsWithId.map(async (row: any) => {
      try {
        // Step 1: resolve via entregas_oc (multi-entrega flow — id_entrega is set in entradas_molienda)
        const entregas = await lastValueFrom(this.entregaOcService.getByDetail(row.id)).catch(() => []);
        const entregaId = Array.isArray(entregas) && entregas.length > 0 ? entregas[0].id : null;

        if (entregaId != null) {
          row.__entregaId = entregaId;
          row.__docType = 'entrega';
          const docs = await lastValueFrom(
            this.intandoutDocumentsService.getIntandoutDocumentsById(entregaId, 'entrega')
          ).catch(() => []);
          row.pdfCount = Array.isArray(docs) ? docs.length : 0;
          return;
        }

        // Step 2: no entregas_oc — look up entradas_molienda by OC + material (single-entrega flow)
        // detailsreqoc.idSupplie === entradas_molienda.idMaterial
        const idSupplie = Number(row.idSupplie ?? 0);
        if (idOc && idSupplie) {
          const entradas = await lastValueFrom(
            this.entradaMoliendaService.getByOcAndMaterial(idOc, idSupplie)
          ).catch(() => []);
          const entrada = Array.isArray(entradas) && entradas.length > 0 ? entradas[0] : null;
          // Con entrega → key=idEntrega, type='entrega'. Sin entrega → key=entradas_molienda.id,
          // type='entrada_molienda' (namespace propio para evitar colisión de IDs).
          const hasEntrega = entrada?.idEntrega != null;
          const docKey = entrada ? (entrada.idEntrega ?? entrada.id ?? null) : null;
          const docType = hasEntrega ? 'entrega' : 'entrada_molienda';
          if (docKey) {
            row.__entregaId = docKey;
            row.__docType = docType;
            const docs = await lastValueFrom(
              this.intandoutDocumentsService.getIntandoutDocumentsById(docKey, docType)
            ).catch(() => []);
            row.pdfCount = Array.isArray(docs) ? docs.length : 0;
            return;
          }
        }

        row.__entregaId = null;
        row.__docType = 'entrega';
        row.pdfCount = 0;
      } catch {
        row.__entregaId = null;
        row.__docType = 'entrega';
        row.pdfCount = 0;
      }
    }));
    if (this.itemsGridApi && !this.itemsGridApi.isDestroyed()) {
      this.itemsGridApi.refreshCells({ columns: ['itemspdf'], force: true });
    }
  }

  private async loadItemsAlmacenData(): Promise<void> {
    const idOc = this.selectedOcRow?.id ?? null;
    if (!idOc || !this.itemsData.length) return;
    await Promise.all(this.itemsData.map(async (row: any) => {
      const idSupplie = Number(row.idSupplie ?? 0);
      if (!idSupplie) { row.cantidadEntradaAlmacen = null; row.fechaEntradaAlmacen = null; return; }
      try {
        const entradas = await lastValueFrom(
          this.entradaMoliendaService.getByOcAndMaterial(idOc, idSupplie)
        ).catch(() => []);
        const list = Array.isArray(entradas) ? entradas : [];
        const suma = list.reduce((acc: number, e: any) => acc + Number(e.cantidadEntrada ?? 0), 0);
        row.cantidadEntradaAlmacen = suma > 0 ? suma : null;
        // Fecha: la entrada más antigua con fechaRecepcion
        const fechas = list
          .filter((e: any) => e.fechaRecepcion)
          .map((e: any) => String(e.fechaRecepcion))
          .sort();
        const iso = fechas.length > 0 ? fechas[0].match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
        row.fechaEntradaAlmacen = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
      } catch {
        row.cantidadEntradaAlmacen = null;
        row.fechaEntradaAlmacen = null;
      }
    }));
    if (this.itemsGridApi && !this.itemsGridApi.isDestroyed()) {
      this.itemsGridApi.refreshCells({ columns: ['cantidadEntradaAlmacen', 'fechaEntradaAlmacen'], force: true });
    }
  }

  private syncSelectedItemQuantityDelta(): void {
    if (!this.selectedArticleRow || !this.itemsGridApi || this.itemsGridApi.isDestroyed()) return;
    const suma = this.nivel3Data.reduce((acc: number, r: any) => acc + Number(r.cantidadRecibir ?? 0), 0);
    this.selectedArticleRow.__sumaCantidadRecibir = suma > 0 ? suma : null;
    this.itemsGridApi.forEachNode((node: any) => {
      if (node.data === this.selectedArticleRow) {
        this.itemsGridApi.refreshCells({ rowNodes: [node], columns: ['quantity'], force: true });
      }
    });
  }

  private async loadItemsEntregasSums(): Promise<void> {
    const rowsWithId = this.itemsData.filter((r: any) => r.id);
    if (!rowsWithId.length) return;
    await Promise.all(rowsWithId.map(async (row: any) => {
      try {
        const entregas = await lastValueFrom(
          this.entregaOcService.getByDetail(row.id)
        ).catch(() => []);
        const list = Array.isArray(entregas) ? entregas : [];
        const suma = list.reduce((acc: number, e: any) => acc + Number(e.cantidadRecibir ?? 0), 0);
        row.__sumaCantidadRecibir = suma > 0 ? suma : null;
        // Estado bloqueado del ítem:
        //  - multi-entrega (conditions > 1): todas las entregas cerradas
        //  - single-entrega (conditions <= 1): la OC está cerrada (ocandreq.close)
        const conditions = Number(row.conditions ?? 1);
        row.__blocked = conditions > 1
          ? (list.length > 0 && list.every((e: any) => e.close === true))
          : this.selectedOcRow?.close === true;
      } catch {
        row.__sumaCantidadRecibir = null;
        row.__blocked = false;
      }
    }));
    if (this.itemsGridApi && !this.itemsGridApi.isDestroyed()) {
      // redrawRows re-evalúa rowClassRules (fila rosa) y re-renderiza candado/delta.
      this.itemsGridApi.redrawRows();
    }
  }

  private async loadOcsBlockedState(): Promise<void> {
    if (!this.rowData.length) return;
    await Promise.all(this.rowData.map(async (oc: any) => {
      try {
        const items: any[] = await lastValueFrom(this.ocAndReqsService.getReqItems(oc.id)).catch(() => []);
        const list = Array.isArray(items) ? items : [];
        if (list.length === 0) { oc.__allItemsBlocked = false; return; }
        const flags = await Promise.all(list.map(async (it: any) => {
          const conditions = Number(it.diasCondicionCompra ?? it.conditions ?? 1);
          if (conditions > 1) {
            const entregas: any[] = await lastValueFrom(this.entregaOcService.getByDetail(it.id)).catch(() => []);
            const elist = Array.isArray(entregas) ? entregas : [];
            return elist.length > 0 && elist.every((e: any) => e.close === true);
          }
          return oc.close === true;
        }));
        oc.__allItemsBlocked = flags.length > 0 && flags.every((b) => b === true);
      } catch {
        oc.__allItemsBlocked = false;
      }
    }));
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.refreshCells({ columns: ['folio'], force: true });
    }
  }

  private async loadNivel3EntradaCantidades(): Promise<void> {
    const rowsWithId = this.nivel3Data.filter((r: any) => r.id);
    if (!rowsWithId.length) return;
    const idMaterial = Number(this.selectedArticleRow?.idSupplie ?? 0);
    await Promise.all(rowsWithId.map(async (row: any) => {
      try {
        const entradas = await lastValueFrom(
          this.entradaMoliendaService.getByEntregaAndMaterial(row.id, idMaterial)
        ).catch(() => []);
        const list = Array.isArray(entradas) ? entradas : [];

        const suma = list.reduce((acc: number, e: any) => acc + Number(e.cantidadEntrada ?? 0), 0);
        row.cantidadEntradaAlmacen = suma > 0 ? suma : null;

        // Si la BD no tiene fechaEntradaAlmacen guardada aún, la calculamos
        // dinámicamente desde la primera entrada con fechaRecepcion.
        if (!row.fechaEntradaAlmacen) {
          const conFecha = list.find((e: any) => e.fechaRecepcion);
          if (conFecha) {
            const iso = String(conFecha.fechaRecepcion).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (iso) row.fechaEntradaAlmacen = `${iso[1]}-${iso[2]}-${iso[3]}`;
          }
        }
      } catch {
        row.cantidadEntradaAlmacen = null;
      }
    }));
    if (this.nivel3GridApi && !this.nivel3GridApi.isDestroyed()) {
      this.nivel3GridApi.refreshCells({ columns: ['cantidadEntradaAlmacen', 'fechaEntradaAlmacen', 'pdf'], force: true });
    }
  }

  private async loadNivel3PdfCounts(): Promise<void> {
    const rowsWithId = this.nivel3Data.filter((r: any) => r.id);
    if (!rowsWithId.length) return;
    await Promise.all(rowsWithId.map(async (row: any) => {
      try {
        const docs = await lastValueFrom(
          this.intandoutDocumentsService.getIntandoutDocumentsById(row.id, 'entrega')
        );
        row.pdfCount = Array.isArray(docs) ? docs.length : 0;
      } catch {
        row.pdfCount = 0;
      }
    }));
    if (this.nivel3GridApi && !this.nivel3GridApi.isDestroyed()) {
      this.nivel3GridApi.refreshCells({ columns: ['pdf'], force: true });
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.alertTimeout);
    this.hideOcTooltip();
    this.entregasPendingSub?.unsubscribe();
    this.conditionsPendingSub?.unsubscribe();
    this.countSub?.unsubscribe();
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
          typeoc: it.typeoc || it.typeOc || '',
          datepostponeConfirmada: it.datepostponeConfirmada ?? false,
          __originalDatepostpone: (it.datepostpone || '').substring(0, 10),
          __pendingDateSave: false,
        }));
        this.originalItemsData = JSON.parse(JSON.stringify(this.itemsData));
        this.changedItemIds.clear();
        this.hasLocalChanges = false;
        if (this.itemsGridApi) {
          this.itemsGridApi.setGridOption('rowData', this.itemsData);
        }
        this.loadItemsPdfCounts();
        this.loadItemsEntregasSums();
        this.loadItemsAlmacenData();
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
