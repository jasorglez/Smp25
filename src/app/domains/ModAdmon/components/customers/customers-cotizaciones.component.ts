import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  CotizacionesService,
  ESTADOS_COTIZACION,
  CotizacionConfig,
  CONFIG_DEFAULT,
} from 'app/services/cotizaciones.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { DetalleItemsCotizacionComponent } from 'app/domains/ModSales/components/cotizaciones/detalle-items-cotizacion.component';
import { ButtonCellRendererIncomeComponent } from 'app/domains/ModAdmon/components/income/button-cell-renderer-income.component';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-customers-cotizaciones',
  standalone: true,
  imports: [
    CommonModule,
    AgGridModule,
    ButtonCellRendererIncomeComponent,
    DetalleItemsCotizacionComponent,
  ],
  template: `
    <div class="cot-detail-wrapper">

      <!-- ── Barra de herramientas ── -->
      <div class="d-flex align-items-center gap-2 px-3 py-2 border-bottom flex-wrap"
           style="background:#e8f4ff;">
        <i class="bi bi-file-earmark-text text-primary"></i>
        <span class="fw-semibold small">
          Cotizaciones —
          <strong>{{ customer?.nameContact || customer?.company }}</strong>
        </span>

        <div class="ms-auto d-flex gap-1">
          <button class="btn btn-sm btn-success"
                  (click)="add()"
                  [disabled]="!gridApi"
                  title="Nueva cotización">
            <i class="bi bi-plus-lg me-1"></i> Nueva
          </button>
          <button class="btn btn-sm btn-danger"
                  (click)="deleteSelected()"
                  [disabled]="!selectedItem"
                  title="Eliminar cotización seleccionada">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <!-- ── Grid de cotizaciones ── -->
      <ag-grid-angular
        class="ag-theme-quartz"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellEditingStopped)="onCellEditingStopped($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        style="width:100%">
      </ag-grid-angular>

    </div>
  `,
  styles: [`
    .cot-detail-wrapper {
      background: #f0f8ff;
      border-top: 2px solid #0d6efd;
      height: 100%;
    }
  `],
})
export class CustomersCotizacionesComponent implements ICellRendererAngularComp {
  private svc         = inject(CotizacionesService);
  private signalsSvc  = inject(SignalsService);
  private catalogsSvc = inject(CatalogsService);

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  gridApi!: GridApi;
  rowData: any[]    = [];
  selectedItem: any = null;
  customer: any     = null;
  idCompany: number = 0;
  config: CotizacionConfig = { ...CONFIG_DEFAULT };
  familias: string[] = [];

  private sub?: Subscription;

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

  // ── Enter-key navigation ──────────────────────────────────────────────────
  private editableColumnOrder = ['familia', 'notas'];
  private enterPressed        = false;

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

  // ── ColDefs ───────────────────────────────────────────────────────────────

  colDefs: ColDef[] = [
    {
      field: 'pdf', headerName: 'PDF', width: 70, editable: false,
      cellRenderer: ButtonCellRendererIncomeComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleCascadeWithMode(node, 'pdf'),
        icon: 'bi-file-earmark-pdf',
        title: 'Ver PDF',
      },
      cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer' },
    },
    {
      field: 'items', headerName: 'Items', width: 90, editable: false,
      cellRenderer: ButtonCellRendererIncomeComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleCascadeWithMode(node, 'items'),
        icon: 'bi-card-list',
        title: 'Ver / editar items',
      },
      valueGetter: (params: any) => params.data?.countItems ?? 0,
      cellStyle: { backgroundColor: '#e8f0fb', cursor: 'pointer' },
    },
    {
      field: 'numCotizacion', headerName: 'No. Docto', width: 140, editable: false,
    },
    {
      field: 'nombreProspecto', headerName: 'Cliente', width: 180, editable: false,
    },

    // ── FAMILIA — filtra materiales en los items ──────────────────────────
    {
      field: 'familia', headerName: 'Familia', width: 150, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: ['', ...this.familias] }),
      cellRenderer: (p: any) => p.value
        ? `<span class="badge bg-info text-dark">${p.value}</span>`
        : `<span class="text-muted" style="font-size:.8em;">Todas</span>`,
      tooltipValueGetter: () =>
        'Familia de materiales que aparecen en los items de esta cotización',
    },

    {
      field: 'estado', headerName: 'Estado', width: 120, editable: false,
      cellRenderer: (p: any) => {
        const e = ESTADOS_COTIZACION.find(x => x.value === p.value);
        return e ? `<span class="badge bg-${e.color}">${e.label}</span>` : (p.value ?? '');
      },
    },
    {
      field: 'total', headerName: 'Total', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p: any) =>
        p.value != null ? `$${Number(p.value).toFixed(2)}` : '$0.00',
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'fecha', headerName: 'Fecha', width: 120, editable: false,
      cellRenderer: (p: any) => this.formatFecha(p.value),
    },
    {
      field: 'notas', headerName: 'Notas', flex: 1, editable: true,
    },
  ];

  // ── Grid Options ─────────────────────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 30,
    rowSelection: 'single',
    domLayout: 'autoHeight',   // el grid crece para mostrar el PDF completo
    masterDetail: true,
    detailRowHeight: 1400,     // espacio generoso para PDF (82vh) + items
    isRowMaster: () => true,
    detailCellRenderer: DetalleItemsCotizacionComponent,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowClicked: (event: any) => {
      const colId = event.column?.getColId();
      if (colId !== 'items' && colId !== 'pdf') {
        this.selectedItem = event.data;
      }
    },
  };

  // ── ICellRendererAngularComp ──────────────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.customer  = params.data;
    this.idCompany = (params as any).context?.idCompany
      ?? this.signalsSvc.getRootSelectedBySidebar()();
    this.cargarDatos();
  }

  /** Retornar true: AG Grid no destruye/recrea el componente en cada refresh del padre */
  refresh(params: ICellRendererParams): boolean {
    return true;
  }

  // ── Grid Ready ────────────────────────────────────────────────────────────

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.actualizarContextoDetalle();
  }

  private actualizarContextoDetalle() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      context: { idCompany: this.idCompany, config: this.config },
    });
  }

  // ── Datos ─────────────────────────────────────────────────────────────────

  cargarDatos() {
    this.sub?.unsubscribe();
    if (!this.customer?.id || !this.idCompany) return;

    // Config de cotizaciones de la empresa
    this.svc.getConfig(this.idCompany).then(cfg => {
      this.config = cfg;
      this.actualizarContextoDetalle();
    });

    // Familias del catálogo (filtra materiales en los items)
    this.catalogsSvc.getFamilyById(this.idCompany).subscribe({
      next: (data: any[]) => {
        this.familias = data.map((f: any) => f.description ?? '').filter(Boolean).sort();
      },
      error: () => { this.familias = []; },
    });

    // Suscripción en tiempo real — cotizaciones de este cliente en esta empresa
    this.sub = this.svc
      .getCotizacionesByCliente(this.customer.id, this.idCompany)
      .subscribe({
        next: (data) => {
          this.rowData = data
            .filter(c => (c as any).activo !== false)
            .sort(
              (a: any, b: any) =>
                (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0)
            )
            .map(c => ({
              ...c,
              countItems: (c as any).countItems ?? 0,
              total:      (c as any).total      ?? 0,
            }));

          if (this.gridApi && !this.gridApi.isDestroyed()) {
            this.gridApi.setGridOption('rowData', this.rowData);
          }
        },
        error: (err) =>
          console.error('[CustomersCotizaciones] Error cargando datos:', err),
      });
  }

  // ── Edición inline: auto-guardar familia y notas ──────────────────────────

  onCellValueChanged(event: any) {
    const field = event.colDef?.field;
    if (!event.data?.id || !field) return;

    if (field === 'familia' || field === 'notas') {
      this.svc
        .actualizarCotizacion(event.data.id, { [field]: event.newValue ?? '' })
        .then(() => {
          if (field === 'familia') {
            // Actualizar contexto para que el detalle ya abierto use la nueva familia
            this.actualizarContextoDetalle();
          }
        })
        .catch(err =>
          console.error(`[CustomersCotizaciones] Error guardando ${field}:`, err)
        );
    }
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[idx + 1],
        });
      }, 100);
    }
  }

  // ── Cascada PDF / Items (nivel 3: DetalleItemsCotizacionComponent) ─────────

  toggleCascadeWithMode(node: any, mode: 'items' | 'pdf') {
    const api       = this.gridApi;
    const isExpanded = node.expanded;
    const sameMode   = isExpanded && node.data?.__mode === mode;

    if (sameMode) {
      node.setExpanded(false);
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
      return;
    }

    node.data.__mode = mode;
    api.forEachNode((n: any) => {
      if (n.expanded && n.id !== node.id) n.setExpanded(false);
    });
    api.forEachNode((n: any) => {
      if (n.id !== node.id) n.setRowHeight(0);
    });
    api.onRowHeightChanged();
    this.actualizarContextoDetalle();
    setTimeout(() => node.setExpanded(true), 0);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async add() {
    if (!this.idCompany || !this.customer?.id) return;

    const numCotizacion = await this.svc.getNextNumero(this.idCompany);
    const clientName    = this.customer.nameContact || this.customer.company || '';
    const clientCompany = this.customer.company || '';

    await this.svc.crearCotizacion({
      numCotizacion,
      idCliente:        this.customer.id,
      idProspecto:      '',
      nombreProspecto:  clientName,       // DetalleItemsCotizacion muestra este campo
      empresaProspecto: clientCompany,
      puestoProspecto:  '',
      lugar:            this.config.lugarDefault ?? '',
      familia:          '',
      idVendedor:       this.idVendedor,
      nombreVendedor:   this.nombreVendedor,
      idCompany:        this.idCompany,
    });
    // La suscripción Firebase actualiza rowData automáticamente
  }

  async deleteSelected() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar cotización?',
      text:  `${this.selectedItem.numCotizacion} — ${this.selectedItem.nombreProspecto}`,
      icon:  'warning',
      showCancelButton:   true,
      confirmButtonColor: '#dc3545',
      confirmButtonText:  'Sí, eliminar',
      cancelButtonText:   'Cancelar',
    });
    if (!res.isConfirmed) return;

    try {
      await this.svc.actualizarCotizacion(
        this.selectedItem.id!,
        { activo: false } as any
      );
      this.selectedItem = null;
      Swal.fire({
        icon: 'success', title: 'Eliminado',
        timer: 1200, showConfirmButton: false,
      });
    } catch {
      Swal.fire('Error', 'No se pudo eliminar la cotización.', 'error');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
