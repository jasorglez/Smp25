import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { RestaurantMesasService } from 'app/services/restaurant-mesas.service';
import Swal from 'sweetalert2';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? pdfFonts;

@Component({
  selector: 'app-restaurant-mesas',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './restaurant-mesas.component.html',
  styleUrl: './restaurant-mesas.component.scss',
})
export class RestaurantMesasComponent implements OnInit {
  private signalsService    = inject(SignalsService);
  private restaurantService = inject(RestaurantMesasService);

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
      cellRenderer: (p: any) => p.value ? '🔴 Ocupada' : '🟢 Libre',
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

  reporteFecha: string = new Date().toISOString().substring(0, 10);  // hoy YYYY-MM-DD
  reporteRowData: any[] = [];
  reporteError   = '';
  reporteLoading = false;
  reporteTotal   = 0;
  reporteCuentas = 0;
  private reporteGridApi!: GridApi;

  reporteGridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    defaultColDef: { sortable: true, resizable: true, minWidth: 70 },
  };

  reporteColDefs: ColDef[] = [
    { field: 'orden',          headerName: '#',          width: 55,  editable: false,
      cellStyle: { textAlign: 'center', fontWeight: 'bold' } },
    { field: 'nombreMesa',     headerName: 'Mesa',       flex: 1,    editable: false },
    { field: 'numItems',       headerName: 'Ítems',      width: 75,  editable: false,
      cellStyle: { textAlign: 'center' } },
    { field: 'abiertaAt',      headerName: 'Apertura',   width: 90,  editable: false,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '' },
    { field: 'cerradaAt',      headerName: 'Cobrada',    width: 90,  editable: false,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '' },
    { field: 'minutosAtencion',headerName: 'Tiempo',     width: 90,  editable: false,
      valueFormatter: (p: any) => {
        const m = p.value ?? 0;
        return m >= 60 ? `${Math.floor(m/60)}h ${m%60}min` : `${m} min`;
      },
      cellStyle: (p: any) => p.value > 90 ? { color: '#c0392b', fontWeight: 'bold' } : {} },
    { field: 'notas',          headerName: 'Notas',      flex: 1,    editable: false,
      cellStyle: { color: '#555', fontStyle: 'italic' } },
    { field: 'total',          headerName: 'Total',      width: 110, editable: false,
      valueFormatter: (p: any) => p.value != null ? `$${Number(p.value).toFixed(2)}` : '',
      cellStyle: { textAlign: 'right', fontWeight: 'bold', color: '#1a6b2b' } },
  ];

  onReporteGridReady(e: GridReadyEvent) { this.reporteGridApi = e.api; }

  loadReporte() {
    if (!this.idCompany) return;
    this.reporteError   = '';
    this.reporteLoading = true;
    this.reporteRowData = [];
    this.reporteTotal   = 0;
    this.reporteCuentas = 0;
    this.restaurantService.getReporte(this.idCompany, this.reporteFecha).subscribe({
      next: data => {
        this.reporteLoading = false;
        this.reporteRowData = data ?? [];
        this.reporteTotal   = this.reporteRowData.reduce((s, r) => s + (r.total ?? 0), 0);
        this.reporteCuentas = this.reporteRowData.length;
      },
      error: err => {
        this.reporteLoading = false;
        this.reporteError = `Error ${err?.status ?? ''}: ${err?.error?.message ?? 'No se pudo cargar el reporte'}`;
      },
    });
  }

  exportPdfReporte() {
    if (!this.reporteRowData.length) return;

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
        { text: 'REPORTE DE MESAS', style: 'titulo' },
        { text: fechaLabel, style: 'subtitulo' },
        { text: ' ', margin: [0, 6, 0, 0] },
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
    pdfMake.createPdf(docDef).download(`reporte-mesas-${fechaFile}.pdf`);
  }
}
