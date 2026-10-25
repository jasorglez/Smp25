import { PdfReportViewerComponent } from 'app/shared/pdf-report-viewer/pdf-report-viewer.component';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';
﻿import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { pdfPreviewUrl } from 'app/helpers/pdf-viewer';
import { hasPersistedMasterId } from 'app/helpers/master-detail-guard';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CotizacionesService, CotizacionItem, ESTADOS_COTIZACION, familiasDeCotizacion } from 'app/services/cotizaciones.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { StoragesService } from 'app/services/storages.service';
import { lastValueFrom } from 'rxjs';
import { TrackingService } from 'app/services/tracking.service';
import { PdfShareService } from 'app/services/pdf-share.service';
import { AdministrationService } from 'app/services/administration.service';
import Swal from 'sweetalert2';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const LBLUE = '#e8f0f8';
const GRAY  = '#555555';

const textoPdf = (value: unknown): string =>
  String(value ?? '').replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ').trim();

@Component({
  selector: 'app-detalle-items-cotizacion',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PdfReportViewerComponent, PdfShareButtonsComponent],
  template: `
    <div class="detail-container">

      <!-- ══ ITEMS MODE ══ -->
      <ng-container *ngIf="mode === 'items'">
        <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span class="fw-semibold small">
            <i class="bi bi-person-fill me-1"></i>{{ cotizacion?.nombreProspecto }}
          </span>
          <span class="badge" [ngClass]="'bg-' + estadoColor(cotizacion?.estado)">
            {{ estadoLabel(cotizacion?.estado) }}
          </span>
          <span class="badge bg-dark ms-1">
            Total MXN: {{ total | currency:'MXN':'symbol':'1.2-2' }}
          </span>
          <span class="badge bg-primary ms-1" *ngIf="tipoCambio > 0">
            Total USD: {{ totalDolares | currency:'USD':'symbol':'1.2-2' }}
          </span>
          <span class="badge bg-secondary ms-1" *ngIf="!tipoCambio">Total USD: pendiente de tipo de cambio</span>
          <span class="small text-muted">Tipo de cambio: {{ tipoCambio > 0 ? (tipoCambio | number:'1.4-4') : 'captúralo antes de Familia' }} MXN/USD</span>

          <div class="ms-auto d-flex gap-1">
            <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi || !masterSaved" title="Agregar item">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="save()" [disabled]="!hasChanges || !masterSaved" title="Guardar">
              <i class="bi bi-floppy"></i>
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                    *ngIf="hasChanges">
                <span class="visually-hidden">Cambios sin guardar</span>
              </span>
            </button>
            <button class="btn btn-sm btn-warning" (click)="revert()" title="Deshacer">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteRow()" [disabled]="!selectedRow" title="Eliminar fila">
              <i class="bi bi-trash"></i>
            </button>

            <div class="vr mx-1"></div>

            <select class="form-select form-select-sm w-auto" [(ngModel)]="cotizacion.estado"
                    (change)="cambiarEstado()">
              <option *ngFor="let e of estados" [value]="e.value">{{ e.label }}</option>
            </select>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cerrarDetalle()"
                    title="Cerrar detalle y regresar a cotizaciones" aria-label="Cerrar detalle y regresar a cotizaciones">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div *ngIf="!masterSaved" class="alert alert-info py-1 px-2 mb-2 small">
          <i class="bi bi-info-circle me-1"></i> Guarda primero la cotización para habilitar sus partidas.
        </div>
        <div class="d-flex align-items-center justify-content-end gap-2 mb-1">
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="mostrarColumna('nombreMaterial')">← Material</button>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="mostrarColumna('dolares')">Dólares →</button>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [defaultColDef]="defaultColDef"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          (cellEditingStopped)="onCellEditingStopped($event)"
          style="height:440px; width:100%">
        </ag-grid-angular>
      </ng-container>

      <!-- ══ PDF MODE ══ -->
      <ng-container *ngIf="mode === 'pdf'">
        <div class="d-flex align-items-center gap-2 mb-2">
          <button class="btn btn-sm btn-outline-secondary" (click)="switchToItems()">
            <i class="bi bi-arrow-left"></i> Items
          </button>
          <span class="fw-semibold small">
            <i class="bi bi-file-earmark-pdf-fill me-1 text-danger"></i>
            {{ cotizacion?.numCotizacion ? 'Cotización ' + cotizacion.numCotizacion : 'Cotización' }}
            — {{ cotizacion?.nombreProspecto }}
          </span>
          <div *ngIf="isLoadingPdf" class="spinner-border spinner-border-sm text-danger ms-2"></div>

          <div class="ms-auto d-flex gap-2 align-items-center flex-wrap">
            <!-- Descargar (funciona en tablets donde el iframe no carga) -->
            <button class="btn btn-sm btn-success"
                    (click)="descargarPdf()"
                    [disabled]="isLoadingPdf || !_pdfBlob"
                    title="Descargar PDF — recomendado en tablets">
              <i class="bi bi-download me-1"></i> Descargar
            </button>

            <app-pdf-share-buttons
              *ngIf="_pdfBlob"
              [getPdfBlob]="getPdfBlobFn"
              [fileName]="'Cotizacion_' + (cotizacion?.numCotizacion || cotizacion?.id) + '.pdf'"
              [subject]="'Cotización ' + (cotizacion?.numCotizacion || '') + ' — ' + (cotizacion?.empresaProspecto || cotizacion?.nombreProspecto || '')">
            </app-pdf-share-buttons>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cerrarDetalle()"
                    title="Cerrar detalle y regresar a cotizaciones" aria-label="Cerrar detalle y regresar a cotizaciones">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <!-- Aviso para tablet / móvil cuando el iframe no se muestra -->
        <div *ngIf="pdfUrl && !isLoadingPdf"
             class="alert alert-warning py-1 px-2 mb-1 small d-flex align-items-center gap-2">
          <i class="bi bi-tablet"></i>
          <span>Si no ves el PDF usa el botón <strong>Descargar</strong> — funciona en todos los dispositivos.</span>
        </div>

        <div class="pdf-frame-wrap">
          <app-pdf-report-viewer *ngIf="pdfUrl && !isLoadingPdf" [sourceUrl]="pdfUrl" title="Cotización" fileName="Cotizacion.pdf" [showShare]="false"></app-pdf-report-viewer>
          <div *ngIf="isLoadingPdf" class="pdf-generating-state" role="status" aria-live="polite">
            <span><i class="bi bi-hourglass-split me-2"></i> Generando PDF...</span>
            <div class="pdf-generating-progress" aria-hidden="true"><div></div></div>
          </div>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .detail-container {
      padding: 8px 12px;
      background-color: #f0f8ff;
      border-top: 2px solid #0d6efd;
    }
    .pdf-frame-wrap {
      height: 82vh;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      overflow: hidden;   /* el scroll lo maneja el iframe internamente */
    }
    .pdf-generating-state { display: flex; height: 100%; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: #6c757d; }
    .pdf-generating-progress { width: min(320px, 70%); height: 6px; overflow: hidden; border-radius: 999px; background: #dee2e6; }
    .pdf-generating-progress > div { width: 40%; height: 100%; border-radius: inherit; background: #0d6efd; animation: pdf-generating-progress 1.2s ease-in-out infinite; }
    @keyframes pdf-generating-progress { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
    .autocomplete-list {
      position: absolute;
      top: 100%; left: 0; right: 0;
      background: #fff;
      border: 1px solid #ced4da;
      border-radius: 0 0 4px 4px;
      list-style: none;
      margin: 0; padding: 0;
      z-index: 1070;
      max-height: 180px;
      overflow-y: auto;
      box-shadow: 0 4px 8px rgba(0,0,0,.15);
    }
    .autocomplete-list li {
      padding: 6px 12px;
      cursor: pointer;
      font-size: 13px;
    }
    .autocomplete-list li:hover { background: #e8f0f8; }
  `]
})
export class DetalleItemsCotizacionComponent implements ICellRendererAngularComp {
  private svc             = inject(CotizacionesService);
  private matSvc          = inject(MaterialsService);
  private rootSvc         = inject(RootService);
  private b64Svc          = inject(Base64EncodeService);
  private storageSvc      = inject(StoragesService);
  private sanitizer       = inject(DomSanitizer);
  private signalsSvc      = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private pdfShareSvc     = inject(PdfShareService);
  private administrationService = inject(AdministrationService);

  private params!: ICellRendererParams;
  private context: any;
  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  cotizacion: any  = null;
  get masterSaved(): boolean {
    return hasPersistedMasterId(this.cotizacion?.id, this.cotizacion?.__isNew);
  }
  tipoCambio = 0;
  private tipoCambioRequest: Promise<void> | null = null;
  rowData: CotizacionItem[]   = [];
  originalData: CotizacionItem[] = [];
  selectedRow: CotizacionItem | null = null;
  hasChanges  = false;
  materiales: any[] = [];
  estados = ESTADOS_COTIZACION;

  mode: 'items' | 'pdf' = 'items';
  pdfUrl: SafeResourceUrl | null = null;
  isLoadingPdf   = false;
  isSendingEmail = false;
  isSendingTelegram = false;
  isSendingWhatsapp = false;
  private originalPdfUrl: string | null = null;
  _lastDocDef: any = null;
  _pdfBlob: Blob | null = null;   // blob renderizado — se reutiliza para download/WhatsApp
  readonly getPdfBlobFn = (): Promise<Blob> => this.getPdfBlob();

  // ── Modal correo ──────────────────────────────────────────────────────────
  showEmailModal  = false;
  emailPara       = '';
  emailCc         = '';
  emailHistorial: string[] = [];
  sugerenciasPara: string[] = [];
  sugerenciasCc:   string[] = [];

  get total() { return this.rowData.reduce((s, i) => s + (i.subtotal ?? 0), 0); }
  get totalDolares(): number | null {
    return this.tipoCambio > 0
      ? this.rowData.reduce((sum, item) => sum + Math.round((Number(item.dolares) || 0) * 100), 0) / 100
      : null;
  }

  // ── Enter-nav ─────────────────────────────────────────────────────────────
  private editableColumnOrder = ['nombreMaterial', 'unidad', 'cantidad', 'precio', 'dolares'];
  private enterPressed = false;

  defaultColDef: ColDef = {
    sortable: true, resizable: true, minWidth: 80,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  // ── ColDefs como propiedad fija — NO getter, NO reconstrucción ─────────────
  // cellEditorParams es función: evalúa this.materiales en tiempo de edición
  colDefs: ColDef[] = [
    {
      field: 'nombreMaterial', headerName: 'Material', flex: 1, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.materiales.map(m => m.description) }),
      tooltipValueGetter: (p) => p.value ?? '',
      valueSetter: (params) => {
        const mat = this.materiales.find(m => m.description === params.newValue);
        if (mat) {
          params.data.nombreMaterial = mat.description;
          params.data.idMaterial     = mat.id;
          params.data.unidad         = mat.measure ?? '';
          params.data.precio         = mat.precioVenta ?? 0;
          params.data.subtotal       = (params.data.cantidad ?? 0) * params.data.precio;
        } else {
          params.data.nombreMaterial = params.newValue;
        }
        return true;
      },
    },
    { field: 'unidad',   headerName: 'Unidad',    width: 90,  editable: true },
    { field: 'cantidad', headerName: 'Cantidad',  width: 100, editable: true, type: 'numericColumn' },
    {
      field: 'precio', headerName: 'Precio U.', width: 120, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toFixed(2)}` : '',
    },
    {
      field: 'subtotal', headerName: 'Subtotal', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toFixed(2)}` : '',
      cellStyle: { fontWeight: 'bold', backgroundColor: '#e8f5e9' },
    },
    {
      field: 'dolares', headerName: 'Dólares (USD)', width: 145, editable: true, type: 'numericColumn',
      cellDataType: 'number',
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2 },
      valueGetter: p => p.data?.dolaresManual || this.tipoCambio > 0 ? p.data?.dolares : null,
      valueSetter: p => {
        if (p.newValue == null || String(p.newValue).trim() === '') {
          p.data.dolaresManual = false;
          this.calcularDolares(p.data);
          return true;
        }
        const value = Number(p.newValue);
        if (!Number.isFinite(value) || value < 0) return false;
        p.data.dolares = Math.round(value * 100) / 100;
        p.data.dolaresManual = true;
        return true;
      },
      valueFormatter: (p) => p.value == null ? '—' : `US$${Number(p.value).toFixed(2)}`,
      cellStyle: p => p.data?.dolaresManual ? { backgroundColor: '#fff3cd' } : null,
      headerTooltip: 'Se calcula con el tipo de cambio. Puedes editarlo; borra la celda para volver al cálculo automático.',
    },
  ];

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 30,
    rowSelection: 'single',
    tooltipShowDelay: 300,
    tooltipHideDelay: 8000,
    alwaysShowHorizontalScroll: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowClicked: (e: any) => { this.selectedRow = e.data; },
  };

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  mostrarColumna(field: string): void {
    this.gridApi?.ensureColumnVisible(field, field === 'dolares' ? 'end' : 'start');
  }

  aplicarTipoCambio(rate: number): void {
    if (!(rate > 0)) return;
    this.tipoCambio = rate;
    this.cotizacion.tipoCambio = rate;
    this.aplicarConversionDolares();
    this.updateCountInParent();
  }

  actualizarFamilias(familias: string[]): void {
    this.cotizacion.familias = [...familias];
    this.cotizacion.familia = familias.length === 1 ? familias[0] : '';
    if (this.mode === 'items') this.cargarMateriales();
  }

  actualizarMaestroGuardado(cotizacion: any): void {
    if (this.cotizacion?.numCotizacion !== cotizacion?.numCotizacion) return;
    this.cotizacion = { ...this.cotizacion, ...cotizacion };
  }

  // ── ICellRendererAngularComp ───────────────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.params     = params;
    this.context    = params.context;
    this.context?.registrarDetalle?.(this);
    this.cotizacion = { ...params.data };
    this.tipoCambio = Number(this.cotizacion.tipoCambio) || 0;
    this.mode       = params.data?.__mode ?? 'items';
    void this.cargarTipoCambio();

    if (this.mode === 'pdf') {
      this.generarPdf();
    } else {
      this.cargarMateriales();
      this.cargarItems();
    }
  }

  // CRÍTICO: retornar true para que AG Grid NO destruya/recree el componente
  // cada vez que el padre actualiza rowData (p.ej. suscripción Firestore)
  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    const familias = familiasDeCotizacion(params.data);
    if (familias.join('\u0000') !== familiasDeCotizacion(this.cotizacion).join('\u0000')) {
      this.actualizarFamilias(familias);
    }
    const rate = Number(params.data?.tipoCambio) || 0;
    if (rate > 0 && rate !== this.tipoCambio) {
      this.aplicarTipoCambio(rate);
    }
    const newMode = params.data?.__mode ?? 'items';
    if (newMode !== this.mode) {
      this.gridApi?.stopEditing();
      this.mode = newMode;
      if (newMode === 'pdf') {
        this.pdfUrl = null;
        void this.generarPdf();
      } else {
        if (!this.materiales.length) this.cargarMateriales();
        if (!this.rowData.length) this.cargarItems();
      }
    }
    if (params.data?.estado && params.data.estado !== this.cotizacion?.estado) {
      this.cotizacion = { ...params.data };
    }
    return true;
  }

  // ── Datos ─────────────────────────────────────────────────────────────────

  cargarMateriales() {
    const idCompany = this.context?.idCompany;
    if (!idCompany) return;
    this.matSvc.getMaterialsForApu(idCompany).subscribe({
      next: (data: any[]) => {
        // Sin familias seleccionadas se muestran todos los materiales.
        const familias = familiasDeCotizacion(this.cotizacion);
        const filtered = familias.length
          ? data.filter(i => familias.includes(i.familia ?? ''))
          : data;
        this.materiales = filtered.map(i => ({
          id:          i.id,
          description: i.description ?? '',
          measure:     i.measure ?? '',
          familia:     i.familia ?? '',
          precioVenta: i.ventaMN ?? 0,
        }));
      },
      error: () => { this.materiales = []; },
    });
  }

  async cargarItems() {
    if (!this.cotizacion?.id) { this.rowData = []; return; }
    const data = await this.svc.getItems(this.cotizacion.id);
    this.rowData      = data.map(item => ({ ...item, dolares: item.dolares ?? 0 }));
    this.aplicarConversionDolares();
    this.originalData = JSON.parse(JSON.stringify(this.rowData));
    this.hasChanges   = false;
    this.updateCountInParent();
  }

  onCellEditingStopped(event: any) {
    const colId = event.column.getColId();
    if (colId === 'cantidad' || colId === 'precio') {
      event.data.subtotal = (event.data.cantidad ?? 0) * (event.data.precio ?? 0);
      this.calcularDolares(event.data);
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['subtotal', 'dolares'] });
    } else if (colId === 'nombreMaterial') {
      this.calcularDolares(event.data);
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['unidad', 'precio', 'subtotal', 'dolares'] });
    }
    this.hasChanges = true;

    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  private cargarTipoCambio(): Promise<void> {
    if (this.tipoCambio > 0) return Promise.resolve();
    if (this.tipoCambioRequest) return this.tipoCambioRequest;
    this.tipoCambioRequest = (async () => {
      try {
        const result: any = await lastValueFrom(this.administrationService.getTodayExchangeRate());
        const rate = Number(result?.rate ?? result?.Rate ?? result?.tipoCambio ?? result?.exchangeRate);
        if (!(rate > 0)) {
          console.warn('[Cotizaciones] La API no devolvió un tipo de cambio válido:', result);
          return;
        }
        if (this.tipoCambio > 0) return;
        this.tipoCambio = rate;
        this.cotizacion.tipoCambio = rate;
        if (this.cotizacion?.id) {
          const items = await this.svc.getItems(this.cotizacion.id);
          const totalDolares = items.reduce((sum, item) => sum + (item.dolaresManual
            ? Number(item.dolares ?? 0)
            : Number((Number(item.subtotal ?? 0) / rate).toFixed(2))), 0);
          this.cotizacion.totalDolares = Math.round(totalDolares * 100) / 100;
          await this.svc.actualizarCotizacion(this.cotizacion.id, {
            tipoCambio: rate,
            totalDolares: this.cotizacion.totalDolares,
          });
        }
        this.aplicarConversionDolares();
        this.gridApi?.refreshCells({ force: true });
        this.updateCountInParent();
      } catch (error) {
        console.error('[Cotizaciones] No se pudo obtener el tipo de cambio FIX del día:', error);
      }
    })().finally(() => { this.tipoCambioRequest = null; });
    return this.tipoCambioRequest;
  }

  private calcularDolares(item: any): void {
    if (this.tipoCambio > 0 && !item.dolaresManual) item.dolares = Number((Number(item.subtotal ?? 0) / this.tipoCambio).toFixed(2));
  }

  private aplicarConversionDolares(): void {
    if (!(this.tipoCambio > 0)) return;
    this.rowData.forEach(item => this.calcularDolares(item));
    this.gridApi?.refreshCells({ columns: ['dolares'], force: true });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  add() {
    if (!this.masterSaved) {
      Swal.fire('Guarda primero la cotización', 'Guarda el maestro antes de agregar sus partidas.', 'warning');
      return;
    }
    this.trackingService.addLog(this.trackingService.getnameComp(), `Agregó ítem a cotización`, 'Ventas', this.trackingService.getEmail());
    const nuevo: CotizacionItem = {
      idMaterial: 0, nombreMaterial: '', unidad: '',
      cantidad: 1, precio: 0, subtotal: 0, dolares: 0, __isNew: true,
    };
    this.rowData = [...this.rowData, nuevo];
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.startEditingCell({ rowIndex: this.rowData.length - 1, colKey: 'nombreMaterial' });
    }, 50);
  }

  async save(): Promise<boolean> {
    if (!this.masterSaved) {
      Swal.fire('Guarda primero la cotización', 'Guarda el maestro antes de guardar sus partidas.', 'warning');
      return false;
    }
    this.gridApi?.stopEditing();
    this.trackingService.addLog(this.trackingService.getnameComp(), `Guardó ítems de cotización`, 'Ventas', this.trackingService.getEmail());
    try {
      await this.svc.guardarItems(this.cotizacion.id, this.rowData);
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges   = false;
      this.updateCountInParent();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado', showConfirmButton: false, timer: 2000, timerProgressBar: true });
      return true;
    } catch (e: any) {
      console.error('[Cotizaciones] Error guardando items:', e);
      Swal.fire('Error', e?.message ?? 'No se pudo guardar.', 'error');
      return false;
    }
  }

  async guardarCambiosPendientes(): Promise<boolean> {
    this.gridApi?.stopEditing();
    return !this.hasChanges || this.save();
  }

  async cerrarDetalle(): Promise<void> {
    if (this.hasChanges) {
      const result = await Swal.fire({
        title: 'Cambios sin guardar',
        text: '¿Deseas guardar los cambios antes de regresar a las cotizaciones?',
        icon: 'warning',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Guardar y cerrar',
        denyButtonText: 'Cerrar sin guardar',
        cancelButtonText: 'Seguir editando',
      });
      if (result.isDismissed) return;
      if (result.isConfirmed && !(await this.guardarCambiosPendientes())) return;
      if (result.isDenied) this.revert();
    }
    this.context?.cerrarDetalle?.(this.params?.node, this);
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasChanges = false;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    const res = await Swal.fire({
      title: '¿Eliminar ítem?',
      text: `"${this.selectedRow.nombreMaterial || 'Sin nombre'}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    this.rowData = this.rowData.filter(r => r !== this.selectedRow);
    this.selectedRow = null;
    this.hasChanges  = true;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async cambiarEstado() {
    if (!this.cotizacion?.id) return;
    try {
      await this.svc.actualizarCotizacion(this.cotizacion.id, { estado: this.cotizacion.estado });
      if (this.params?.node) {
        this.params.node.data.estado = this.cotizacion.estado;
        this.params.api?.refreshCells({ rowNodes: [this.params.node], columns: ['estado'], force: true });
      }
    } catch { }
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  switchToItems() {
    this.mode = 'items';
    if (this.originalPdfUrl) { URL.revokeObjectURL(this.originalPdfUrl); this.originalPdfUrl = null; }
    this.pdfUrl = null;
    if (!this.materiales.length) this.cargarMateriales();
    if (!this.rowData.length) this.cargarItems();
  }

  // ── Modal correo — renderizado en document.body para escapar transform de AG Grid ──
  async enviarPorTelegram(): Promise<void> {
    if (!this._pdfBlob || this.isLoadingPdf || this.isSendingTelegram) return;
    this.isSendingTelegram = true;
    try {
      await this.pdfShareSvc.sendByTelegram({
        pdfBlob: this._pdfBlob,
        fileName: `${this.cotizacion?.numCotizacion || 'cotizacion'}.pdf`,
        caption: `Cotización ${this.cotizacion?.numCotizacion ?? ''} — ${this.cotizacion?.empresaProspecto || this.cotizacion?.nombreProspecto || ''}`,
      });
    } catch (error) {
      console.error('Error al preparar la cotización para Telegram:', error);
      Swal.fire('Error', 'No se pudo preparar el PDF para Telegram. Intenta nuevamente.', 'error');
    } finally {
      this.isSendingTelegram = false;
    }
  }

  private emailModalEl: HTMLElement | null = null;

  abrirModalCorreo() {
    if (this.isLoadingPdf || !this._pdfBlob) return;
    this.emailPara      = this.signalsSvc.profile.emailUser() ?? '';
    this.emailCc        = '';

    this.removeEmailModal();

    const asunto = `Cotización ${this.cotizacion?.numCotizacion ?? ''} — ${this.cotizacion?.empresaProspecto || this.cotizacion?.nombreProspecto || ''}`;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1055;';
    backdrop.onclick = () => this.cerrarModalCorreo();

    // Card
    const card = document.createElement('div');
    card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:480px;max-width:95vw;background:#fff;border-radius:8px;z-index:1056;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.25);font-family:inherit;';

    card.innerHTML = `
      <div style="background:#1a5a9a;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:8px;">
        <i class="bi bi-envelope-fill"></i>
        <span style="font-weight:600;">Enviar cotización por correo</span>
        <button id="em-close" style="margin-left:auto;background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="padding:16px;">
        <div style="margin-bottom:12px;">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px;">Para *</label>
          <input id="em-para" type="email" required class="form-control form-control-sm" placeholder="destinatario@empresa.com" autocomplete="off">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px;">CC</label>
          <input id="em-cc" type="email" class="form-control form-control-sm" placeholder="copia@empresa.com (opcional)" autocomplete="off">
        </div>
        <div style="margin-bottom:4px;">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px;">Asunto</label>
          <input id="em-asunto" class="form-control form-control-sm" style="background:#f8f9fa;" readonly>
        </div>
      </div>
      <div style="padding:10px 16px;background:#f8f9fa;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #dee2e6;">
        <button id="em-cancel" class="btn btn-sm btn-secondary">Cancelar</button>
        <button id="em-send"   class="btn btn-sm btn-primary"><i class="bi bi-send me-1"></i>Enviar</button>
      </div>
    `;
    (card.querySelector('#em-para') as HTMLInputElement).value = this.emailPara;
    (card.querySelector('#em-asunto') as HTMLInputElement).value = asunto;

    const wrap = document.createElement('div');
    wrap.appendChild(backdrop);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    this.emailModalEl = wrap;

    // Eventos
    card.querySelector('#em-close')!.addEventListener('click',  () => this.cerrarModalCorreo());
    card.querySelector('#em-cancel')!.addEventListener('click', () => this.cerrarModalCorreo());
    card.querySelector('#em-send')!.addEventListener('click', async () => {
      const paraInput = card.querySelector('#em-para') as HTMLInputElement;
      const ccInput = card.querySelector('#em-cc') as HTMLInputElement;
      const para = paraInput.value.trim();
      const cc = ccInput.value.trim();
      if (!para || !paraInput.checkValidity()) { paraInput.reportValidity(); return; }
      if (cc && !ccInput.checkValidity()) { ccInput.reportValidity(); return; }
      this.emailPara = para;
      this.emailCc   = cc;
      const sendButton = card.querySelector('#em-send') as HTMLButtonElement;
      sendButton.disabled = true;
      sendButton.textContent = 'Enviando...';
      await this.enviarPorCorreo();
      if (this.emailModalEl === wrap) {
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
      }
    });

    setTimeout(() => (document.getElementById('em-para') as HTMLInputElement)?.focus(), 50);
  }

  cerrarModalCorreo() {
    this.showEmailModal = false;
    this.removeEmailModal();
  }

  private removeEmailModal() {
    if (this.emailModalEl) {
      document.body.removeChild(this.emailModalEl);
      this.emailModalEl = null;
    }
  }

  filtrarSugerencias(valor: string, campo: 'para' | 'cc') {
    const term = valor.trim().toLowerCase();
    const lista = term.length >= 2
      ? this.emailHistorial.filter(e => e.includes(term))
      : [];
    if (campo === 'para') this.sugerenciasPara = lista;
    else                  this.sugerenciasCc   = lista;
  }

  seleccionarSugerencia(email: string, campo: 'para' | 'cc') {
    if (campo === 'para') { this.emailPara = email; this.sugerenciasPara = []; }
    else                  { this.emailCc   = email; this.sugerenciasCc   = []; }
  }

  limpiarSugerencias(campo: 'para' | 'cc') {
    setTimeout(() => {
      if (campo === 'para') this.sugerenciasPara = [];
      else                  this.sugerenciasCc   = [];
    }, 150);
  }

  async enviarPorCorreo(): Promise<void> {
    if (!this.emailPara?.trim() || this.isSendingEmail) return;
    if (this.isLoadingPdf || !this._pdfBlob) {
      Swal.fire('PDF pendiente', 'Espera a que termine de generarse la vista previa.', 'warning');
      return;
    }

    this.isSendingEmail = true;
    try {
      await this.svc.enviarPorCorreo(
        this.emailPara,
        this.cotizacion,
        this._pdfBlob,
        this.signalsSvc.profile.emailUser() ?? undefined,
        this.emailCc?.trim() || undefined,
      );

      const idCompany = this.context?.idCompany;
      if (idCompany) {
        try {
          const nuevos = [this.emailPara, this.emailCc].filter(Boolean);
          await this.svc.guardarEmailHistorial(idCompany, nuevos);
        } catch (error) {
          console.warn('[Cotizaciones] El correo se puso en cola, pero no se guardó el historial:', error);
        }
      }

      this.cerrarModalCorreo();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Correo preparado para envío', showConfirmButton: false, timer: 2500, timerProgressBar: true });
    } catch (error: any) {
      console.error('[Cotizaciones] Error enviando correo:', error);
      Swal.fire('Error al enviar', error?.message || 'No se pudo preparar el correo. Intenta nuevamente.', 'error');
    } finally {
      this.isSendingEmail = false;
    }
  }

  async abrirModalWhatsapp() {
    const result = await Swal.fire({
      title: 'Enviar por WhatsApp',
      input: 'text',
      inputLabel: 'Número destino',
      inputPlaceholder: 'Ejemplo: 525512345678',
      inputValue: '',
      showCancelButton: true,
      confirmButtonText: 'Preparar WhatsApp',
      cancelButtonText: 'Cancelar',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
      },
      inputValidator: (value) => {
        const normalized = this.normalizeWhatsappNumber(value);
        if (!normalized) {
          return 'Escribe un número válido con lada, por ejemplo 525512345678.';
        }
        return null;
      },
      footer: 'Escribe el número con clave de país. Si capturas 10 dígitos, se asumirá México (+52).',
    });

    if (!result.isConfirmed) return;
    await this.enviarPorWhatsapp(result.value ?? '');
  }

  async enviarPorWhatsapp(rawPhone: string) {
    const phone = this.normalizeWhatsappNumber(rawPhone);
    if (!phone) return;
    if (!this._lastDocDef) {
      Swal.fire('Error', 'Primero genera el PDF de la cotización.', 'error');
      return;
    }

    this.isSendingWhatsapp = true;
    try {
      const pdfBlob = await this.getPdfBlob();
      const fileName = `${this.cotizacion?.numCotizacion ?? 'Cotizacion'}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const pdfUrl = await this.storageSvc.uploadFile(
        pdfFile,
        `pdf/cotizaciones/${Date.now()}_${fileName}`
      );

      const prospecto = this.cotizacion?.empresaProspecto || this.cotizacion?.nombreProspecto || 'cliente';
      const mensaje =
        `Hola, te comparto la cotización ${this.cotizacion?.numCotizacion ?? ''} para ${prospecto}. ` +
        `Puedes descargar el PDF aquí: ${pdfUrl}`;

      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');

      Swal.fire({
        icon: 'success',
        title: 'WhatsApp preparado',
        text: `Se abrió WhatsApp para ${phone}.`,
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error('[Cotizaciones] Error preparando WhatsApp:', e);
      Swal.fire('Error', 'No se pudo preparar el envío por WhatsApp.', 'error');
    } finally {
      this.isSendingWhatsapp = false;
    }
  }

  async generarPdf() {
    if (!this.cotizacion?.id) return;
    this.isLoadingPdf = true;
    this._pdfBlob = null;
    this._lastDocDef = null;
    this.pdfUrl = null;
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
    try {
      this.gridApi?.stopEditing();
      if (this.hasChanges && !(await this.save())) {
        this.isLoadingPdf = false;
        return;
      }
      await this.cargarTipoCambio();
      if (!(this.tipoCambio > 0)) {
        this.isLoadingPdf = false;
        Swal.fire('Tipo de cambio pendiente', 'Captura el tipo de cambio en la columna anterior a Familia.', 'warning');
        return;
      }
      const idRoot = this.context?.idCompany;
      const [rootData, loadedItems, cfg] = await Promise.all([
        lastValueFrom(this.rootSvc.getRootbyId(idRoot)) as Promise<any>,
        this.svc.getItems(this.cotizacion.id),
        this.svc.getConfig(idRoot),
      ]);
      const items = loadedItems.map(item => ({
        ...item,
        dolares: item.dolaresManual ? Number(item.dolares ?? 0) : this.tipoCambio > 0
          ? Number((Number(item.subtotal ?? (Number(item.cantidad ?? 0) * Number(item.precio ?? 0))) / this.tipoCambio).toFixed(2))
          : Number(item.dolares ?? 0),
      }));

      const tryB64 = async (url: string) => {
        try { return await this.b64Svc.convertImageToBase64(url); } catch { return null; }
      };
      const logoB64     = rootData?.picture  ? await tryB64(rootData.picture)  : null;
      const logo2B64    = rootData?.picture2 ? await tryB64(rootData.picture2) : logoB64;
      const signatureUrl = this.signalsSvc.profile.signatureUser();
      const signatureB64 = signatureUrl ? await tryB64(signatureUrl) : null;

      const cot = this.cotizacion;
      const fecha = cot.fecha?.toDate ? cot.fecha.toDate() : new Date();
      const fechaStr = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
      const lugarFecha = `${(cot.lugar ?? '').toUpperCase()}, A ${fechaStr}`;
      const companyName = (rootData?.name ?? 'EMPRESA').toUpperCase();

      const header: any = {
        columns: [
          logoB64  ? { image: logoB64,  width: 80 } : { text: '', width: 80 },
          {
            stack: [
              { text: companyName, fontSize: 11, bold: true, color: NAVY, alignment: 'center' },
              { text: 'COTIZACIÓN', fontSize: 9, bold: true, color: BLUE, alignment: 'center', margin: [0,2,0,0] },
              ...(this.tipoCambio > 0 ? [{ text: `Tipo de cambio FIX: ${this.tipoCambio.toFixed(4)} MXN/USD`, fontSize: 7, color: GRAY, alignment: 'center', margin: [0,2,0,0] }] : []),
            ],
            margin: [8, 0, 8, 0],
          },
          logo2B64 ? { image: logo2B64, width: 80, alignment: 'right' } : { text: '', width: 80 },
        ],
        margin: [0, 0, 0, 10],
      };

      const destinatario: any = {
        columns: [
          {
            stack: [
              { text: `ATN: ${(cot.nombreProspecto ?? '').toUpperCase()}`, fontSize: 8, bold: true, color: NAVY },
              { text: `EMPRESA: ${(cot.empresaProspecto ?? '').toUpperCase()}`, fontSize: 8, margin: [0,2,0,0] },
              { text: (cot.puestoProspecto ?? '').toUpperCase(), fontSize: 8, color: GRAY, margin: [0,2,0,0] },
            ],
          },
          {
            stack: [
              { text: lugarFecha, fontSize: 7, color: GRAY, alignment: 'right' },
              {
                text: [
                  { text: 'No. COTIZACIÓN: ', fontSize: 8, bold: true, color: NAVY },
                  { text: cot.numCotizacion ?? '', fontSize: 10, bold: true, color: BLUE },
                ],
                alignment: 'right', margin: [0, 6, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      };

      const textoSuperior: any = {
        stack: [
          { text: textoPdf(cfg.textoPrincipal),  fontSize: 7, color: GRAY, alignment: 'left', margin: [0,0,0,6] },
          { text: textoPdf(cfg.textoCompromiso), fontSize: 7, color: GRAY, alignment: 'left', margin: [0,0,0,10] },
        ],
      };

      const tableHeader = [
        { text: 'No.', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
        { text: 'DESCRIPCIÓN / CONCEPTO', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'left' },
        { text: 'CANT',    style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
        { text: 'UNIDAD',  style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
        { text: 'PRECIO MXN',  style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right'  },
        { text: 'IMPORTE MXN', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right'  },
        { text: 'DÓLARES USD', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right' },
      ];

      const tableRows = items.map((item, idx) => [
        { text: String(idx + 1), fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: textoPdf(item.nombreMaterial), fontSize: 7, fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: String(item.cantidad ?? ''), fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: item.unidad ?? '', fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `$${Number(item.precio ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `$${Number(item.subtotal ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `US$${Number(item.dolares ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
      ]);

      const totalRow = [
        { text: '', colSpan: 4, border: [false,false,false,false] }, {}, {}, {},
        { text: 'TOTAL:', fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
        { text: `$${Number(cot.total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
        { text: `US$${(items.reduce((sum, item) => sum + Math.round((Number(item.dolares) || 0) * 100), 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
      ];

      const tabla: any = {
        table: {
          headerRows: 1,
          widths: [20, '*', 26, 34, 48, 54, 56],
          body: [tableHeader, ...tableRows, totalRow],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc' },
        margin: [0, 0, 0, 10],
      };

      const clausulas = [cfg.clausula1, cfg.clausula2, cfg.clausula3].filter(Boolean);

      const firmaStack2: any[] = [];
      if (signatureB64) {
        firmaStack2.push({ image: signatureB64, width: 120, alignment: 'center', margin: [0, 0, 0, 4] });
      }
      firmaStack2.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: NAVY }] });
      firmaStack2.push({ text: cot.nombreVendedor ?? '', fontSize: 7, bold: true, alignment: 'center', margin: [0, 4, 0, 0] });
      firmaStack2.push({ text: 'VENDEDOR', fontSize: 6, color: GRAY, alignment: 'center', margin: [0, 0, 0, signatureB64 ? 15 : 20] });

      // Cláusulas + firma en un bloque único para que nunca se separen entre páginas
      const bloqueInferior: any = {
        unbreakable: true,
        stack: [
          { text: 'CON LAS SIGUIENTES CLÁUSULAS', fontSize: 6.5, bold: true, color: NAVY, margin: [0,0,0,3] },
          {
            ul: clausulas.map(c => ({ text: textoPdf(c), fontSize: 6, color: GRAY, margin: [0,0,0,2] })),
            margin: [0,0,0,3],
          },
          { text: textoPdf(cfg.textoAclaracion), fontSize: 6, color: GRAY, alignment: 'left', margin: [0,0,0,2] },
          { text: textoPdf(cfg.textoDespedida),  fontSize: 6, color: GRAY, alignment: 'left', margin: [0,0,0,2] },
          { text: cfg.textoIva,        fontSize: 6.5, bold: true, color: NAVY, margin: [0,0,0,8] },
          {
            columns: [
              { text: '', width: '*' },
              { stack: firmaStack2, width: 160 },
              { text: '', width: '*' },
            ],
          },
        ],
      };

      // Footer como función que retorna objeto nuevo cada vez (fix multi-página)
      const makeFooter = () => ({
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: BLUE }], margin: [0,0,0,4] },
          {
            columns: [
              { text: rootData?.email ?? '', fontSize: 6, color: GRAY },
              { text: rootData?.web   ?? '', fontSize: 6, color: GRAY, alignment: 'center' },
              { text: companyName,           fontSize: 6, color: GRAY, alignment: 'right' },
            ],
          },
        ],
        margin: [40, 0, 40, 0],
      });

      const docDef: any = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
        pageMargins: [40, 40, 40, 60],
        footer: makeFooter,
        content: [header, destinatario, { text: 'ASUNTO: COTIZACIÓN', fontSize: 8, bold: true, color: NAVY, margin: [0,0,0,8] }, textoSuperior, tabla, bloqueInferior],
        styles: { thCell: { fontSize: 7, bold: true } },
        defaultStyle: { font: 'Roboto' },
      };

      this._lastDocDef = docDef;

      this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió/abrió PDF cotización', 'Ventas / Cotizaciones', this.trackingService.getEmail());
      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        this._pdfBlob = blob;   // guardar blob ya renderizado para download/WhatsApp
        if (this.originalPdfUrl) URL.revokeObjectURL(this.originalPdfUrl);
        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfPreviewUrl(this.originalPdfUrl + '#zoom=90'));
        this.isLoadingPdf = false;
      });

    } catch (e) {
      console.error('Error generando PDF', e);
      this.isLoadingPdf = false;
      Swal.fire('Error', 'No se pudo generar el PDF de la cotización.', 'error');
    }
  }

  descargarPdf() {
    if (!this._pdfBlob) return;
    const nombre = `${this.cotizacion?.numCotizacion ?? 'Cotizacion'}.pdf`;
    const url = URL.createObjectURL(this._pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getPdfBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this._pdfBlob) {
        reject(new Error('No hay PDF generado'));
        return;
      }
      resolve(this._pdfBlob);
    });
  }

  private normalizeWhatsappNumber(value: string): string | null {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `52${digits}`;
    if (digits.length < 11 || digits.length > 15) return null;
    return digits;
  }

  private updateCountInParent() {
    if (this.mode === 'pdf') return;
    if (this.params?.node && this.params?.api && !this.params.api.isDestroyed()) {
      this.params.node.data.countItems = this.rowData.length;
      this.params.node.data.total      = this.total;
      this.params.node.data.totalDolares = this.totalDolares;
      this.params.node.data.hasManualUsd = this.rowData.some(item => item.dolaresManual === true);
      this.params.node.data.tipoCambio = this.tipoCambio;
      this.params.api.refreshCells({ rowNodes: [this.params.node], columns: ['totalDolares'], force: true });
    }
  }

  estadoColor(val: string) { return ESTADOS_COTIZACION.find(e => e.value === val)?.color ?? 'secondary'; }
  estadoLabel(val: string) { return ESTADOS_COTIZACION.find(e => e.value === val)?.label ?? val; }
}

