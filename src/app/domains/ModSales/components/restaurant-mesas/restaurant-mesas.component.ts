import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { RestaurantMesasService } from 'app/services/restaurant-mesas.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
pdfMake.vfs = (pdfFonts as any).vfs;

@Component({
  selector: 'app-restaurant-mesas',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './restaurant-mesas.component.html',
  styleUrl: './restaurant-mesas.component.scss',
})
export class RestaurantMesasComponent implements OnInit {
  private signalsService      = inject(SignalsService);
  private restaurantService   = inject(RestaurantMesasService);
  private rootService         = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  idCompany  = 0;
  activeTab: 'mesas' | 'impresoras' | 'reporte' = 'mesas';

  // ── Grid global options ────────────────────────────────────────────────────
  private enterPressed = false;

  gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    defaultColDef: {
      sortable: true,
      resizable: true,
      minWidth: 80,
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.mesasGridApi) this.mesasGridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  impresorasGridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    defaultColDef: {
      sortable: true,
      resizable: true,
      minWidth: 80,
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.impresorasGridApi) this.impresorasGridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  // ── Mesas ──────────────────────────────────────────────────────────────────
  mesasRowData: any[]            = [];
  private mesasGridApi!: GridApi;
  mesasGridApiReady              = false;
  selectedMesa: any              = null;
  hasUnsavedMesas           = false;
  private mesasTempCounter  = 0;
  private editableColumnOrderMesas = ['nombre', 'capacidad', 'activo'];

  mesasColDefs: ColDef[] = [
  //  { field: 'id',     headerName: 'ID',       width: 70,  editable: false },
    { field: 'nombre', headerName: 'Nombre',   flex: 1,    editable: true },
    { field: 'capacidad', headerName: 'Capacidad', width: 110, editable: true,
      valueFormatter: (p: any) => p.value != null ? `${p.value} pers.` : '',
    },
    {
      field: 'activo', headerName: 'Activo', width: 90, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      cellRenderer: (p: any) => p.value ? '✅ Sí' : '❌ No',
    },
    {
      field: 'tieneCuentaAbierta', headerName: 'Estado', width: 120, editable: false,
      cellRenderer: (p: any) => (p.value && (p.data?.totalActual ?? 0) > 0) ? '🔴 Ocupada' : '🟢 Libre',
    },
    {
      field: 'totalActual', headerName: 'Total Actual', width: 130, editable: false,
      valueFormatter: (p: any) => p.value ? `$${Number(p.value).toFixed(2)}` : '',
    },
    { field: 'numItems', headerName: 'Ítems', width: 80, editable: false },
  ];

  // ── Impresoras ─────────────────────────────────────────────────────────────
  impresorasRowData: any[]              = [];
  private impresorasGridApi!: GridApi;
  impresorasGridApiReady                = false;
  selectedImpresora: any                = null;
  hasUnsavedImpresoras            = false;
  private impresorasTempCounter   = 0;
  private editableColumnOrderImpr = ['nombre', 'ipAddress', 'puerto', 'activo'];

  impresorasColDefs: ColDef[] = [
    { field: 'id',        headerName: 'ID',            width: 70,  editable: false },
    { field: 'nombre',    headerName: 'Nombre',        flex: 1,    editable: true },
    { field: 'ipAddress', headerName: 'Dirección IP',  flex: 1,    editable: true },
    { field: 'puerto',    headerName: 'Puerto',        width: 100, editable: true },
    {
      field: 'activo', headerName: 'Activo', width: 90, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      cellRenderer: (p: any) => p.value ? '✅ Sí' : '❌ No',
    },
  ];

  // ── Constructor + ciclo de vida ───────────────────────────────────────────
  constructor() {
    effect(() => {
      const id = this.signalsService.getRootSelectedBySidebar()();
      if (id) {
        this.idCompany = id;
        this.loadMesas();
        this.loadImpresoras();
      }
    });
  }

  ngOnInit() {
    // Fallback: si el effect ya disparó antes de que el componente existiera
    const id = this.signalsService.getRootSelectedBySidebar()();
    if (id && id !== this.idCompany) {
      this.idCompany = id;
      this.loadMesas();
      this.loadImpresoras();
    }
  }

  // ── Mesas ──────────────────────────────────────────────────────────────────
  onMesasGridReady(e: GridReadyEvent) { this.mesasGridApi = e.api; this.mesasGridApiReady = true; }
  onMesaRowClicked(e: any)            { this.selectedMesa = e.data; }

  mesasError    = '';
  impresorasError = '';

  loadMesas() {
    if (!this.idCompany) return;
    this.mesasError = '';
    this.restaurantService.getMesas(this.idCompany).subscribe({
      next: data => {
        this.mesasRowData = (data ?? []).map(m => ({ ...m, __isNew: false, __modified: false }));
      },
      error: err => {
        console.error('Error cargando mesas', err);
        const status = err?.status;
        if (status === 403 || status === 401) {
          this.mesasError = '⚠️ Sin permisos de BD — ejecuta: GRANT SELECT,INSERT,UPDATE,DELETE ON SCHEMA::restaurant TO Microservicio;';
        } else {
          this.mesasError = `Error ${status ?? ''}: ${err?.error?.message ?? 'No se pudieron cargar las mesas'}`;
        }
      },
    });
  }

  addMesa() {
    const temp: string = `temp_${this.mesasTempCounter++}`;
    const row: any = {
      id: temp, idCompany: this.idCompany,
      nombre: '', capacidad: null, activo: true,
      tieneCuentaAbierta: false, totalActual: 0, numItems: 0,
      __isNew: true, __modified: false,
    };
    this.mesasRowData = [row, ...this.mesasRowData];
    this.mesasGridApi?.setGridOption('rowData', this.mesasRowData);
    this.hasUnsavedMesas = true;
    setTimeout(() => this.mesasGridApi?.startEditingCell({ rowIndex: 0, colKey: 'nombre' }), 50);
  }

  onMesaCellValueChanged(e: any) {
    if (!e.data.__isNew) e.data.__modified = true;
    this.hasUnsavedMesas = true;
  }

  onMesaCellEditingStopped(e: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrderMesas.indexOf(e.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrderMesas.length - 1) {
      setTimeout(() => {
        this.mesasGridApi?.startEditingCell({
          rowIndex: e.rowIndex,
          colKey: this.editableColumnOrderMesas[idx + 1],
        });
      }, 100);
    }
  }

  async saveMesas() {
    this.mesasGridApi?.stopEditing();
    const newRows      = this.mesasRowData.filter(r => r.__isNew);
    const modifiedRows = this.mesasRowData.filter(r => r.__modified && !r.__isNew);

    if (!newRows.length && !modifiedRows.length) {
      Swal.fire({ icon: 'info', title: 'Sin cambios', timer: 1200, showConfirmButton: false });
      return;
    }

    try {
      for (const row of newRows) {
        const { id, __isNew, __modified, tieneCuentaAbierta, totalActual, idCuentaActual, numItems, ...data } = row;
        await this.restaurantService.createMesa({ ...data, idCompany: this.idCompany }).toPromise();
      }
      for (const row of modifiedRows) {
        const { __isNew, __modified, tieneCuentaAbierta, totalActual, idCuentaActual, numItems, ...data } = row;
        await this.restaurantService.updateMesa(row.id, data).toPromise();
      }
      this.hasUnsavedMesas = false;
      this.loadMesas();
    } catch {
      Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  revertMesas() {
    this.loadMesas();
    this.hasUnsavedMesas = false;
  }

  deleteMesa() {
    if (!this.selectedMesa) {
      Swal.fire({ icon: 'warning', title: 'Selecciona una mesa', timer: 1500, showConfirmButton: false });
      return;
    }
    const row = this.selectedMesa;

    // Fila nueva no guardada → quitar del grid sin llamar a la API
    if (typeof row.id === 'string') {
      this.mesasRowData = this.mesasRowData.filter(r => r.id !== row.id);
      this.mesasGridApi?.setGridOption('rowData', this.mesasRowData);
      this.selectedMesa = null;
      if (!this.mesasRowData.some(r => r.__isNew || r.__modified)) this.hasUnsavedMesas = false;
      return;
    }

    Swal.fire({
      title: '¿Eliminar mesa?', text: `"${row.nombre}"`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    }).then(res => {
      if (!res.isConfirmed) return;
      this.restaurantService.deleteMesa(row.id).subscribe({
        next: () => { this.selectedMesa = null; this.loadMesas(); },
        error: () => Swal.fire('Error', 'No se pudo eliminar. Puede tener cuentas activas.', 'error'),
      });
    });
  }

  // ── Impresoras ─────────────────────────────────────────────────────────────
  onImpresorasGridReady(e: GridReadyEvent) { this.impresorasGridApi = e.api; this.impresorasGridApiReady = true; }
  onImpresoraRowClicked(e: any)            { this.selectedImpresora = e.data; }

  loadImpresoras() {
    if (!this.idCompany) return;
    this.impresorasError = '';
    this.restaurantService.getImpresoras(this.idCompany).subscribe({
      next: data => {
        this.impresorasRowData = (data ?? []).map(i => ({ ...i, __isNew: false, __modified: false }));
      },
      error: err => {
        console.error('Error cargando impresoras', err);
        this.impresorasError = `Error ${err?.status ?? ''}: ${err?.error?.message ?? 'No se pudieron cargar las impresoras'}`;
      },
    });
  }

  addImpresora() {
    const temp: string = `temp_${this.impresorasTempCounter++}`;
    const row: any = {
      id: temp, idCompany: this.idCompany,
      nombre: '', ipAddress: '', puerto: 9100, activo: true,
      __isNew: true, __modified: false,
    };
    this.impresorasRowData = [row, ...this.impresorasRowData];
    this.impresorasGridApi?.setGridOption('rowData', this.impresorasRowData);
    this.hasUnsavedImpresoras = true;
    setTimeout(() => this.impresorasGridApi?.startEditingCell({ rowIndex: 0, colKey: 'nombre' }), 50);
  }

  onImpresoraCellValueChanged(e: any) {
    if (!e.data.__isNew) e.data.__modified = true;
    this.hasUnsavedImpresoras = true;
  }

  onImpresoraCellEditingStopped(e: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrderImpr.indexOf(e.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrderImpr.length - 1) {
      setTimeout(() => {
        this.impresorasGridApi?.startEditingCell({
          rowIndex: e.rowIndex,
          colKey: this.editableColumnOrderImpr[idx + 1],
        });
      }, 100);
    }
  }

  async saveImpresoras() {
    this.impresorasGridApi?.stopEditing();
    const newRows      = this.impresorasRowData.filter(r => r.__isNew);
    const modifiedRows = this.impresorasRowData.filter(r => r.__modified && !r.__isNew);

    if (!newRows.length && !modifiedRows.length) {
      Swal.fire({ icon: 'info', title: 'Sin cambios', timer: 1200, showConfirmButton: false });
      return;
    }

    try {
      for (const row of newRows) {
        const { id, __isNew, __modified, ...data } = row;
        await this.restaurantService.createImpresora({ ...data, idCompany: this.idCompany }).toPromise();
      }
      for (const row of modifiedRows) {
        const { __isNew, __modified, ...data } = row;
        await this.restaurantService.updateImpresora(row.id, data).toPromise();
      }
      this.hasUnsavedImpresoras = false;
      this.loadImpresoras();
    } catch {
      Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  revertImpresoras() {
    this.loadImpresoras();
    this.hasUnsavedImpresoras = false;
  }

  deleteImpresora() {
    if (!this.selectedImpresora) {
      Swal.fire({ icon: 'warning', title: 'Selecciona una impresora', timer: 1500, showConfirmButton: false });
      return;
    }
    const row = this.selectedImpresora;

    if (typeof row.id === 'string') {
      this.impresorasRowData = this.impresorasRowData.filter(r => r.id !== row.id);
      this.impresorasGridApi?.setGridOption('rowData', this.impresorasRowData);
      this.selectedImpresora = null;
      if (!this.impresorasRowData.some(r => r.__isNew || r.__modified)) this.hasUnsavedImpresoras = false;
      return;
    }

    Swal.fire({
      title: '¿Eliminar impresora?', text: `"${row.nombre}"`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    }).then(res => {
      if (!res.isConfirmed) return;
      this.restaurantService.deleteImpresora(row.id).subscribe({
        next: () => { this.selectedImpresora = null; this.loadImpresoras(); },
        error: () => Swal.fire('Error', 'No se pudo eliminar la impresora.', 'error'),
      });
    });
  }

  // ── Reporte de Mesas ───────────────────────────────────────────────────────

  reporteFecha: string = new Date().toISOString().substring(0, 10);
  reporteRowData:   any[] = [];
  reporteItemsData: any[] = [];        // todos los ítems del día (o filtrados por mesa)
  reporteItemsAll:  any[] = [];        // todos los ítems sin filtrar
  reporteFiltraMesa: string | null = null;
  reporteMesaMayor: any = null;
  reporteError   = '';
  reporteLoading = false;
  reporteTotal   = 0;
  reporteCuentas = 0;
  private reporteGridApi!: GridApi;
  private reporteItemsGridApi!: GridApi;

  // Grid MESAS — sin master-detail, simple
  reporteGridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    defaultColDef: { sortable: true, resizable: true, minWidth: 60 },
  };

  reporteColDefs: ColDef[] = [
    { field: 'orden',          headerName: '#',       width: 45, editable: false,
      cellStyle: { textAlign: 'center', fontWeight: 'bold' } },
    { field: 'nombreMesa',     headerName: 'Mesa',    flex: 2,   editable: false },
    { field: 'abiertaAt',      headerName: 'Apertura',width: 75, editable: false,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '' },
    { field: 'cerradaAt',      headerName: 'Cobrada', width: 75, editable: false,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '' },
    { field: 'minutosAtencion',headerName: 'Tiempo',  width: 80, editable: false,
      valueFormatter: (p: any) => { const m = p.value ?? 0; return m >= 60 ? `${Math.floor(m/60)}h ${m%60}min` : `${m}min`; },
      cellStyle: (p: any) => p.value > 90 ? { color: '#c0392b', fontWeight: 'bold' } : {} },
    { field: 'total', headerName: 'Total', width: 100, editable: false,
      valueFormatter: (p: any) => p.value != null ? `$${Number(p.value).toFixed(2)}` : '',
      cellStyle: { textAlign: 'right', fontWeight: 'bold', color: '#1a6b2b' } },
  ];

  // Grid PRODUCTOS — siempre visible
  reporteItemsGridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    defaultColDef: { sortable: true, resizable: true, minWidth: 60 },
  };

  reporteItemsColDefs: ColDef[] = [
    { field: 'nombreMesa',     headerName: 'Mesa',     width: 90,  editable: false,
      cellStyle: { fontWeight: '600', color: '#2c3e50' } },
    { field: 'descripcion',    headerName: 'Producto', flex: 2,    editable: false },
    { field: 'cantidad',       headerName: 'Cant.',    width: 65,  editable: false,
      cellStyle: { textAlign: 'center', fontWeight: 'bold' },
      valueFormatter: (p: any) => Number(p.value) % 1 === 0 ? String(Number(p.value)) : Number(p.value).toFixed(1) },
    { field: 'precioUnitario', headerName: 'P.Unit.',  width: 85,  editable: false,
      cellStyle: { textAlign: 'right' },
      valueFormatter: (p: any) => `$${Number(p.value).toFixed(2)}` },
    { field: 'subtotal',       headerName: 'Subtotal', width: 95,  editable: false,
      cellStyle: { textAlign: 'right', fontWeight: 'bold', color: '#1a6b2b' },
      valueFormatter: (p: any) => `$${Number(p.value).toFixed(2)}` },
    { field: 'hora',           headerName: 'Hora',     width: 65,  editable: false,
      cellStyle: { color: '#888' } },
  ];

  onReporteGridReady(e: GridReadyEvent)      { this.reporteGridApi = e.api; }
  onReporteItemsGridReady(e: GridReadyEvent) { this.reporteItemsGridApi = e.api; }

  onReporteRowClicked(e: any) {
    const mesa = e.data?.nombreMesa;
    if (!mesa) return;
    if (this.reporteFiltraMesa === mesa) {
      // doble clic en la misma → limpiar filtro
      this.limpiarFiltroMesa();
    } else {
      this.reporteFiltraMesa = mesa;
      this.reporteItemsData  = this.reporteItemsAll.filter(i => i.nombreMesa === mesa);
    }
  }

  limpiarFiltroMesa() {
    this.reporteFiltraMesa = null;
    this.reporteItemsData  = [...this.reporteItemsAll];
  }

  loadReporte() {
    if (!this.idCompany) return;
    this.reporteError      = '';
    this.reporteLoading    = true;
    this.reporteRowData    = [];
    this.reporteItemsData  = [];
    this.reporteItemsAll   = [];
    this.reporteFiltraMesa = null;
    this.reporteMesaMayor  = null;
    this.reporteTotal      = 0;
    this.reporteCuentas    = 0;
    this.restaurantService.getReporte(this.idCompany, this.reporteFecha).subscribe({
      next: data => {
        this.reporteLoading = false;
        this.reporteRowData = data ?? [];
        this.reporteTotal   = this.reporteRowData.reduce((s, r) => s + (r.total ?? 0), 0);
        this.reporteCuentas = this.reporteRowData.length;

        // Mesa con mayor venta
        this.reporteMesaMayor = this.reporteRowData.reduce(
          (max: any, r: any) => (!max || r.total > max.total) ? r : max, null);

        // Aplanar ítems de todas las mesas para el grid de productos
        this.reporteItemsAll = this.reporteRowData.flatMap((mesa: any) =>
          (mesa.items ?? []).map((it: any) => ({
            nombreMesa:     mesa.nombreMesa,
            descripcion:    it.descripcion,
            cantidad:       it.cantidad,
            precioUnitario: it.precioUnitario,
            subtotal:       it.subtotal,
            hora:           it.createdAt
              ? new Date(it.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
              : '',
          }))
        );
        this.reporteItemsData = [...this.reporteItemsAll];
      },
      error: err => {
        this.reporteLoading = false;
        this.reporteError = `Error ${err?.status ?? ''}: ${err?.error?.message ?? 'No se pudo cargar el reporte'}`;
      },
    });
  }

  private async getLogoBase64(): Promise<string | null> {
    try {
      const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.idCompany));
      if (rootData?.picture) {
        return await this.base64EncodeService.convertImageToBase64(rootData.picture);
      }
    } catch {}
    return null;
  }

  async exportPdfReporte() {
    if (!this.reporteRowData.length) return;

    const logoData = await this.getLogoBase64();

    const fechaLabel = new Date(this.reporteFecha + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const promedio = this.reporteCuentas > 0
      ? (this.reporteTotal / this.reporteCuentas).toFixed(2) : '0.00';

    // Filas de la tabla
    const rows = this.reporteRowData.map(r => {
      const minutos = r.minutosAtencion ?? 0;
      const tiempoStr = minutos >= 60
        ? `${Math.floor(minutos/60)}h ${minutos%60}min` : `${minutos} min`;
      const abierta = r.abiertaAt
        ? new Date(r.abiertaAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
      const cobrada = r.cerradaAt
        ? new Date(r.cerradaAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
      return [
        { text: String(r.orden),      alignment: 'center' },
        { text: r.nombreMesa ?? '' },
        { text: String(r.numItems ?? 0), alignment: 'center' },
        { text: abierta,              alignment: 'center' },
        { text: cobrada,              alignment: 'center' },
        { text: tiempoStr,            alignment: 'center' },
        { text: r.notas ?? '',        italics: true, color: '#666' },
        { text: `$${Number(r.total ?? 0).toFixed(2)}`, alignment: 'right', bold: true, color: '#1a6b2b' },
      ];
    });

    const docDef: any = {
      pageOrientation: 'landscape',
      pageMargins: [30, 50, 30, 50],
      content: [
        {
          columns: [
            logoData ? { image: logoData, width: 60, margin: [0, 0, 12, 0] } : { text: '', width: 60 },
            { stack: [
              { text: 'REPORTE DE MESAS', style: 'titulo' },
              { text: fechaLabel, style: 'subtitulo' },
            ]},
          ],
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: [25, '*', 35, 55, 55, 60, '*', 65],
            body: [
              // Encabezado
              [
                { text: '#',        style: 'th' },
                { text: 'Mesa',     style: 'th' },
                { text: 'Ítems',    style: 'th', alignment: 'center' },
                { text: 'Apertura', style: 'th', alignment: 'center' },
                { text: 'Cobrada',  style: 'th', alignment: 'center' },
                { text: 'Tiempo',   style: 'th', alignment: 'center' },
                { text: 'Notas',    style: 'th' },
                { text: 'Total',    style: 'th', alignment: 'right' },
              ],
              ...rows,
            ],
          },
          layout: {
            hLineWidth: (i: number, node: any) => i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.3,
            vLineWidth: () => 0,
            hLineColor: (i: number) => i === 0 || i === 1 ? '#333' : '#ccc',
            fillColor:  (i: number) => i === 0 ? '#2c3e50' : (i % 2 === 0 ? '#f8f9fa' : null),
          },
        },
        { text: ' ', margin: [0, 8, 0, 0] },
        // Resumen
        {
          columns: [
            { text: `Cuentas cobradas: ${this.reporteCuentas}`,      style: 'resumen' },
            { text: `Ticket promedio: $${promedio}`,                  style: 'resumen', alignment: 'center' },
            { text: `TOTAL DEL DÍA: $${this.reporteTotal.toFixed(2)}`, style: 'resumenTotal', alignment: 'right' },
          ],
        },
      ],
      styles: {
        titulo:      { fontSize: 16, bold: true, color: '#2c3e50', margin: [0, 0, 0, 2] },
        subtitulo:   { fontSize: 10, color: '#666', margin: [0, 0, 0, 4] },
        th:          { bold: true, fontSize: 8, color: '#ffffff', fillColor: '#2c3e50', margin: [2, 3, 2, 3] },
        resumen:     { fontSize: 9, color: '#555', margin: [0, 4, 0, 0] },
        resumenTotal:{ fontSize: 11, bold: true, color: '#1a6b2b', margin: [0, 4, 0, 0] },
      },
      defaultStyle: { fontSize: 8 },
    };

    const fechaFile = this.reporteFecha.replace(/-/g, '');
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Descargó PDF reporte mesas', 'Ventas / Restaurant Mesas', this.trackingService.getEmail());
    pdfMake.createPdf(docDef).download(`reporte-mesas-${fechaFile}.pdf`);
  }

  async exportPdfDetalle() {
    if (!this.reporteRowData.length) return;

    const logoData = await this.getLogoBase64();

    const fechaLabel = new Date(this.reporteFecha + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const content: any[] = [
      {
        columns: [
          logoData ? { image: logoData, width: 55, margin: [0, 0, 12, 0] } : { text: '', width: 55 },
          { stack: [
            { text: 'DETALLE DE CONSUMO POR MESA', style: 'titulo' },
            { text: fechaLabel, style: 'subtitulo' },
          ]},
        ],
        margin: [0, 0, 0, 8],
      },
    ];

    for (const mesa of this.reporteRowData) {
      const abierta = mesa.abiertaAt
        ? new Date(mesa.abiertaAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
      const cobrada = mesa.cerradaAt
        ? new Date(mesa.cerradaAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
      const minutos = mesa.minutosAtencion ?? 0;
      const tiempoStr = minutos >= 60
        ? `${Math.floor(minutos/60)}h ${minutos%60}min` : `${minutos} min`;

      // Encabezado de mesa
      content.push({
        margin: [0, 10, 0, 2],
        columns: [
          { text: `${mesa.orden}. ${mesa.nombreMesa}`, style: 'mesaTitulo', width: '*' },
          { text: `${abierta} → ${cobrada}  (${tiempoStr})`, style: 'mesaHora', alignment: 'right', width: 'auto' },
        ],
      });

      if (mesa.notas) {
        content.push({ text: `📝 ${mesa.notas}`, style: 'notas', margin: [0, 0, 0, 3] });
      }

      // Tabla de ítems
      const itemRows = (mesa.items ?? []).map((it: any) => {
        const hora = it.createdAt
          ? new Date(it.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
        const cant = Number(it.cantidad) % 1 === 0
          ? String(Number(it.cantidad)) : Number(it.cantidad).toFixed(1);
        return [
          { text: hora,                                              color: '#888' },
          { text: it.descripcion ?? '' },
          { text: cant,                       alignment: 'center' },
          { text: `$${Number(it.precioUnitario).toFixed(2)}`,       alignment: 'right' },
          { text: `$${Number(it.subtotal).toFixed(2)}`, bold: true, alignment: 'right', color: '#1a6b2b' },
        ];
      });

      content.push({
        table: {
          headerRows: 1,
          widths: [38, '*', 30, 60, 65],
          body: [
            [
              { text: 'Hora',     style: 'thDetalle' },
              { text: 'Producto', style: 'thDetalle' },
              { text: 'Cant.',    style: 'thDetalle', alignment: 'center' },
              { text: 'P.Unit.',  style: 'thDetalle', alignment: 'right' },
              { text: 'Subtotal', style: 'thDetalle', alignment: 'right' },
            ],
            ...(itemRows.length ? itemRows : [[{ text: '(sin ítems)', colSpan: 5, italics: true, color: '#aaa' }, '', '', '', '']]),
          ],
        },
        layout: {
          hLineWidth: (i: number, node: any) => i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.2,
          vLineWidth: () => 0,
          hLineColor: () => '#ccc',
          fillColor: (i: number) => i === 0 ? '#34495e' : (i % 2 === 0 ? '#f8f9fa' : null),
        },
      });

      // Subtotal de mesa
      content.push({
        margin: [0, 2, 0, 0],
        columns: [
          { text: `${mesa.numItems} producto(s)`, color: '#888', fontSize: 7, width: '*' },
          { text: `TOTAL: $${Number(mesa.total).toFixed(2)}`,
            bold: true, color: '#1a6b2b', fontSize: 9, alignment: 'right', width: 'auto' },
        ],
      });
    }

    // Resumen final
    const promedio = this.reporteCuentas > 0
      ? (this.reporteTotal / this.reporteCuentas).toFixed(2) : '0.00';
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 12, 0, 6] });
    content.push({
      columns: [
        { text: `Cuentas cobradas: ${this.reporteCuentas}`, style: 'resumen' },
        { text: `Ticket promedio: $${promedio}`,            style: 'resumen', alignment: 'center' },
        { text: `TOTAL DEL DÍA: $${this.reporteTotal.toFixed(2)}`, style: 'resumenTotal', alignment: 'right' },
      ],
    });

    const docDef: any = {
      pageMargins: [35, 50, 35, 50],
      content,
      styles: {
        titulo:      { fontSize: 15, bold: true, color: '#2c3e50', margin: [0, 0, 0, 2] },
        subtitulo:   { fontSize: 9, color: '#666', margin: [0, 0, 0, 6] },
        mesaTitulo:  { fontSize: 10, bold: true, color: '#2c3e50' },
        mesaHora:    { fontSize: 8, color: '#666' },
        notas:       { fontSize: 7.5, color: '#666', italics: true },
        thDetalle:   { bold: true, fontSize: 7.5, color: '#ffffff', fillColor: '#34495e', margin: [2, 2, 2, 2] },
        resumen:     { fontSize: 8, color: '#555', margin: [0, 2, 0, 0] },
        resumenTotal:{ fontSize: 10, bold: true, color: '#1a6b2b', margin: [0, 2, 0, 0] },
      },
      defaultStyle: { fontSize: 8 },
    };

    const fechaFile = this.reporteFecha.replace(/-/g, '');
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Descargó PDF detalle mesas', 'Ventas / Restaurant Mesas', this.trackingService.getEmail());
    pdfMake.createPdf(docDef).download(`detalle-mesas-${fechaFile}.pdf`);
  }
}
