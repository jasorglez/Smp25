import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ProspectosService, Prospecto, ESTADOS_PROSPECTO, GIROS_PROSPECTO, calcularScore, nivelScore } from 'app/services/prospectos.service';
import { Timestamp } from '@angular/fire/firestore';
import { SignalsService } from 'app/services/signals.service';
import { UsersService } from 'app/services/users.service';
import { DetalleInteraccionesComponent } from './detalle-interacciones.component';
import { ButtonCellRendererIncomeComponent } from 'app/domains/ModAdmon/components/income/button-cell-renderer-income.component';
import { StoragesService } from 'app/services/storages.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-prospectos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetalleInteraccionesComponent, ButtonCellRendererIncomeComponent],
  templateUrl: './prospectos.component.html',
  styleUrl: './prospectos.component.scss',
})
export class ProspectosComponent implements OnInit {
  private svc        = inject(ProspectosService);
  private signalsSvc = inject(SignalsService);
  private usersSvc   = inject(UsersService);
  private storageSvc = inject(StoragesService);
  private _colDefs: ColDef[] = [];

  // ── Pestañas ─────────────────────────────────────────────────────────────
  activeTab: 'prospectos' | 'plantillas' | 'reportes' = 'prospectos';
  savingPlantillas = false;

  // ── Plantillas de mensaje por giro ({empresa} se reemplaza con el nombre real) ──
  private readonly MENSAJES_DEFAULT: Record<string, string> = {
    'Servicios': `Hola {empresa}, buen día.\n\n¿Le gustaría generar ingresos adicionales sin inversión?\n\nEn BI2 desarrollamos software, buscamos despachos contables como aliados comerciales para ofrecer ERP, Construcción, Administración, Municipios, Escuelas, Puntos Ventas, Bot Whatsapp e Inteligencia Artificial a sus clientes, con atractivas comisiones por cada venta.\n\n¿Podemos agendar una llamada de 10 minutos para explicarle el programa?\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx\nwww.youtube.com/@bi2mx`,
    'Restaurante':  `Hola {empresa}, buen día.\n\n[Mensaje para Restaurantes — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Clínica':      `Hola {empresa}, buen día.\n\n[Mensaje para Clínicas — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Escuela':      `Hola {empresa}, buen día.\n\n[Mensaje para Escuelas — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Construcción': `Hola {empresa}, buen día.\n\n[Mensaje para Construcción — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Comercio':     `Hola {empresa}, buen día.\n\n[Mensaje para Comercio — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Manufactura':  `Hola {empresa}, buen día.\n\n[Mensaje para Manufactura — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Gobierno':     `Hola {empresa}, buen día.\n\n[Mensaje para Gobierno — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
    'Otro':         `Hola {empresa}, buen día.\n\n[Mensaje genérico — pendiente redactar]\n\nSaludos.\nJosé Angel Soriano | BI2\nwww.bi2.mx`,
  };

  plantillas: Record<string, string> = { ...this.MENSAJES_DEFAULT };

  constructor() {
    effect(() => {
      const idRoot = this.signalsSvc.getRootSelectedBySidebar()();
      if (idRoot) {
        this.usersSvc.get2fieldsUsers(idRoot).subscribe({
          next: (res: any) => {
            const data: any[] = res?.data ?? res ?? [];
            this.vendedores = data.map((u: any) => ({ id: u.id, displayName: u.displayName ?? u.DisplayName ?? '' }));
          },
        });
      }
    });
  }

  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  rowData:          any[]    = [];
  originalData:     any[]    = [];
  selectedItem:     any      = null;
  hasUnsavedChanges = false;
  loading           = false;

  // ── Reportes + Cuotas ─────────────────────────────────────────────────────
  reportesData: any[] = [];
  loadingReportes = false;
  cuotasMes: Record<string, number> = {};
  cuotasEditando = false;
  readonly mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM

  vendedores: { id: number; displayName: string }[] = [];

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get idRoot()         { return this.signalsSvc.getRootSelectedBySidebar()(); }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

  // ── Enter-key navigation ─────────────────────────────────────────────────
  private editableColumnOrder = ['nombreVendedorActual', 'empresa', 'nombre', 'puesto', 'telefono', 'giro', 'competidor', 'domicilio', 'estado'];
  readonly GIROS = GIROS_PROSPECTO;
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

  // ── Grid Options (master-detail) ──────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: () => true,
    detailCellRenderer: DetalleInteraccionesComponent,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'row-inactivo':      (p: any) => p.data?.activo === false,
      'row-ganado':        (p: any) => !p.data?.__isNew && p.data?.estado === 'ganado',
      'row-perdido':       (p: any) => !p.data?.__isNew && p.data?.estado === 'perdido',
    },
    onRowClicked: (event: any) => {
      const colId = event.column?.getColId();
      if (colId !== 'historial') {
        this.selectedItem = event.data;
      }
    },
  };

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;

    this._colDefs = [
      {
        field: 'historial',
        headerName: 'Historial',
        width: 105,
        editable: false,
        cellRenderer: ButtonCellRendererIncomeComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
          icon: 'bi-clock-history',
          title: 'Ver interacciones',
        },
        valueGetter: (params) => params.data?.countInteracciones ?? 0,
        cellStyle: { backgroundColor: '#e8f0fb', cursor: 'pointer' },
      },
      {
        field: 'whatsapp',
        headerName: 'WhatsApp',
        width: 110,
        editable: false,
        cellRenderer: (p: any) => {
          const phone = p.data?.telefono ?? '';
          const hasPhone = phone && phone !== 'SIN NUMERO';
          const color = hasPhone ? '#25D366' : '#6c757d';
          return `<button style="background:${color};border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:.8rem;cursor:${hasPhone ? 'pointer' : 'default'}" title="${hasPhone ? 'Enviar WhatsApp' : 'Sin número registrado'}">
            <i class="bi bi-whatsapp"></i> Enviar
          </button>`;
        },
        onCellClicked: (p: any) => { if (p.data?.telefono && p.data.telefono !== 'SIN NUMERO') this.abrirWhatsappProspecto(p.data); },
        cellStyle: { cursor: 'pointer' },
      },
      {
        headerName: 'Score', colId: 'score', width: 88, editable: false,
        valueGetter: (p: any) => calcularScore(p.data),
        cellRenderer: (p: any) => {
          const s: number = p.value ?? 0;
          const n = nivelScore(s);
          return `<span class="badge bg-${n.color}" style="font-size:.75rem" title="${s}/100">${n.icon} ${s}</span>`;
        },
        comparator: (a: number, b: number) => a - b,
      },
      {
        field: 'estado', headerName: 'Estado', width: 155,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ESTADOS_PROSPECTO.map(e => e.value) },
        cellRenderer: (p: any) => {
          if (p.data?.activo === false) {
            return '<span class="badge prospecto-eliminado-badge">Eliminado</span>';
          }
          const e = ESTADOS_PROSPECTO.find(x => x.value === p.value);
          return e ? `<span class="badge bg-${e.color}">${e.icon} ${e.label}</span>` : p.value ?? '';
        },
      },
      {
        field: 'nombreVendedorActual', headerName: 'Vendedor', width: 185, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.vendedores.map(v => v.displayName) }),
        valueSetter: (params: any) => {
          params.data.nombreVendedorActual = params.newValue;
          const found = this.vendedores.find(v => v.displayName === params.newValue);
          if (found) params.data.idVendedorActual = found.id;
          return true;
        },
      },
      { field: 'empresa',    headerName: 'Empresa',    width: 180, editable: true, filter: true },
      { field: 'nombre',     headerName: 'Nombre',     width: 160, editable: true, filter: true },
      { field: 'puesto',     headerName: 'Puesto',     width: 130, editable: true },
      { field: 'telefono',   headerName: 'Teléfono',   width: 130, editable: true },
      {
        field: 'giro', headerName: 'Giro', width: 130, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: GIROS_PROSPECTO },
      },
      { field: 'competidor', headerName: 'Compite con', width: 145, editable: true },
      { field: 'domicilio',  headerName: 'Domicilio',   width: 180, editable: true, filter: true },
      {
        field: 'fechaProximoSeguimiento',
        headerName: 'Próx. Seguimiento', width: 155, editable: true,
        cellEditor: 'agDateCellEditor',
        valueGetter: (p: any) => {
          const v = p.data?.fechaProximoSeguimiento;
          if (!v) return '';
          const d = v?.toDate ? v.toDate() : new Date(v);
          return d.toISOString().substring(0, 10);
        },
        valueSetter: (p: any) => {
          p.data.fechaProximoSeguimiento = p.newValue
            ? Timestamp.fromDate(new Date(p.newValue))
            : null;
          return true;
        },
        valueFormatter: (p: any) => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d && m && y ? `${d}/${m}/${y}` : p.value;
        },
        cellStyle: (p: any) => {
          if (!p.value) return null;
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          const fecha = new Date(p.value);
          if (fecha < hoy) return { backgroundColor: '#fde8e8', color: '#c0392b', fontWeight: 'bold' };
          if (fecha.toDateString() === hoy.toDateString()) return { backgroundColor: '#fff3cd', color: '#856404', fontWeight: 'bold' };
          return null;
        },
      },
      {
        field: 'fechaUltimaInteraccion',
        headerName: 'Última Interac.', width: 145, editable: false,
        cellRenderer: (p: any) => this.formatFecha(p.value),
      },
      {
        field: 'creadoPor', headerName: 'Canal', width: 80, editable: false,
        cellRenderer: (p: any) => {
          const icon = p.value === 'telegram' ? '📱' : p.value === 'whatsapp' ? '💬' : '🖥️';
          return `${icon} ${p.value ?? ''}`;
        },
      },
    ];

    return this._colDefs;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // ── Cascada (igual que income) ────────────────────────────────────────────

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isExpanded = node.expanded;

    if (isExpanded) {
      node.setExpanded(false);
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
    } else {
      // Colapsar cualquier otro expandido
      api.forEachNode((n: any) => {
        if (n.expanded && n.id !== node.id) n.setExpanded(false);
      });
      // Ocultar otras filas
      api.forEachNode((n: any) => {
        if (n.id !== node.id) n.setRowHeight(0);
      });
      api.onRowHeightChanged();

      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.cargarProspectos();
    this.cargarPlantillas();
  }

  async cargarPlantillas() {
    if (!this.idRoot) return;
    const guardadas = await this.svc.getPlantillas(this.idRoot);
    if (guardadas) {
      this.plantillas = { ...this.MENSAJES_DEFAULT, ...guardadas };
    }
  }

  async guardarPlantillas() {
    if (!this.idRoot) return;
    this.savingPlantillas = true;
    try {
      await this.svc.savePlantillas(this.idRoot, this.plantillas);
      Swal.fire({ icon: 'success', title: 'Plantillas guardadas', timer: 1400, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudieron guardar las plantillas.', 'error');
    } finally {
      this.savingPlantillas = false;
    }
  }

  resetPlantilla(giro: string) {
    this.plantillas[giro] = this.MENSAJES_DEFAULT[giro] ?? '';
  }

  private ordenarProspectos(data: any[]) {
    const toMs = (ts: any): number => {
      if (!ts) return 0;
      if (ts.toDate) return ts.toDate().getTime();
      return new Date(ts).getTime();
    };

    return [...data].sort((a, b) => {
      if (!!a.__isNew !== !!b.__isNew) return a.__isNew ? -1 : 1;
      if ((a.activo !== false) !== (b.activo !== false)) return a.activo === false ? 1 : -1;
      const fechaA = toMs(a.fechaUltimaInteraccion) || toMs(a.fechaCreacion);
      const fechaB = toMs(b.fechaUltimaInteraccion) || toMs(b.fechaCreacion);
      return fechaB - fechaA; // más reciente arriba
    });
  }

  cargarProspectos() {
    this.loading = true;
    this.svc.getProspectos(this.idVendedor).subscribe({
      next: data => {
        this.rowData = this.ordenarProspectos(data.map(p => ({
          ...p,
          activo: (p as any).activo ?? true,
          domicilio: (p as any).domicilio ?? '',
          countInteracciones: (p as any).countInteracciones ?? 0,
          __isNew: false,
          __modified: false,
        })));
        this.originalData = JSON.parse(JSON.stringify(this.rowData));
        this.hasUnsavedChanges = false;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  add() {
    const nuevo: any = {
      nombre: '', telefono: 'SIN NUMERO', empresa: '', puesto: 'GERENTE', domicilio: 'SIN DOMICILIO', estado: 'prospecto',
      idVendedorActual: this.idVendedor, nombreVendedorActual: this.nombreVendedor,
      chatIdVendedorActual: '', idCompany: this.idRoot,
      creadoPor: 'web', idVendedorCreador: this.idVendedor,
      notas: '', idCustomer: null, activo: true,
      giro: '', competidor: '', fechaProximoSeguimiento: null,
      fechaCreacion: null, fechaUltimaInteraccion: null,
      countInteracciones: 0,
      __isNew: true, __modified: false,
    };
    this.rowData = this.ordenarProspectos([nuevo, ...this.rowData]);
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'empresa' });
    }, 50);
  }

  async saveChanges() {
    this.gridApi?.stopEditing();

    const toSave = this.rowData.filter(p => p.__isNew || p.__modified);
    if (!toSave.length) return;

    const nuevos: any[] = [];
    const errores: string[] = [];
    for (const p of toSave) {
      const empresa = p.empresa?.trim() ?? '';
      const nombre = p.nombre?.trim() ?? '';

      if (!empresa || !nombre) {
        const camposFaltantes = [
          !empresa ? 'Empresa' : null,
          !nombre ? 'Nombre' : null,
        ].filter(Boolean).join('/');

        errores.push(`Sin ${camposFaltantes}: "${empresa || nombre || '(vacio)'}"`);
        continue;
      }
      try {
        if (p.__isNew) {
          await this.svc.crearProspecto(p);
          nuevos.push(p);
        } else {
          await this.svc.actualizarProspecto(p.id!, {
            nombre:                 p.nombre,
            telefono:               p.telefono,
            empresa:                p.empresa,
            puesto:                 p.puesto,
            domicilio:              p.domicilio,
            estado:                 p.estado,
            idVendedorActual:       p.idVendedorActual,
            nombreVendedorActual:   p.nombreVendedorActual,
            giro:                   p.giro ?? '',
            competidor:             p.competidor ?? '',
            fechaProximoSeguimiento: p.fechaProximoSeguimiento ?? null,
          });
        }
      } catch {
        errores.push(`Error al guardar: ${p.nombre}`);
      }
    }

    if (errores.length) {
      Swal.fire('Atención', errores.join('\n'), 'warning');
      return;
    }

    Swal.fire({ icon: 'success', title: 'Guardado', timer: 900, showConfirmButton: false });

    // Por cada nuevo guardado, preguntar si envía WhatsApp
    for (const p of nuevos) {
      if (!p.telefono || p.telefono === 'SIN NUMERO') continue;
      const res = await Swal.fire({
        icon: 'question',
        title: '¿Enviar WhatsApp?',
        html: `¿Deseas enviarle un mensaje a <b>${p.empresa || p.nombre}</b>?`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-whatsapp"></i> Sí, enviar',
        cancelButtonText: 'Ahora no',
        confirmButtonColor: '#25D366',
      });
      if (res.isConfirmed) {
        await this.abrirWhatsappProspecto(p);
      }
    }
  }

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasUnsavedChanges = false;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteSelected() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar prospecto?', text: this.selectedItem.nombre,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;

    if (this.selectedItem.__isNew) {
      this.rowData = this.rowData.filter(p => p !== this.selectedItem);
      this.gridApi.setGridOption('rowData', this.rowData);
      if (!this.rowData.some(p => p.__isNew || p.__modified)) this.hasUnsavedChanges = false;
      this.selectedItem = null;
      return;
    }
    try {
      await this.svc.actualizarProspecto(this.selectedItem.id!, { activo: false } as any);
      this.selectedItem.activo = false;
      this.selectedItem.__modified = false;
      this.rowData = this.ordenarProspectos(this.rowData);
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.gridApi.setGridOption('rowData', this.rowData);
      this.selectedItem = null;
      Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  }

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── Reportes ──────────────────────────────────────────────────────────────

  cargarReportes() {
    if (!this.idRoot || this.reportesData.length) return;
    this.loadingReportes = true;
    this.svc.getProspectosByCompany(this.idRoot).subscribe({
      next: async data => {
        this.reportesData = data;
        this.cuotasMes = await this.svc.getCuotasMes(this.idRoot!, this.mesActual);
        this.loadingReportes = false;
      },
      error: () => { this.loadingReportes = false; },
    });
  }

  async guardarCuotas() {
    if (!this.idRoot) return;
    try {
      await this.svc.saveCuotasMes(this.idRoot, this.mesActual, this.cuotasMes);
      this.cuotasEditando = false;
      Swal.fire({ icon: 'success', title: 'Cuotas guardadas', timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudieron guardar las cuotas.', 'error');
    }
  }

  get ganadosEsteMesPorVendedor(): Record<string, number> {
    const inicio = new Date(this.mesActual + '-01');
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    const result: Record<string, number> = {};
    this.reportesData
      .filter(p => {
        if (p.estado !== 'ganado') return false;
        const ts = p.fechaUltimaInteraccion;
        if (!ts) return false;
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d >= inicio && d < fin;
      })
      .forEach(p => {
        const v = p.nombreVendedorActual || 'Sin asignar';
        result[v] = (result[v] ?? 0) + 1;
      });
    return result;
  }

  get tablaCuotas() {
    const vendedores = new Set<string>([
      ...Object.keys(this.cuotasMes),
      ...this.rRankingVendedores.map(v => v.nombre),
    ]);
    return [...vendedores].map(nombre => {
      const meta   = this.cuotasMes[nombre] ?? 0;
      const actual = this.ganadosEsteMesPorVendedor[nombre] ?? 0;
      const pct    = meta > 0 ? Math.min(100, Math.round(actual / meta * 100)) : 0;
      return { nombre, meta, actual, pct };
    }).sort((a, b) => b.pct - a.pct);
  }

  setCuota(nombre: string, valor: string) {
    const n = parseInt(valor, 10);
    this.cuotasMes = { ...this.cuotasMes, [nombre]: isNaN(n) ? 0 : n };
  }

  get rTasaCierre() {
    const g = this.reportesData.filter(p => p.estado === 'ganado').length;
    const per = this.reportesData.filter(p => p.estado === 'perdido').length;
    return (g + per) > 0 ? Math.round(g / (g + per) * 100) : 0;
  }

  get rSinActividad7() {
    const limite = Date.now() - 7 * 86_400_000;
    return this.reportesData
      .filter(p => !['ganado', 'perdido'].includes(p.estado))
      .filter(p => {
        const ts = p.fechaUltimaInteraccion;
        if (!ts) return true;
        const ms = ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
        return ms < limite;
      }).length;
  }

  get rPromInteracciones() {
    if (!this.reportesData.length) return 0;
    return Math.round(this.reportesData.reduce((a, p) => a + (p.countInteracciones ?? 0), 0) / this.reportesData.length);
  }

  get rRankingVendedores() {
    const map = new Map<string, { ganados: number; total: number; perdidos: number }>();
    this.reportesData.forEach(p => {
      const v = p.nombreVendedorActual || 'Sin asignar';
      if (!map.has(v)) map.set(v, { ganados: 0, total: 0, perdidos: 0 });
      const e = map.get(v)!;
      e.total++;
      if (p.estado === 'ganado')  e.ganados++;
      if (p.estado === 'perdido') e.perdidos++;
    });
    return [...map.entries()]
      .map(([nombre, d]) => ({
        nombre, total: d.total, ganados: d.ganados, perdidos: d.perdidos,
        tasa: (d.ganados + d.perdidos) > 0 ? Math.round(d.ganados / (d.ganados + d.perdidos) * 100) : 0,
      }))
      .sort((a, b) => b.ganados - a.ganados).slice(0, 8);
  }

  get rPorGiro() {
    const map = new Map<string, number>();
    this.reportesData.forEach(p => map.set(p.giro || 'Sin giro', (map.get(p.giro || 'Sin giro') ?? 0) + 1));
    const total = this.reportesData.length || 1;
    return [...map.entries()].sort((a, b) => b[1] - a[1])
      .map(([giro, count]) => ({ giro, count, pct: Math.round(count / total * 100) }));
  }

  get rScoreDistrib() {
    const total = this.reportesData.length || 1;
    const hot  = this.reportesData.filter(p => calcularScore(p) >= 70).length;
    const warm = this.reportesData.filter(p => { const s = calcularScore(p); return s >= 40 && s < 70; }).length;
    const cold = this.reportesData.filter(p => calcularScore(p) < 40).length;
    return [
      { label: '🔥 Hot',  count: hot,  pct: Math.round(hot  / total * 100), color: 'danger'  },
      { label: '👍 Warm', count: warm, pct: Math.round(warm / total * 100), color: 'warning' },
      { label: '❄️ Cold', count: cold, pct: Math.round(cold / total * 100), color: 'info'    },
    ];
  }

  get rConversionFunnel() {
    const total = this.reportesData.length || 1;
    return ESTADOS_PROSPECTO.map(e => {
      const count = this.reportesData.filter(p => p.estado === e.value).length;
      return { ...e, count, pct: Math.round(count / total * 100) };
    });
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────

  async abrirWhatsappProspecto(data: any) {
    const giro    = data?.giro ?? '';
    const empresa = data?.empresa || data?.nombre || 'prospecto';
    const telefono = data?.telefono ?? '';
    const msgBase  = (this.plantillas[giro] ?? this.plantillas['Otro'] ?? '').replace(/\{empresa\}/g, empresa);

    const result = await Swal.fire({
      title: `<i class="bi bi-whatsapp" style="color:#25D366"></i> WhatsApp — ${empresa}`,
      width: 640,
      html: `
        <div style="text-align:left;font-size:.875rem">
          <label style="font-weight:600">Teléfono</label>
          <input id="sw-phone" class="swal2-input" style="margin:4px 0 10px" placeholder="5512345678" value="${telefono}">

          <label style="font-weight:600">Mensaje <small style="color:#888;font-weight:400">(editable)</small></label>
          <textarea id="sw-msg" class="swal2-textarea" style="height:150px;font-size:.8rem;margin:4px 0 10px">${msgBase}</textarea>

          <label style="font-weight:600">Imágenes</label>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            <label style="cursor:pointer">
              <input type="radio" name="sw-opt" value="C" checked style="margin-right:6px">
              📝 Sin imágenes — las agrego desde mi teléfono
            </label>
            <label style="cursor:pointer">
              <input type="radio" name="sw-opt" value="B" style="margin-right:6px">
              🔗 Incluir link en el mensaje
            </label>
            <div id="sw-link-wrap" style="display:none;margin-left:22px;margin-top:-2px">
              <input id="sw-link" class="swal2-input" style="margin:2px 0 0" placeholder="https://www.bi2.mx">
            </div>
            <label style="cursor:pointer">
              <input type="radio" name="sw-opt" value="A" style="margin-right:6px">
              📎 Subir imágenes a la nube (1-2 archivos JPG/PNG)
            </label>
            <div id="sw-files-wrap" style="display:none;margin-left:22px;margin-top:-2px">
              <div style="margin-bottom:4px"><small style="color:#666">Imagen 1</small><br>
                <input type="file" id="sw-img1" accept="image/jpeg,image/png">
              </div>
              <div><small style="color:#666">Imagen 2 (opcional)</small><br>
                <input type="file" id="sw-img2" accept="image/jpeg,image/png">
              </div>
            </div>
          </div>
        </div>
      `,
      didOpen: () => {
        document.querySelectorAll<HTMLInputElement>('input[name="sw-opt"]').forEach(r => {
          r.addEventListener('change', () => {
            const v = (document.querySelector<HTMLInputElement>('input[name="sw-opt"]:checked'))?.value ?? 'C';
            (document.getElementById('sw-link-wrap') as HTMLElement).style.display  = v === 'B' ? 'block' : 'none';
            (document.getElementById('sw-files-wrap') as HTMLElement).style.display = v === 'A' ? 'block' : 'none';
          });
        });
      },
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-whatsapp"></i> Abrir WhatsApp',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#25D366',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        const phone = (document.getElementById('sw-phone') as HTMLInputElement).value.trim();
        const msg   = (document.getElementById('sw-msg')   as HTMLTextAreaElement).value.trim();
        const opt   = (document.querySelector<HTMLInputElement>('input[name="sw-opt"]:checked'))?.value ?? 'C';
        const link  = (document.getElementById('sw-link')  as HTMLInputElement)?.value?.trim() ?? '';
        const img1  = (document.getElementById('sw-img1')  as HTMLInputElement)?.files?.[0] ?? null;
        const img2  = (document.getElementById('sw-img2')  as HTMLInputElement)?.files?.[0] ?? null;

        const normalized = this.normalizeWhatsappNumber(phone);
        if (!normalized) {
          Swal.showValidationMessage('Número inválido. Escribe 10 dígitos o incluye clave de país (ej. 525512345678).');
          return false;
        }

        let mensajeFinal = msg;

        if (opt === 'B' && link) {
          mensajeFinal += `\n\n🔗 ${link}`;
        } else if (opt === 'A') {
          const archivos = [img1, img2].filter((f): f is File => !!f);
          if (archivos.length) {
            Swal.showValidationMessage('Subiendo imágenes...');
            const urls: string[] = [];
            for (const file of archivos) {
              try {
                const url = await this.storageSvc.uploadFile(file, `whatsapp-prospectos/${Date.now()}_${file.name}`);
                urls.push(url);
              } catch {
                Swal.showValidationMessage(`Error al subir ${file.name}. Intenta de nuevo.`);
                return false;
              }
            }
            mensajeFinal += '\n\n' + urls.join('\n');
          }
        }

        return { phone: normalized, msg: mensajeFinal };
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (!result.isConfirmed || !result.value) return;

    const { phone, msg } = result.value as { phone: string; msg: string };
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');

    // Registrar interacción whatsapp en el historial
    if (data.id) {
      try {
        await this.svc.registrarInteraccion(data.id, {
          tipo:           'whatsapp',
          descripcion:    `WhatsApp enviado${data.giro ? ` — giro: ${data.giro}` : ''}`,
          idVendedor:     this.idVendedor,
          nombreVendedor: this.nombreVendedor,
          resultado:      'neutral',
        });
        data.countInteracciones = (data.countInteracciones ?? 0) + 1;
        data.fechaUltimaInteraccion = new Date();

        // Pasar a 'contactado' solo si todavía está como 'prospecto'
        if ((data.estado ?? 'prospecto') === 'prospecto') {
          await this.svc.cambiarEstado(data.id, 'contactado', this.idVendedor, this.nombreVendedor);
          data.estado = 'contactado';
          data.countInteracciones += 1; // cambiarEstado también registra una interacción
        }

        // Refrescar el row en el grid
        this.gridApi.forEachNode((node: any) => {
          if (node.data?.id === data.id) {
            node.setData({ ...node.data, estado: data.estado, countInteracciones: data.countInteracciones, fechaUltimaInteraccion: data.fechaUltimaInteraccion });
          }
        });
      } catch {
        // El WhatsApp ya se abrió — solo registramos el fallo silenciosamente
        console.warn('[Prospectos] No se pudo registrar interacción WhatsApp');
      }
    }

    Swal.fire({
      icon: 'success',
      title: 'WhatsApp listo',
      text: data.estado === 'contactado' ? `✅ Prospecto marcado como Contactado` : `Abierto para ${phone}`,
      timer: 2000,
      showConfirmButton: false,
    });
  }

  private normalizeWhatsappNumber(value: string): string | null {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `52${digits}`;
    if (digits.length < 11 || digits.length > 15) return null;
    return digits;
  }
}

