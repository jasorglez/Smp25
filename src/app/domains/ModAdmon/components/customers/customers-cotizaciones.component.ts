import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  CotizacionesService,
  ESTADOS_COTIZACION,
  CotizacionConfig,
  CONFIG_DEFAULT,
} from 'app/services/cotizaciones.service';
import { SignalsService } from 'app/services/signals.service';
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
    <div class="customers-cot-wrapper">
      <!-- Barra de herramientas -->
      <div class="d-flex align-items-center gap-2 px-3 py-2 border-bottom flex-wrap">
        <i class="bi bi-file-earmark-text text-primary fs-5"></i>
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

      <!-- Grid -->
      <ag-grid-angular
        class="ag-theme-quartz"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        style="height:340px; width:100%">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .customers-cot-wrapper {
      background: #f0f8ff;
      border-top: 2px solid #0d6efd;
    }
  `],
})
export class CustomersCotizacionesComponent implements OnChanges, OnDestroy {
  @Input() customer: any = null;

  private svc        = inject(CotizacionesService);
  private signalsSvc = inject(SignalsService);

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  gridApi!: GridApi;
  rowData: any[]    = [];
  selectedItem: any = null;
  config: CotizacionConfig = { ...CONFIG_DEFAULT };
  private sub?: Subscription;

  get idCompany()      { return this.signalsSvc.getRootSelectedBySidebar()(); }
  get idVendedor()     { return this.signalsSvc.idUser(); }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

  // ── ColDefs ───────────────────────────────────────────────────────────────

  defaultColDef: ColDef = { sortable: true, resizable: true, minWidth: 80 };

  colDefs: ColDef[] = [
    {
      field: 'pdf',
      headerName: 'PDF',
      width: 70,
      editable: false,
      cellRenderer: ButtonCellRendererIncomeComponent,
      cellRendererParams: {
        onClick: (node: any) => this.toggleCascadeWithMode(node, 'pdf'),
        icon: 'bi-file-earmark-pdf',
        title: 'Ver PDF',
      },
      cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer' },
    },
    {
      field: 'items',
      headerName: 'Items',
      width: 90,
      editable: false,
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
      field: 'numCotizacion',
      headerName: 'No. Docto',
      width: 140,
      editable: false,
    },
    {
      field: 'nombreProspecto',
      headerName: 'Cliente',
      flex: 1,
      editable: false,
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 130,
      editable: false,
      cellRenderer: (p: any) => {
        const e = ESTADOS_COTIZACION.find(x => x.value === p.value);
        return e
          ? `<span class="badge bg-${e.color}">${e.label}</span>`
          : (p.value ?? '');
      },
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 130,
      editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) =>
        p.value != null ? `$${Number(p.value).toFixed(2)}` : '$0.00',
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 130,
      editable: false,
      cellRenderer: (p: any) => this.formatFecha(p.value),
    },
  ];

  // ── Grid Options ─────────────────────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 30,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 700,
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

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges) {
    if (changes['customer'] && this.customer?.id) {
      this.cargarDatos();
    }
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.actualizarContextoDetalle();
    if (this.customer?.id) {
      this.cargarDatos();
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // ── Contexto del detalle ─────────────────────────────────────────────────

  private actualizarContextoDetalle() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      context: { idCompany: this.idCompany, config: this.config },
    });
  }

  // ── Datos ─────────────────────────────────────────────────────────────────

  cargarDatos() {
    this.sub?.unsubscribe();
    if (!this.customer?.id) { this.rowData = []; return; }

    // Cargar config de cotizaciones de la empresa
    this.svc.getConfig(this.idCompany).then(cfg => {
      this.config = cfg;
      this.actualizarContextoDetalle();
    });

    // Suscripción en tiempo real filtrada por cliente + empresa
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

  // ── Cascada PDF / Items ───────────────────────────────────────────────────

  toggleCascadeWithMode(node: any, mode: 'items' | 'pdf') {
    const api = this.gridApi;
    const isExpanded = node.expanded;
    const sameMode = isExpanded && node.data?.__mode === mode;

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
    const idCompany = this.idCompany;
    if (!idCompany || !this.customer?.id) return;

    const numCotizacion = await this.svc.getNextNumero(idCompany);
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
      idCompany,
    });
    // Firebase subscription actualiza rowData automáticamente
  }

  async deleteSelected() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar cotización?',
      text:  `${this.selectedItem.numCotizacion} — ${this.selectedItem.nombreProspecto}`,
      icon:  'warning',
      showCancelButton: true,
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
}
