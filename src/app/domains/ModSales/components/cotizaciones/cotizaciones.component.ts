import { Component, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CotizacionesService, ESTADOS_COTIZACION, CotizacionConfig, CONFIG_DEFAULT } from 'app/services/cotizaciones.service';
import { ProspectosService, Prospecto } from 'app/services/prospectos.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ButtonCellRendererIncomeComponent } from 'app/domains/ModAdmon/components/income/button-cell-renderer-income.component';
import { DetalleItemsCotizacionComponent } from './detalle-items-cotizacion.component';
import { ConfigCotizacionesComponent } from './config-cotizaciones.component';
import { combineLatest, Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererIncomeComponent, DetalleItemsCotizacionComponent, ConfigCotizacionesComponent],
  templateUrl: './cotizaciones.component.html',
  styleUrl: './cotizaciones.component.scss',
})
export class CotizacionesComponent implements OnInit, OnDestroy {
  private svc           = inject(CotizacionesService);
  private prospectosSvc = inject(ProspectosService);
  private signalsSvc    = inject(SignalsService);
  private catalogsSvc   = inject(CatalogsService);

  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  rowData:          any[] = [];
  originalData:     any[] = [];
  selectedItem:     any   = null;
  hasUnsavedChanges = false;
  loading           = false;
  showConfig        = false;

  prospectos: Prospecto[] = [];
  familias:   string[]    = [];   // familias disponibles para el selector
  estados = ESTADOS_COTIZACION;
  config: CotizacionConfig = { ...CONFIG_DEFAULT };

  root: number = null;
  private sub?: Subscription;

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get idCompany()      { return this.root; }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

  constructor() {
    effect(() => {
      this.root = this.signalsSvc.getRootSelectedBySidebar()();
      if (this.root) {
        this.sub?.unsubscribe();
        this.cargarDatos();
        this.actualizarContextoDetalle();
      }
    });
  }

  // ── Enter-key navigation ─────────────────────────────────────────────────
  private editableColumnOrder = ['numCotizacion', 'nombreProspecto', 'lugar', 'familia', 'notas'];
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

  onCellEditingStopped(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  // ── Grid Options ──────────────────────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    domLayout: 'autoHeight',
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 2400,
    isRowMaster: () => true,
    detailCellRenderer: DetalleItemsCotizacionComponent,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowClicked: (event: any) => {
      const colId = event.column?.getColId();
      if (colId !== 'items' && colId !== 'pdf') this.selectedItem = event.data;
    },
  };

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
        title: 'Ver items',
      },
      valueGetter: (params) => params.data?.countItems ?? 0,
      cellStyle: { backgroundColor: '#e8f0fb', cursor: 'pointer' },
    },
    {
      field: 'numCotizacion', headerName: 'No. Docto', width: 130, editable: true,
    },
    {
      field: 'nombreProspecto', headerName: 'Prospecto', flex: 1, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.prospectos.map(p => p.nombre) }),
      valueSetter: (params) => {
        const p = this.prospectos.find(x => x.nombre === params.newValue);
        if (p) {
          params.data.nombreProspecto  = p.nombre;
          params.data.idProspecto      = p.id ?? '';
          params.data.empresaProspecto = (p as any).empresa ?? '';
          params.data.puestoProspecto  = (p as any).puesto  ?? '';
        } else {
          params.data.nombreProspecto = params.newValue;
        }
        return true;
      },
    },
    { field: 'lugar', headerName: 'Lugar', width: 160, editable: true },
    {
      field: 'familia', headerName: 'Familia', width: 150, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: ['', ...this.familias] }),
      cellRenderer: (p: any) => p.value
        ? `<span class="badge bg-info text-dark">${p.value}</span>`
        : `<span class="text-muted" style="font-size:.8em">Todas</span>`,
      tooltipValueGetter: () => 'Familia de materiales que se muestran en el detalle',
    },
    {
      field: 'estado', headerName: 'Estado', width: 130, editable: false,
      cellRenderer: (p: any) => {
        const e = ESTADOS_COTIZACION.find(x => x.value === p.value);
        return e ? `<span class="badge bg-${e.color}">${e.label}</span>` : (p.value ?? '');
      },
    },
    {
      field: 'total', headerName: 'Total', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toFixed(2)}` : '$0.00',
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'fecha', headerName: 'Fecha', width: 130, editable: false,
      cellRenderer: (p: any) => this.formatFecha(p.value),
    },
    { field: 'notas', headerName: 'Notas', flex: 1, editable: true },
  ];

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.actualizarContextoDetalle();
  }

  private actualizarContextoDetalle() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      context: { idCompany: this.root, config: this.config },
    });
  }

  // ── Cascade ───────────────────────────────────────────────────────────────

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
    api.forEachNode((n: any) => { if (n.expanded && n.id !== node.id) n.setExpanded(false); });
    api.forEachNode((n: any) => { if (n.id !== node.id) n.setRowHeight(0); });
    api.onRowHeightChanged();
    this.actualizarContextoDetalle();
    setTimeout(() => node.setExpanded(true), 0);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {}
  ngOnDestroy() { this.sub?.unsubscribe(); }

  cargarDatos() {
    this.loading = true;
    this.svc.getConfig(this.root).then(cfg => {
      this.config = cfg;
      this.actualizarContextoDetalle();
    });
    // Cargar familias del catálogo (type=FAMILY)
    this.catalogsSvc.getFamilyById(this.root).subscribe({
      next: (data: any[]) => {
        this.familias = data.map(f => f.description).sort();
      },
      error: () => { this.familias = []; },
    });
    this.sub = combineLatest([
      this.prospectosSvc.getProspectos(this.idVendedor),
      this.svc.getCotizaciones(this.idVendedor),
    ]).subscribe({
      next: ([prospectos, data]) => {
        this.prospectos = prospectos;
        this.rowData = data
          .filter(c => (c as any).activo !== false)
          .sort((a: any, b: any) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0))
          .map(c => {
            const p = prospectos.find(x => x.id === (c as any).idProspecto);
            return {
              ...c,
              puestoProspecto: (c as any).puestoProspecto || p?.puesto || '',
              countItems: (c as any).countItems ?? 0,
              total: (c as any).total ?? 0,
              __isNew: false, __modified: false,
            };
          });
        this.originalData = JSON.parse(JSON.stringify(this.rowData));
        this.hasUnsavedChanges = false;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async add() {
    const numCotizacion = await this.svc.getNextNumero(this.root);
    const nuevo: any = {
      numCotizacion,
      idProspecto:     '',
      nombreProspecto: '',
      empresaProspecto: '',
      puestoProspecto:  '',
      lugar:           this.config.lugarDefault ?? '',
      familia:         '',
      idVendedor:      this.idVendedor,
      nombreVendedor:  this.nombreVendedor,
      idCompany:       this.idCompany,
      fecha:           null,
      estado:          'borrador',
      notas:           '',
      total:           0,
      countItems:      0,
      activo:          true,
      __isNew:         true,
      __modified:      false,
    };
    this.rowData = [nuevo, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'numCotizacion' });
    }, 50);
  }

  async saveChanges() {
    const toSave = this.rowData.filter(c => c.__isNew || c.__modified);
    if (!toSave.length) return;
    const errores: string[] = [];
    for (const c of toSave) {
      if (!c.nombreProspecto?.trim()) { errores.push('Sin prospecto asignado'); continue; }
      try {
        if (c.__isNew) {
          await this.svc.crearCotizacion(c);
        } else {
          await this.svc.actualizarCotizacion(c.id!, {
            numCotizacion: c.numCotizacion ?? '',
            lugar:         c.lugar         ?? '',
            familia:       c.familia        ?? '',
            notas:         c.notas         ?? '',
          });
        }
      } catch { errores.push(`Error al guardar: ${c.nombreProspecto}`); }
    }
    if (errores.length) Swal.fire('Atención', errores.join('\n'), 'warning');
    else Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
  }

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasUnsavedChanges = false;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteSelected() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar cotización?', text: `Prospecto: ${this.selectedItem.nombreProspecto}`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    if (this.selectedItem.__isNew) {
      this.rowData = this.rowData.filter(c => c !== this.selectedItem);
      this.gridApi.setGridOption('rowData', this.rowData);
      if (!this.rowData.some(c => c.__isNew || c.__modified)) this.hasUnsavedChanges = false;
      this.selectedItem = null;
      return;
    }
    try {
      await this.svc.actualizarCotizacion(this.selectedItem.id!, { activo: false } as any);
      this.selectedItem = null;
      Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
    } catch { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
