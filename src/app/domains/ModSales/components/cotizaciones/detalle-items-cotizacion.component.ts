import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CotizacionesService, CotizacionItem, ESTADOS_COTIZACION, CotizacionConfig, CONFIG_DEFAULT } from 'app/services/cotizaciones.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { StoragesService } from 'app/services/storages.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const LBLUE = '#e8f0f8';
const GRAY  = '#555555';

@Component({
  selector: 'app-detalle-items-cotizacion',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
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
            Total: {{ total | currency:'MXN':'symbol':'1.2-2' }}
          </span>

          <div class="ms-auto d-flex gap-1">
            <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi" title="Agregar item">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="btn btn-sm btn-primary position-relative" (click)="save()" [disabled]="!hasChanges" title="Guardar">
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
          </div>
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
          style="height:600px; width:100%">
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

          <div class="ms-auto d-flex gap-2 align-items-center">
            <!-- Descargar (funciona en tablets donde el iframe no carga) -->
            <button class="btn btn-sm btn-success"
                    (click)="descargarPdf()"
                    [disabled]="isLoadingPdf || !_pdfBlob"
                    title="Descargar PDF — recomendado en tablets">
              <i class="bi bi-download me-1"></i> Descargar
            </button>

            <!-- Enviar por correo -->
            <button class="btn btn-sm btn-outline-primary"
                    (click)="abrirModalCorreo()"
                    [disabled]="isLoadingPdf || isSendingEmail">
              <span *ngIf="isSendingEmail" class="spinner-border spinner-border-sm me-1"></span>
              <i *ngIf="!isSendingEmail" class="bi bi-envelope me-1"></i>
              {{ isSendingEmail ? 'Enviando...' : 'Enviar por correo' }}
            </button>

            <button class="btn btn-sm btn-outline-success"
                    (click)="abrirModalWhatsapp()"
                    [disabled]="isLoadingPdf || isSendingWhatsapp || !_pdfBlob">
              <span *ngIf="isSendingWhatsapp" class="spinner-border spinner-border-sm me-1"></span>
              <i *ngIf="!isSendingWhatsapp" class="bi bi-whatsapp me-1"></i>
              {{ isSendingWhatsapp ? 'Preparando...' : 'Enviar por WhatsApp' }}
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
          <iframe *ngIf="pdfUrl && !isLoadingPdf"
                  [src]="pdfUrl"
                  style="width:100%; height:100%; border:none;">
          </iframe>
          <div *ngIf="isLoadingPdf" class="d-flex justify-content-center align-items-center h-100 text-muted">
            <i class="bi bi-hourglass-split me-2"></i> Generando PDF...
          </div>
        </div>
      </ng-container>

      <!-- Modal correo se renderiza en document.body via TS (escapa el transform de AG Grid) -->

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
  private svc        = inject(CotizacionesService);
  private matSvc     = inject(MaterialsService);
  private rootSvc    = inject(RootService);
  private b64Svc     = inject(Base64EncodeService);
  private storageSvc = inject(StoragesService);
  private sanitizer  = inject(DomSanitizer);
  private signalsSvc = inject(SignalsService);

  private params!: ICellRendererParams;
  private context: any;
  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  cotizacion: any  = null;
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
  isSendingWhatsapp = false;
  private originalPdfUrl: string | null = null;
  _lastDocDef: any = null;
  _pdfBlob: Blob | null = null;   // blob renderizado — se reutiliza para download/WhatsApp

  // ── Modal correo ──────────────────────────────────────────────────────────
  showEmailModal  = false;
  emailPara       = '';
  emailCc         = '';
  emailHistorial: string[] = [];
  sugerenciasPara: string[] = [];
  sugerenciasCc:   string[] = [];

  get total() { return this.rowData.reduce((s, i) => s + (i.subtotal ?? 0), 0); }

  // ── Enter-nav ─────────────────────────────────────────────────────────────
  private editableColumnOrder = ['nombreMaterial', 'unidad', 'cantidad', 'precio'];
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
  ];

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 30,
    rowSelection: 'single',
    tooltipShowDelay: 300,
    tooltipHideDelay: 8000,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowClicked: (e: any) => { this.selectedRow = e.data; },
  };

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  // ── ICellRendererAngularComp ───────────────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.params     = params;
    this.context    = params.context;
    this.cotizacion = { ...params.data };
    this.mode       = params.data?.__mode ?? 'items';

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
    const newMode = params.data?.__mode ?? 'items';
    if (newMode !== this.mode) {
      this.mode = newMode;
      if (newMode === 'pdf') {
        this.pdfUrl = null;
        this.generarPdf();
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
        // Filtrar por la familia definida en esta cotización (vacío = todas)
        const familiaFiltro: string = this.cotizacion?.familia ?? '';
        const filtered = familiaFiltro
          ? data.filter(i => (i.familia ?? '') === familiaFiltro)
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
    this.rowData      = data;
    this.originalData = JSON.parse(JSON.stringify(data));
    this.hasChanges   = false;
  }

  onCellEditingStopped(event: any) {
    const colId = event.column.getColId();
    if (colId === 'cantidad' || colId === 'precio') {
      event.data.subtotal = (event.data.cantidad ?? 0) * (event.data.precio ?? 0);
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['subtotal'] });
    } else if (colId === 'nombreMaterial') {
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['unidad', 'precio', 'subtotal'] });
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

  // ── CRUD ──────────────────────────────────────────────────────────────────

  add() {
    const nuevo: CotizacionItem = {
      idMaterial: 0, nombreMaterial: '', unidad: '',
      cantidad: 1, precio: 0, subtotal: 0, __isNew: true,
    };
    this.rowData = [...this.rowData, nuevo];
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.startEditingCell({ rowIndex: this.rowData.length - 1, colKey: 'nombreMaterial' });
    }, 50);
  }

  async save() {
    if (!this.cotizacion?.id) return;
    try {
      await this.svc.guardarItems(this.cotizacion.id, this.rowData);
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges   = false;
      this.updateCountInParent();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (e: any) {
      console.error('[Cotizaciones] Error guardando items:', e);
      Swal.fire('Error', e?.message ?? 'No se pudo guardar.', 'error');
    }
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
  private emailModalEl: HTMLElement | null = null;

  async abrirModalCorreo() {
    const idCompany = this.context?.idCompany;
    this.emailHistorial = idCompany ? await this.svc.getEmailHistorial(idCompany) : [];
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
          <input id="em-para" class="form-control form-control-sm" placeholder="destinatario@empresa.com" value="${this.emailPara}" autocomplete="off">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px;">CC</label>
          <input id="em-cc" class="form-control form-control-sm" placeholder="copia@empresa.com (opcional)" autocomplete="off">
        </div>
        <div style="margin-bottom:4px;">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px;">Asunto</label>
          <input class="form-control form-control-sm" style="background:#f8f9fa;" readonly value="${asunto}">
        </div>
      </div>
      <div style="padding:10px 16px;background:#f8f9fa;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #dee2e6;">
        <button id="em-cancel" class="btn btn-sm btn-secondary">Cancelar</button>
        <button id="em-send"   class="btn btn-sm btn-primary"><i class="bi bi-send me-1"></i>Enviar</button>
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.appendChild(backdrop);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    this.emailModalEl = wrap;

    // Eventos
    card.querySelector('#em-close')!.addEventListener('click',  () => this.cerrarModalCorreo());
    card.querySelector('#em-cancel')!.addEventListener('click', () => this.cerrarModalCorreo());
    card.querySelector('#em-send')!.addEventListener('click', async () => {
      const para = (document.getElementById('em-para') as HTMLInputElement)?.value?.trim();
      const cc   = (document.getElementById('em-cc')   as HTMLInputElement)?.value?.trim() ?? '';
      if (!para) { alert('El campo "Para" es requerido'); return; }
      this.emailPara = para;
      this.emailCc   = cc;
      this.cerrarModalCorreo();
      await this.enviarPorCorreo();
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

  async enviarPorCorreo() {
    if (!this.emailPara?.trim()) return;
    this.isSendingEmail = true;
    try {
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const idRoot = this.context?.idCompany;
        this.rootSvc.getRootbyId(idRoot).subscribe({
          next: async (rootData: any) => {
            try {
              const tryB64 = async (url: string) => {
                try { return await this.b64Svc.convertImageToBase64(url); } catch { return null; }
              };
              const logoB64      = rootData?.picture  ? await tryB64(rootData.picture)  : null;
              const logo2B64     = rootData?.picture2 ? await tryB64(rootData.picture2) : logoB64;
              const signatureUrl = this.signalsSvc.profile.signatureUser();
              const signatureB64 = signatureUrl ? await tryB64(signatureUrl) : null;
              const items    = await this.svc.getItems(this.cotizacion.id);

              const cot      = this.cotizacion;
              const fecha    = cot.fecha?.toDate ? cot.fecha.toDate() : new Date();
              const fechaStr = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
              const lugarFecha   = `${(cot.lugar ?? '').toUpperCase()}, A ${fechaStr}`;
              const companyName  = (rootData?.name ?? 'EMPRESA').toUpperCase();
              const cfg: CotizacionConfig = this.context?.config ?? CONFIG_DEFAULT;

              const header: any = {
                columns: [
                  logoB64  ? { image: logoB64,  width: 80 } : { text: '', width: 80 },
                  {
                    stack: [
                      { text: companyName, fontSize: 11, bold: true, color: NAVY, alignment: 'center' },
                      { text: 'COTIZACIÓN', fontSize: 9, bold: true, color: BLUE, alignment: 'center', margin: [0,2,0,0] },
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

              const tableHeader = [
                { text: 'DESCRIPCIÓN / CONCEPTO', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'left' },
                { text: 'CANT',    style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
                { text: 'UNIDAD',  style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
                { text: 'PRECIO',  style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right'  },
                { text: 'IMPORTE', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right'  },
              ];
              const tableRows = items.map((item, idx) => [
                { text: item.nombreMaterial ?? '', fontSize: 7, fillColor: idx % 2 === 1 ? LBLUE : null },
                { text: String(item.cantidad ?? ''), fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
                { text: item.unidad ?? '', fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
                { text: `$${Number(item.precio ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
                { text: `$${Number(item.subtotal ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
              ]);
              const totalRow = [
                { text: '', colSpan: 3, border: [false,false,false,false] }, {}, {},
                { text: 'TOTAL:', fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
                { text: `$${Number(cot.total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
              ];
              const tabla: any = {
                table: { headerRows: 1, widths: ['*', 28, 35, 55, 58], body: [tableHeader, ...tableRows, totalRow] },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc' },
                margin: [0, 0, 0, 10],
              };
              const clausulas = [cfg.clausula1, cfg.clausula2, cfg.clausula3].filter(Boolean);
              const firmaStack1: any[] = [];
              if (signatureB64) {
                firmaStack1.push({ image: signatureB64, width: 120, alignment: 'center', margin: [0,0,0,4] });
              }
              firmaStack1.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: NAVY }] });
              firmaStack1.push({ text: cot.nombreVendedor ?? '', fontSize: 7, bold: true, alignment: 'center', margin: [0,4,0,0] });
              firmaStack1.push({ text: 'VENDEDOR', fontSize: 6, color: GRAY, alignment: 'center', margin: [0,0,0, signatureB64 ? 15 : 20] });
              const bloqueInferiorEmail: any = {
                stack: [
                  { text: 'CON LAS SIGUIENTES CLÁUSULAS', fontSize: 6.5, bold: true, color: NAVY, margin: [0,0,0,3] },
                  { ul: clausulas.map(c => ({ text: c, fontSize: 6, color: GRAY, margin: [0,0,0,2] })), margin: [0,0,0,3] },
                  { text: cfg.textoAclaracion, fontSize: 6, color: GRAY, alignment: 'justify', margin: [0,0,0,2] },
                  { text: cfg.textoDespedida,  fontSize: 6, color: GRAY, alignment: 'justify', margin: [0,0,0,2] },
                  { text: cfg.textoIva,        fontSize: 6.5, bold: true, color: NAVY, margin: [0,0,0,8] },
                  {
                    columns: [
                      { text: '', width: '*' },
                      { stack: firmaStack1, width: 160 },
                      { text: '', width: '*' },
                    ],
                  },
                ],
              };
              const textoSuperior: any = {
                stack: [
                  { text: cfg.textoPrincipal,  fontSize: 7, color: GRAY, alignment: 'justify', margin: [0,0,0,6] },
                  { text: cfg.textoCompromiso, fontSize: 7, color: GRAY, alignment: 'justify', margin: [0,0,0,10] },
                ],
              };
              const docDef: any = {
                pageSize: 'LETTER',
                pageMargins: [40, 40, 40, 60],
                footer: () => ({
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
                }),
                content: [header, destinatario, { text: 'ASUNTO: COTIZACIÓN', fontSize: 8, bold: true, color: NAVY, margin: [0,0,0,8] }, textoSuperior, tabla, bloqueInferiorEmail],
                styles: { thCell: { fontSize: 7, bold: true } },
                defaultStyle: { font: 'Roboto' },
              };

              pdfMake.createPdf(docDef).getBase64((b64: string) => resolve(b64));
            } catch (err) { reject(err); }
          },
          error: reject,
        });
      });

      await this.svc.enviarPorCorreo(
        this.emailPara,
        this.cotizacion,
        pdfBase64,
        this.signalsSvc.profile.emailUser() ?? undefined,
        this.emailCc?.trim() || undefined,
      );

      // Guardar ambos correos en el historial
      const idCompany = this.context?.idCompany;
      if (idCompany) {
        const nuevos = [this.emailPara, this.emailCc].filter(Boolean);
        await this.svc.guardarEmailHistorial(idCompany, nuevos);
      }

      this.cerrarModalCorreo();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Correo enviado', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch (e: any) {
      console.error('[Cotizaciones] Error enviando correo:', e);
      Swal.fire('Error', 'No se pudo enviar el correo.', 'error');
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
    try {
      const idRoot = this.context?.idCompany;
      const [rootData, items] = await Promise.all([
        lastValueFrom(this.rootSvc.getRootbyId(idRoot)) as Promise<any>,
        this.svc.getItems(this.cotizacion.id),
      ]);

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

      const cfg: CotizacionConfig = this.context?.config ?? CONFIG_DEFAULT;

      const textoSuperior: any = {
        stack: [
          { text: cfg.textoPrincipal,  fontSize: 7, color: GRAY, alignment: 'justify', margin: [0,0,0,6] },
          { text: cfg.textoCompromiso, fontSize: 7, color: GRAY, alignment: 'justify', margin: [0,0,0,10] },
        ],
      };

      const tableHeader = [
        { text: 'DESCRIPCIÓN / CONCEPTO', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'left' },
        { text: 'CANT',    style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
        { text: 'UNIDAD',  style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'center' },
        { text: 'PRECIO',  style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right'  },
        { text: 'IMPORTE', style: 'thCell', fillColor: NAVY, color: '#fff', alignment: 'right'  },
      ];

      const tableRows = items.map((item, idx) => [
        { text: item.nombreMaterial ?? '', fontSize: 7, fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: String(item.cantidad ?? ''), fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: item.unidad ?? '', fontSize: 7, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `$${Number(item.precio ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `$${Number(item.subtotal ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 7, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
      ]);

      const totalRow = [
        { text: '', colSpan: 3, border: [false,false,false,false] }, {}, {},
        { text: 'TOTAL:', fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
        { text: `$${Number(cot.total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 8, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
      ];

      const tabla: any = {
        table: {
          headerRows: 1,
          widths: ['*', 28, 35, 55, 58],
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
        stack: [
          { text: 'CON LAS SIGUIENTES CLÁUSULAS', fontSize: 6.5, bold: true, color: NAVY, margin: [0,0,0,3] },
          {
            ul: clausulas.map(c => ({ text: c, fontSize: 6, color: GRAY, margin: [0,0,0,2] })),
            margin: [0,0,0,3],
          },
          { text: cfg.textoAclaracion, fontSize: 6, color: GRAY, alignment: 'justify', margin: [0,0,0,2] },
          { text: cfg.textoDespedida,  fontSize: 6, color: GRAY, alignment: 'justify', margin: [0,0,0,2] },
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
        pageMargins: [40, 40, 40, 60],
        footer: makeFooter,
        content: [header, destinatario, { text: 'ASUNTO: COTIZACIÓN', fontSize: 8, bold: true, color: NAVY, margin: [0,0,0,8] }, textoSuperior, tabla, bloqueInferior],
        styles: { thCell: { fontSize: 7, bold: true } },
        defaultStyle: { font: 'Roboto' },
      };

      this._lastDocDef = docDef;

      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        this._pdfBlob = blob;   // guardar blob ya renderizado para download/WhatsApp
        if (this.originalPdfUrl) URL.revokeObjectURL(this.originalPdfUrl);
        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.originalPdfUrl + '#zoom=90');
        this.isLoadingPdf = false;
      });

    } catch (e) {
      console.error('Error generando PDF', e);
      this.isLoadingPdf = false;
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
    if (this.params?.node && this.params?.api && !this.params.api.isDestroyed()) {
      this.params.node.data.countItems = this.rowData.length;
      this.params.node.data.total      = this.total;
      this.params.api.refreshCells({ rowNodes: [this.params.node], force: true });
    }
  }

  estadoColor(val: string) { return ESTADOS_COTIZACION.find(e => e.value === val)?.color ?? 'secondary'; }
  estadoLabel(val: string) { return ESTADOS_COTIZACION.find(e => e.value === val)?.label ?? val; }
}

