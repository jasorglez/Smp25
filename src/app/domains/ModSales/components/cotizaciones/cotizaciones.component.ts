import { Component, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CotizacionesService, ESTADOS_COTIZACION, CotizacionConfig, CONFIG_DEFAULT, familiasDeCotizacion } from 'app/services/cotizaciones.service';
import { ProspectosService, Prospecto } from 'app/services/prospectos.service';
import { SignalsService } from 'app/services/signals.service';
import { CustomersService } from 'app/services/customers.service';
import { ICustomer } from 'app/interface/icustomer';
import { CatalogsService } from 'app/services/catalogs.service';
import { ButtonCellRendererIncomeComponent } from 'app/domains/ModAdmon/components/income/button-cell-renderer-income.component';
import { DetalleItemsCotizacionComponent } from './detalle-items-cotizacion.component';
import { ConfigCotizacionesComponent } from './config-cotizaciones.component';
import { combineLatest, firstValueFrom, Subscription } from 'rxjs';
import { TrackingService } from 'app/services/tracking.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererIncomeComponent, DetalleItemsCotizacionComponent, ConfigCotizacionesComponent],
  templateUrl: './cotizaciones.component.html',
  styleUrl: './cotizaciones.component.scss',
})
export class CotizacionesComponent implements OnInit, OnDestroy {
  private svc             = inject(CotizacionesService);
  private prospectosSvc   = inject(ProspectosService);
  private signalsSvc      = inject(SignalsService);
  private catalogsSvc     = inject(CatalogsService);
  private customersSvc    = inject(CustomersService);
  private trackingService = inject(TrackingService);

  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  rowData:          any[] = [];
  private allRowData: any[] = [];
  originalData:     any[] = [];
  selectedItem:     any   = null;
  hasUnsavedChanges = false;
  loading           = false;
  loadError         = '';
  showConfig        = false;

  tipoDestinatario: 'prospecto' | 'cliente' = 'prospecto';
  clientes: ICustomer[] = [];
  loadingClientes = false;
  clientesError = '';
  private clientesLoaded = false;
  private clientesRequest?: Promise<boolean>;
  private clientesGeneration = 0;

  prospectos: Prospecto[] = [];
  familias:   string[]    = [];   // familias disponibles para el selector
  filaFamilias: any = null;
  familiasMarcadas: string[] = [];
  opcionesFamilia: string[] = [];
  guardandoFamilias = false;
  estados = ESTADOS_COTIZACION;
  config: CotizacionConfig = { ...CONFIG_DEFAULT };

  root: number = null;
  private sub?: Subscription;
  private loadedSeller: number = null;

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get idCompany()      { return this.root; }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

  constructor() {
    effect(() => {
      const root = this.signalsSvc.getRootSelectedBySidebar()();
      const seller = this.idVendedor;
      const rootChanged = this.root !== root;
      const sellerChanged = this.loadedSeller !== seller;
      if (rootChanged || sellerChanged) {
        this.sub?.unsubscribe();
        this.filaFamilias = null;
        this.allRowData = [];
        this.rowData = [];
        this.originalData = [];
        this.hasUnsavedChanges = false;
      }
      if (rootChanged) {
        this.clientesGeneration++;
        this.clientes = [];
        this.clientesLoaded = false;
        this.clientesRequest = undefined;
        this.loadingClientes = false;
        this.clientesError = '';
        this.tipoDestinatario = 'prospecto';
      }
      this.root = root;
      if (this.root && (rootChanged || sellerChanged)) {
        this.loadedSeller = seller;
        this.sub?.unsubscribe();
        this.cargarDatos();
        this.actualizarContextoDetalle();
      }
    });
  }

  // ── Enter-key navigation ─────────────────────────────────────────────────
  private editableColumnOrder = ['numCotizacion', 'destinatario', 'lugar', 'tipoCambio', 'notas'];
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
    if (event.column.getColId() === 'tipoCambio' && event.data?.id && Number(event.data.tipoCambio) > 0) {
      void this.persistirTipoCambio(event.data);
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
    alwaysShowHorizontalScroll: true,
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
      headerName: 'Acción', colId: 'accion', width: 110, editable: false,
      cellRenderer: (p: any) => {
        if (p.data?.estado === 'aceptada' && p.data?.idProspecto) {
          return `<button class="btn btn-sm btn-success py-0 px-2" style="font-size:.75rem">🏆 Cerrar Venta</button>`;
        }
        if (p.data?.estado === 'rechazada' && p.data?.idProspecto) {
          return `<button class="btn btn-sm btn-danger py-0 px-2" style="font-size:.75rem">✗ Perdido</button>`;
        }
        return '<span class="text-muted" style="font-size:.75rem">—</span>';
      },
      onCellClicked: (p: any) => {
        if (p.data?.estado === 'aceptada' && p.data?.idProspecto) this.cerrarVenta(p.data);
        if (p.data?.estado === 'rechazada' && p.data?.idProspecto) this.marcarPerdido(p.data);
      },
      cellStyle: { cursor: 'pointer' },
    },
    {
      field: 'pdf', headerName: 'PDF', width: 70, pinned: 'right', lockPinned: true, suppressMovable: true, editable: false,
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
      colId: 'tipoDestinatario', headerName: 'Tipo', width: 115,
      valueGetter: p => this.esCliente(p.data) ? 'Cliente' : 'Prospecto',
    },
    {
      colId: 'destinatario', headerName: 'Prospecto / Cliente', minWidth: 360, width: 400, flex: 1, editable: true,
      valueGetter: p => this.esCliente(p.data) ? String(p.data.idCliente ?? '') : (p.data?.idProspecto ?? ''),
      valueFormatter: p => p.data?.nombreProspecto || p.data?.empresaProspecto || '',
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: (params: any) => ({
        values: this.esCliente(params.data)
          ? () => this.cargarClientes().then(ok => ok ? this.clientes.map(c => String(c.id)) : [])
          : this.prospectos.filter(p => p.activo !== false)
              .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')).map(p => p.id),
        formatValue: (id: string) => this.nombreDestinatario(params.data, id),
        allowTyping: true,
        filterList: true,
        searchType: 'match',
        highlightMatch: true,
        valueListMaxHeight: 360,
        valueListMaxWidth: 520,
      }),
      valueSetter: params => this.asignarDestinatario(params.data, params.newValue),
    },
    { field: 'lugar', headerName: 'Lugar', width: 160, editable: true },
    {
      field: 'tipoCambio', headerName: 'Tipo de cambio', width: 145, editable: true, type: 'numericColumn',
      cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0.0001, precision: 4 },
      valueSetter: p => {
        const rate = Number(p.newValue);
        if (!Number.isFinite(rate) || rate <= 0) return false;
        p.data.tipoCambio = rate;
        p.data.totalDolares = null;
        if (this.detalleActivo?.cotizacion?.id === p.data.id) {
          this.detalleActivo.aplicarTipoCambio(rate);
        }
        this.gridApi?.refreshCells({ rowNodes: [p.node], columns: ['totalDolares'], force: true });
        return true;
      },
      valueFormatter: p => Number(p.value) > 0 ? Number(p.value).toFixed(4) : 'Capturar',
      headerTooltip: 'Pesos mexicanos por dólar (MXN/USD), aplicable a toda la cotización',
    },
    {
      colId: 'familias', headerName: 'Familias', width: 220, editable: false,
      valueGetter: p => familiasDeCotizacion(p.data).join(', ') || 'Todas',
      onCellClicked: p => this.abrirFamilias(p.data),
      cellStyle: { cursor: 'pointer' },
      headerTooltip: 'Haz clic en una celda para elegir una o varias familias de materiales',
      tooltipValueGetter: p => familiasDeCotizacion(p.data).join(', ') || 'Todas las familias',
    },
    {
      field: 'estado', headerName: 'Estado', width: 130, editable: false,
      cellRenderer: (p: any) => {
        const e = ESTADOS_COTIZACION.find(x => x.value === p.value);
        return e ? `<span class="badge bg-${e.color}">${e.label}</span>` : (p.value ?? '');
      },
    },
    {
      field: 'total', headerName: 'Total MXN', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toFixed(2)}` : '$0.00',
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'totalDolares', headerName: 'Total USD', width: 130, editable: false, type: 'numericColumn',
      valueGetter: p => Number(p.data?.tipoCambio) > 0
        ? (p.data?.totalDolares != null
          ? Number(p.data.totalDolares)
          : Number((Number(p.data?.total ?? 0) / Number(p.data.tipoCambio)).toFixed(2)))
        : null,
      valueFormatter: (p) => p.value == null ? '—' : `US$${Number(p.value).toFixed(2)}`,
      headerTooltip: 'Suma de importes USD; admite ajustes manuales en el detalle',
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

  mostrarColumna(field: string): void {
    this.gridApi?.ensureColumnVisible(field, field === 'tipoCambio' ? 'end' : 'start');
  }

  private detalleActivo: DetalleItemsCotizacionComponent | null = null;

  actualizarConfiguracion(config: CotizacionConfig): void {
    this.config = { ...config };
    this.actualizarContextoDetalle();
    if (this.detalleActivo?.mode === 'pdf') {
      this.gridApi?.forEachNode(node => {
        if (node.expanded && node.data?.id === this.detalleActivo?.cotizacion?.id) {
          void this.detalleActivo.generarPdf();
        }
      });
    }
  }

  abrirFamilias(cotizacion: any): void {
    if (!cotizacion) return;
    this.filaFamilias = cotizacion;
    this.familiasMarcadas = [...familiasDeCotizacion(cotizacion)];
    this.opcionesFamilia = [...new Set([...this.familias, ...this.familiasMarcadas])].sort((a, b) => a.localeCompare(b, 'es'));
  }

  alternarFamilia(familia: string, checked: boolean): void {
    this.familiasMarcadas = checked
      ? [...this.familiasMarcadas, familia]
      : this.familiasMarcadas.filter(item => item !== familia);
  }

  cerrarFamilias(): void {
    this.filaFamilias = null;
  }

  async aplicarFamilias(): Promise<void> {
    const cotizacion = this.filaFamilias;
    if (!cotizacion || this.guardandoFamilias) return;
    const familias = [...this.familiasMarcadas];
    const familia = familias.length === 1 ? familias[0] : '';
    this.guardandoFamilias = true;
    try {
      if (cotizacion.id && !cotizacion.__isNew) {
        await this.svc.actualizarCotizacion(cotizacion.id, { familias, familia });
      }
      cotizacion.familias = familias;
      cotizacion.familia = familia;
      if (this.detalleActivo?.cotizacion?.id === cotizacion.id) {
        this.detalleActivo.actualizarFamilias(familias);
      }
      this.gridApi?.refreshCells({ columns: ['familias'], force: true });
      this.cerrarFamilias();
    } catch (error) {
      console.error('[Cotizaciones] Error al guardar familias:', error);
      Swal.fire('Error', 'No se pudieron guardar las familias.', 'error');
    } finally {
      this.guardandoFamilias = false;
    }
  }

  private async persistirTipoCambio(cotizacion: any): Promise<void> {
    try {
      if (this.detalleActivo?.cotizacion?.id === cotizacion.id) {
        if (!(await this.detalleActivo.guardarCambiosPendientes())) return;
      }
      const items = await this.svc.getItems(cotizacion.id);
      const rate = Number(cotizacion.tipoCambio);
      const totalDolares = items.reduce((sum, item) => sum + (item.dolaresManual
        ? Number(item.dolares ?? 0)
        : Number((Number(item.subtotal ?? 0) / rate).toFixed(2))), 0);
      cotizacion.totalDolares = Math.round(totalDolares * 100) / 100;
      await this.svc.actualizarCotizacion(cotizacion.id, {
        tipoCambio: rate,
        totalDolares: cotizacion.totalDolares,
      });
      this.gridApi?.refreshCells({ columns: ['totalDolares'], force: true });
    } catch (error) {
      console.error('[Cotizaciones] Error guardando tipo de cambio:', error);
      Swal.fire('Error', 'No se pudo guardar el tipo de cambio.', 'error');
    }
  }

  private actualizarContextoDetalle() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      context: {
        idCompany: this.root,
        config: this.config,
        registrarDetalle: (detalle: DetalleItemsCotizacionComponent) => { this.detalleActivo = detalle; },
        cerrarDetalle: (node: any, detalle: DetalleItemsCotizacionComponent) => this.cerrarDetalle(node, detalle),
      },
    });
  }

  private cerrarDetalle(node: any, detalle: DetalleItemsCotizacionComponent): void {
    if (!this.gridApi || !node) return;
    this.gridApi.stopEditing();
    node.setExpanded(false);
    this.gridApi.forEachNode((row: any) => row.setRowHeight(undefined));
    this.gridApi.onRowHeightChanged();
    if (this.detalleActivo === detalle) this.detalleActivo = null;
  }

  // ── Cascade ───────────────────────────────────────────────────────────────

  async toggleCascadeWithMode(node: any, mode: 'items' | 'pdf') {
    const api = this.gridApi;
    api.stopEditing();
    const isExpanded = node.expanded;
    const sameMode = isExpanded && node.data?.__mode === mode;

    if (isExpanded && this.detalleActivo?.cotizacion?.id === node.data?.id) {
      if (!(await this.detalleActivo.guardarCambiosPendientes())) return;
    }

    if (sameMode) {
      node.setExpanded(false);
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
      return;
    }

    if (isExpanded) node.setExpanded(false);
    node.data.__mode = mode;
    api.forEachNode((n: any) => { if (n.expanded && n.id !== node.id) n.setExpanded(false); });
    api.forEachNode((n: any) => { if (n.id !== node.id) n.setRowHeight(0); });
    api.onRowHeightChanged();
    this.actualizarContextoDetalle();
    setTimeout(() => node.setExpanded(true), 0);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {}
  ngOnDestroy() { this.sub?.unsubscribe(); this.clientesGeneration++; }

  cargarDatos() {
    this.sub?.unsubscribe();
    this.loading = true;
    this.loadError = '';
    this.selectedItem = null;
    this.svc.getConfig(this.root).then(cfg => {
      this.config = cfg;
      this.actualizarContextoDetalle();
    }).catch(error => {
      console.error('Error al cargar la configuración de cotizaciones:', error);
      this.config = { ...CONFIG_DEFAULT };
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
      this.svc.getCotizaciones(this.idVendedor, this.root),
    ]).subscribe({
      next: ([prospectos, data]) => {
        this.prospectos = prospectos;
        const remoteRows = data
          .filter(c => (c as any).activo !== false)
          .sort((a: any, b: any) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0))
          .map(c => {
            const p = prospectos.find(x => x.id === (c as any).idProspecto);
            return {
              ...c,
              tipoDestinatario: c.idCliente ? 'cliente' : 'prospecto',
              puestoProspecto: (c as any).puestoProspecto || p?.puesto || '',
              countItems: (c as any).countItems ?? 0,
              total: (c as any).total ?? 0,
              totalDolares: c.totalDolares ?? 0,
              __isNew: false, __modified: false,
            };
          });
        const pendingRows = this.allRowData.filter(row => row.__isNew || row.__modified);
        this.allRowData = [
          ...remoteRows.map(remote => pendingRows.find(local => local.id && local.id === remote.id) ?? remote),
          ...pendingRows.filter(local => !local.id || !remoteRows.some(remote => remote.id === local.id)),
        ];
        this.originalData = JSON.parse(JSON.stringify(remoteRows));
        this.actualizarVistaCotizaciones();
        this.hasUnsavedChanges = this.allRowData.some(row => row.__isNew || row.__modified);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar cotizaciones:', error);
        this.rowData = [];
        this.originalData = [];
        this.loading = false;
        this.loadError = 'No se pudieron cargar las cotizaciones de Firebase. Intenta nuevamente.';
      },
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async add() {
    if (!this.root || !this.idVendedor || this.loading) return;
    const root = this.root;
    const idVendedor = this.idVendedor;
    const tipoDestinatario = this.tipoDestinatario;
    if (tipoDestinatario === 'cliente' && !await this.cargarClientes()) return;
    if (root !== this.root || idVendedor !== this.idVendedor) return;
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nueva cotización', 'Ventas', this.trackingService.getEmail());
    const numCotizacion = await this.svc.getNextNumero(this.root);
    if (root !== this.root || idVendedor !== this.idVendedor) return;
    const nuevo: any = {
      numCotizacion,
      tipoDestinatario,
      idCliente: null,
      idProspecto:     '',
      nombreProspecto: '',
      empresaProspecto: '',
      puestoProspecto:  '',
      lugar:           this.config.lugarDefault ?? '',
      familia:         '',
      familias:        [],
      idVendedor:      this.idVendedor,
      nombreVendedor:  this.nombreVendedor,
      idCompany:       this.idCompany,
      fecha:           null,
      estado:          'borrador',
      notas:           '',
      total:           0,
      totalDolares:    0,
      tipoCambio:      0,
      countItems:      0,
      activo:          true,
      __isNew:         true,
      __modified:      false,
    };
    this.allRowData = [nuevo, ...this.allRowData];
    this.actualizarVistaCotizaciones();
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'numCotizacion' });
    }, 50);
  }

  async saveChanges() {
    this.gridApi?.stopEditing();
    const toSave = this.rowData.filter(c => c.__isNew || c.__modified);
    if (!toSave.length) return;
    const newCount  = toSave.filter(c => c.__isNew).length;
    const editCount = toSave.filter(c => !c.__isNew && c.__modified).length;
    const desc = [newCount  ? `Creó ${newCount} cotización(es)` : '', editCount ? `Editó ${editCount} cotización(es)` : ''].filter(Boolean).join(' | ');
    this.trackingService.addLog(this.trackingService.getnameComp(), desc, 'Ventas', this.trackingService.getEmail());
    const errores: string[] = [];
    for (const c of toSave) {
      if (!c.nombreProspecto?.trim() || (this.esCliente(c) ? !c.idCliente : (c.__isNew && !c.idProspecto))) {
        errores.push(`Selecciona un ${this.esCliente(c) ? 'cliente' : 'prospecto'} para ${c.numCotizacion}.`);
        continue;
      }
      try {
        if (c.__isNew) {
          c.id = await this.svc.crearCotizacion(c);
          c.__isNew = false;
          this.detalleActivo?.actualizarMaestroGuardado(c);
        } else {
          await this.svc.actualizarCotizacion(c.id!, {
            tipoDestinatario: this.esCliente(c) ? 'cliente' : 'prospecto',
            idCliente: this.esCliente(c) ? c.idCliente : null,
            idProspecto: this.esCliente(c) ? '' : (c.idProspecto ?? ''),
            nombreProspecto: c.nombreProspecto ?? '',
            empresaProspecto: c.empresaProspecto ?? '',
            puestoProspecto: c.puestoProspecto ?? '',
            numCotizacion: c.numCotizacion ?? '',
            lugar:         c.lugar         ?? '',
            familia:       c.familia        ?? '',
            familias:      familiasDeCotizacion(c),
            tipoCambio:    Number(c.tipoCambio) || 0,
            notas:         c.notas         ?? '',
          });
        }
        c.__isNew = false;
        c.__modified = false;
      } catch { errores.push(`Error al guardar: ${c.nombreProspecto}`); }
    }
    if (errores.length) Swal.fire('Atención', errores.join('\n'), 'warning');
    else Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Guardado', showConfirmButton: false, timer: 2000, timerProgressBar: true });
  }

  revertChanges() {
    this.allRowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasUnsavedChanges = false;
    this.actualizarVistaCotizaciones();
  }

  async deleteSelected() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar cotización?', text: `${this.esCliente(this.selectedItem) ? 'Cliente' : 'Prospecto'}: ${this.selectedItem.nombreProspecto}`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    this.trackingService.addLog(this.trackingService.getnameComp(), `Eliminó cotización #${this.selectedItem.numCotizacion} — ${this.selectedItem.nombreProspecto}`, 'Ventas', this.trackingService.getEmail());
    if (this.selectedItem.__isNew) {
      this.allRowData = this.allRowData.filter(c => c !== this.selectedItem);
      this.actualizarVistaCotizaciones();
      this.hasUnsavedChanges = this.allRowData.some(c => c.__isNew || c.__modified);
      this.selectedItem = null;
      return;
    }
    try {
      await this.svc.actualizarCotizacion(this.selectedItem.id!, { activo: false } as any);
      this.selectedItem = null;
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
  }

  // ── Vinculación CRM ───────────────────────────────────────────────────────

  async cerrarVenta(cot: any) {
    const res = await Swal.fire({
      icon: 'question',
      title: '¿Cerrar Venta?',
      html: `Se marcará el prospecto <b>${cot.nombreProspecto}</b> como <b>🏆 Ganado</b>.<br>
             <small class="text-muted">Cotización: ${cot.numCotizacion}</small>`,
      showCancelButton: true,
      confirmButtonColor: '#198754',
      confirmButtonText: '🏆 Sí, cerrar venta',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    try {
      await this.prospectosSvc.cambiarEstado(
        cot.idProspecto, 'ganado', this.idVendedor, this.nombreVendedor
      );
      await this.prospectosSvc.registrarInteraccion(cot.idProspecto, {
        tipo:           'cotizacion_aceptada',
        descripcion:    `Cotización ${cot.numCotizacion} aceptada — Venta cerrada`,
        idVendedor:     this.idVendedor,
        nombreVendedor: this.nombreVendedor,
        resultado:      'positivo',
      });
      // Refrescar fila
      this.gridApi.forEachNode((node: any) => {
        if (node.data?.id === cot.id) {
          node.setData({ ...node.data, _vendido: true });
        }
      });
      Swal.fire({
        icon: 'success',
        title: '¡Venta cerrada!',
        html: `<b>${cot.nombreProspecto}</b> marcado como <b>🏆 Ganado</b>`,
        timer: 2000, showConfirmButton: false,
      });
    } catch {
      Swal.fire('Error', 'No se pudo actualizar el prospecto.', 'error');
    }
  }

  async marcarPerdido(cot: any) {
    const { value: motivo } = await Swal.fire({
      icon: 'warning',
      title: '¿Marcar como Perdido?',
      html: `Prospecto: <b>${cot.nombreProspecto}</b>`,
      input: 'select',
      inputOptions: {
        'precio':       'Precio muy alto',
        'competidor':   'Eligió al competidor',
        'timing':       'No era el momento',
        'sin_respuesta':'Sin respuesta del cliente',
        'otro':         'Otro motivo',
      },
      inputPlaceholder: 'Motivo (opcional)',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: '✗ Marcar Perdido',
      cancelButtonText: 'Cancelar',
    });
    if (motivo === undefined) return; // cancelled
    const motivoTexto: Record<string, string> = {
      precio: 'Precio muy alto', competidor: 'Eligió al competidor',
      timing: 'No era el momento', sin_respuesta: 'Sin respuesta del cliente', otro: 'Otro',
    };
    try {
      await this.prospectosSvc.cambiarEstado(
        cot.idProspecto, 'perdido', this.idVendedor, this.nombreVendedor
      );
      await this.prospectosSvc.registrarInteraccion(cot.idProspecto, {
        tipo:           'cotizacion_rechazada',
        descripcion:    `Cotización ${cot.numCotizacion} rechazada${motivo ? ' — ' + motivoTexto[motivo] : ''}`,
        idVendedor:     this.idVendedor,
        nombreVendedor: this.nombreVendedor,
        resultado:      'negativo',
      });
      Swal.fire({ icon: 'info', title: 'Prospecto marcado como Perdido', timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo actualizar el prospecto.', 'error');
    }
  }

  esCliente(cotizacion: any): boolean {
    return !!cotizacion?.idCliente || cotizacion?.tipoDestinatario === 'cliente';
  }

  onTipoDestinatarioChange() {
    this.actualizarVistaCotizaciones();
    if (this.tipoDestinatario === 'cliente') void this.cargarClientes();
  }

  private actualizarVistaCotizaciones(): void {
    this.rowData = this.allRowData.filter(row =>
      this.esCliente(row) === (this.tipoDestinatario === 'cliente'),
    );
    this.selectedItem = null;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  cargarClientes(): Promise<boolean> {
    if (!this.root) return Promise.resolve(false);
    if (this.clientesLoaded) return Promise.resolve(true);
    if (this.clientesRequest) return this.clientesRequest;
    const generation = this.clientesGeneration;
    this.loadingClientes = true;
    this.clientesError = '';
    this.clientesRequest = firstValueFrom(this.customersSvc.getCustomersByCompany(this.root)).then((response: any) => {
      if (generation !== this.clientesGeneration) return false;
      const data = response?.data ?? response;
      if (!Array.isArray(data)) throw new Error('Respuesta de clientes inválida');
      this.clientes = data.filter(c => c.id && c.active !== false && c.active !== 0)
        .sort((a, b) => (a.nameContact || a.company || '').localeCompare(b.nameContact || b.company || '', 'es'));
      this.clientesLoaded = true;
      return true;
    }).catch(error => {
      if (generation === this.clientesGeneration) {
        console.error('Error al cargar clientes para cotizaciones:', error);
        this.clientesError = 'No se pudieron cargar los clientes de la empresa. Intenta nuevamente.';
      }
      return false;
    }).finally(() => {
      if (generation === this.clientesGeneration) {
        this.loadingClientes = false;
        this.clientesRequest = undefined;
      }
    });
    return this.clientesRequest;
  }

  private nombreDestinatario(cotizacion: any, id: string): string {
    if (this.esCliente(cotizacion)) {
      const cliente = this.clientes.find(c => String(c.id) === String(id));
      return cliente ? (cliente.company && cliente.nameContact && cliente.company !== cliente.nameContact
        ? `${cliente.company} · Contacto: ${cliente.nameContact}`
        : cliente.company || cliente.nameContact || '')
        : (cotizacion.nombreProspecto || '');
    }
    const prospecto = this.prospectos.find(p => p.id === id);
    return prospecto ? (prospecto.empresa && prospecto.nombre && prospecto.empresa !== prospecto.nombre
      ? `${prospecto.nombre} · Empresa: ${prospecto.empresa}`
      : prospecto.nombre || prospecto.empresa || '')
      : (cotizacion.nombreProspecto || '');
  }

  private asignarDestinatario(cotizacion: any, id: string): boolean {
    if (this.esCliente(cotizacion)) {
      const cliente = this.clientes.find(c => String(c.id) === String(id));
      if (!cliente) return false;
      Object.assign(cotizacion, {
        tipoDestinatario: 'cliente', idCliente: Number(cliente.id), idProspecto: '',
        nombreProspecto: cliente.nameContact || cliente.company || '',
        empresaProspecto: cliente.company || '', puestoProspecto: cliente.position || '',
      });
    } else {
      const prospecto = this.prospectos.find(p => p.id === id);
      if (!prospecto) return false;
      Object.assign(cotizacion, {
        tipoDestinatario: 'prospecto', idCliente: null, idProspecto: prospecto.id,
        nombreProspecto: prospecto.nombre || '', empresaProspecto: prospecto.empresa || '',
        puestoProspecto: prospecto.puesto || '',
      });
    }
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

