import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CotizacionesService, CotizacionItem, ESTADOS_COTIZACION, CotizacionConfig, CONFIG_DEFAULT } from 'app/services/cotizaciones.service';
import { MaterialsService } from 'app/services/materials.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
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
          <div *ngIf="isLoadingPdf" class="spinner-border spinner-border-sm text-danger ms-2" role="status">
            <span class="visually-hidden">Generando PDF...</span>
          </div>
        </div>
        <div style="height:954px; border:1px solid #dee2e6; border-radius:4px; overflow:hidden;">
          <iframe *ngIf="pdfUrl && !isLoadingPdf"
                  [src]="pdfUrl"
                  style="width:100%; height:100%; border:none;">
          </iframe>
          <div *ngIf="isLoadingPdf" class="d-flex justify-content-center align-items-center h-100 text-muted">
            <i class="bi bi-hourglass-split me-2"></i> Generando PDF...
          </div>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .detail-container {
      padding: 12px 16px;
      background-color: #f0f8ff;
      border-top: 2px solid #0d6efd;
    }
  `]
})
export class DetalleItemsCotizacionComponent implements ICellRendererAngularComp {
  private svc       = inject(CotizacionesService);
  private matSvc    = inject(MaterialsService);
  private rootSvc   = inject(RootService);
  private b64Svc    = inject(Base64EncodeService);
  private sanitizer = inject(DomSanitizer);

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
  isLoadingPdf = false;
  private originalPdfUrl: string | null = null;

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
      valueSetter: (params) => {
        const mat = this.materiales.find(m => m.description === params.newValue);
        if (mat) {
          params.data.nombreMaterial = mat.description;
          params.data.idMaterial     = mat.id;
          params.data.unidad         = mat.measure ?? '';
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
        this.materiales = data.map(i => ({
          id:          i.id,
          description: i.description ?? '',
          measure:     i.measure ?? '',
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
    if (event.column.getColId() === 'cantidad' || event.column.getColId() === 'precio') {
      event.data.subtotal = (event.data.cantidad ?? 0) * (event.data.precio ?? 0);
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['subtotal'] });
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
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
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

  deleteRow() {
    if (!this.selectedRow) return;
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
      const logoB64  = rootData?.picture  ? await tryB64(rootData.picture)  : null;
      const logo2B64 = rootData?.picture2 ? await tryB64(rootData.picture2) : logoB64;

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
              { text: companyName, fontSize: 12, bold: true, color: NAVY, alignment: 'center' },
              { text: 'COTIZACIÓN', fontSize: 10, bold: true, color: BLUE, alignment: 'center', margin: [0,2,0,0] },
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
              { text: `ATN: ${(cot.nombreProspecto ?? '').toUpperCase()}`, fontSize: 9, bold: true, color: NAVY },
              { text: `EMPRESA: ${(cot.empresaProspecto ?? '').toUpperCase()}`, fontSize: 9, margin: [0,2,0,0] },
              { text: 'DIRECTOR GENERAL', fontSize: 9, color: GRAY, margin: [0,2,0,0] },
            ],
          },
          {
            stack: [
              { text: lugarFecha, fontSize: 8, color: GRAY, alignment: 'right' },
              {
                text: [
                  { text: 'No. COTIZACIÓN: ', fontSize: 9, bold: true, color: NAVY },
                  { text: cot.numCotizacion ?? '', fontSize: 11, bold: true, color: BLUE },
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
          { text: cfg.textoPrincipal,  fontSize: 8, color: GRAY, alignment: 'justify', margin: [0,0,0,6] },
          { text: cfg.textoCompromiso, fontSize: 8, color: GRAY, alignment: 'justify', margin: [0,0,0,10] },
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
        { text: item.nombreMaterial ?? '', fontSize: 8, fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: String(item.cantidad ?? ''), fontSize: 8, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: item.unidad ?? '', fontSize: 8, alignment: 'center', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `$${Number(item.precio ?? 0).toFixed(2)}`, fontSize: 8, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
        { text: `$${Number(item.subtotal ?? 0).toFixed(2)}`, fontSize: 8, alignment: 'right', fillColor: idx % 2 === 1 ? LBLUE : null },
      ]);

      const totalRow = [
        { text: '', colSpan: 3, border: [false,false,false,false] }, {}, {},
        { text: 'TOTAL:', fontSize: 9, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
        { text: `$${Number(cot.total ?? 0).toFixed(2)}`, fontSize: 9, bold: true, alignment: 'right', fillColor: NAVY, color: '#fff' },
      ];

      const tabla: any = {
        table: {
          headerRows: 1,
          widths: ['*', 45, 55, 70, 75],
          body: [tableHeader, ...tableRows, totalRow],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cccccc', vLineColor: () => '#cccccc' },
        margin: [0, 0, 0, 10],
      };

      const clausulas = [cfg.clausula1, cfg.clausula2, cfg.clausula3].filter(Boolean);

      const textoInferior: any = {
        stack: [
          { text: 'CON LAS SIGUIENTES CLÁUSULAS', fontSize: 8, bold: true, color: NAVY, margin: [0,0,0,5] },
          {
            ul: clausulas.map(c => ({ text: c, fontSize: 7.5, color: GRAY, margin: [0,0,0,3] })),
            margin: [0,0,0,6],
          },
          { text: cfg.textoAclaracion, fontSize: 7.5, color: GRAY, alignment: 'justify', margin: [0,0,0,4] },
          { text: cfg.textoDespedida,  fontSize: 7.5, color: GRAY, alignment: 'justify', margin: [0,0,0,4] },
          { text: cfg.textoIva,        fontSize: 7.5, bold: true, color: NAVY, margin: [0,0,0,70] },
        ],
      };

      const firma: any = {
        columns: [
          { text: '', width: '*' },
          {
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: NAVY }] },
              { text: cot.nombreVendedor ?? '', fontSize: 8, bold: true, alignment: 'center', margin: [0,4,0,0] },
              { text: 'VENDEDOR', fontSize: 7, color: GRAY, alignment: 'center', margin: [0, 0, 0, 55] },
            ],
            width: 160,
          },
          { text: '', width: '*' },
        ],
      };

      const footerContent: any = {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: BLUE }], margin: [0,0,0,4] },
          {
            columns: [
              { text: rootData?.email ?? '', fontSize: 7, color: GRAY },
              { text: rootData?.web   ?? '', fontSize: 7, color: GRAY, alignment: 'center' },
              { text: companyName,           fontSize: 7, color: GRAY, alignment: 'right' },
            ],
          },
        ],
        margin: [40, 0, 40, 0],
      };

      const docDef: any = {
        pageSize: 'LETTER',
        pageMargins: [40, 40, 40, 60],
        footer: () => footerContent,
        content: [header, destinatario, { text: 'ASUNTO: COTIZACIÓN', fontSize: 9, bold: true, color: NAVY, margin: [0,0,0,8] }, textoSuperior, tabla, textoInferior, firma],
        styles: { thCell: { fontSize: 8, bold: true } },
        defaultStyle: { font: 'Roboto' },
      };

      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        if (this.originalPdfUrl) URL.revokeObjectURL(this.originalPdfUrl);
        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.originalPdfUrl);
        this.isLoadingPdf = false;
      });

    } catch (e) {
      console.error('Error generando PDF', e);
      this.isLoadingPdf = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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
