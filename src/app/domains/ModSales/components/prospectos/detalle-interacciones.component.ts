import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ProspectosService, Interaccion, ESTADOS_PROSPECTO, Tarea, TIPOS_TAREA, TIPOS_INTERACCION_DEFAULT } from 'app/services/prospectos.service';
import { CotizacionesService } from 'app/services/cotizaciones.service';
import { SignalsService } from 'app/services/signals.service';
import { Timestamp } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detalle-interacciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-container">

      <!-- Info bar + cambiar estado -->
      <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <span class="badge" [ngClass]="'bg-' + estadoColor(prospecto?.estado)">
          {{ estadoIcon(prospecto?.estado) }} {{ estadoLabel(prospecto?.estado) }}
        </span>
        <span class="small fw-semibold">{{ prospecto?.nombre }}</span>
        <span class="text-muted small" *ngIf="prospecto?.empresa">
          <i class="bi bi-building"></i> {{ prospecto?.empresa }}
        </span>
        <span class="text-muted small">
          <i class="bi bi-phone"></i> {{ prospecto?.telefono }}
        </span>
        <a *ngIf="prospecto?.correo" [href]="'mailto:' + prospecto?.correo"
           class="small text-primary" (click)="$event.stopPropagation()">
          <i class="bi bi-envelope me-1"></i>{{ prospecto?.correo }}
        </a>
        <span *ngIf="countCotizaciones > 0"
              class="badge bg-primary ms-1" style="font-size:.72rem"
              title="Cotizaciones vinculadas">
          <i class="bi bi-file-earmark-text me-1"></i>{{ countCotizaciones }} cotiz.
        </span>
        <div class="ms-auto d-flex gap-1 align-items-center flex-wrap">
          <span class="small text-muted me-1">Cambiar a:</span>
          <button *ngFor="let e of estados"
            class="btn btn-sm py-0 px-1"
            [ngClass]="'btn-outline-' + e.color"
            [disabled]="prospecto?.estado === e.value"
            (click)="cambiarEstado(e.value)"
            [title]="e.label">
            {{ e.icon }}
          </button>
        </div>
      </div>

      <!-- Tags -->
      <div class="d-flex flex-wrap align-items-center gap-1 mb-2">
        <span *ngFor="let tag of (prospecto?.tags ?? [])"
              class="badge bg-light text-dark border d-inline-flex align-items-center gap-1"
              style="font-size:.72rem">
          #{{tag}}
          <button (click)="removeTag(tag)"
                  style="background:none;border:none;padding:0;color:#999;line-height:1;font-size:.75rem;cursor:pointer">✕</button>
        </span>
        <div class="input-group input-group-sm" style="width:150px">
          <input class="form-control form-control-sm" placeholder="+ tag"
                 [(ngModel)]="nuevoTag" (keydown.enter)="addTag()">
          <button class="btn btn-outline-secondary btn-sm" (click)="addTag()">
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>

      <!-- Sub-tabs -->
      <ul class="nav nav-tabs mb-2" style="font-size:.82rem">
        <li class="nav-item">
          <button class="nav-link py-1 px-2" [class.active]="detalleTab==='interacciones'"
                  (click)="detalleTab='interacciones'">
            <i class="bi bi-clock-history me-1"></i>Historial
            <span class="badge bg-secondary ms-1" *ngIf="rowData.length">{{rowData.length}}</span>
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link py-1 px-2" [class.active]="detalleTab==='tareas'"
                  (click)="detalleTab='tareas'; cargarTareas()">
            <i class="bi bi-check2-square me-1"></i>Tareas
            <span class="badge bg-warning text-dark ms-1" *ngIf="tareasData.length">{{tareasData.length}}</span>
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link py-1 px-2" [class.active]="detalleTab==='timeline'"
                  (click)="detalleTab='timeline'; cargarTimeline()">
            <i class="bi bi-calendar2-event me-1"></i>Timeline
          </button>
        </li>
      </ul>

      <!-- TAB: Interacciones -->
      <ng-container *ngIf="detalleTab==='interacciones'">
        <div class="text-end mb-1">
          <button class="btn btn-sm btn-outline-primary py-0" (click)="showForm = !showForm">
            <i class="bi bi-plus-lg"></i> Registrar
          </button>
        </div>

        <!-- Formulario nueva interacción -->
        <div class="border border-primary rounded p-2 mb-2 bg-white" *ngIf="showForm">
          <div class="row g-1">
            <div class="col-md-3">
              <select class="form-select form-select-sm" [(ngModel)]="intTipo"
                      (ngModelChange)="onTipoChange($event)">
                <option *ngFor="let t of tiposInteraccion" [value]="t">{{ t }}</option>
                <option [value]="ADD_TIPO_SENTINEL">➕ Agregar nuevo tipo…</option>
              </select>
            </div>
            <div class="col-md-2">
              <select class="form-select form-select-sm" [(ngModel)]="intResultado">
                <option value="positivo">Positivo</option>
                <option value="neutral">Neutral</option>
                <option value="negativo">Negativo</option>
              </select>
            </div>
            <div class="col-md-3">
              <input class="form-control form-control-sm" type="datetime-local" [(ngModel)]="intFecha" />
            </div>
            <div class="col-md-4">
              <input class="form-control form-control-sm" [(ngModel)]="intDescripcion"
                     placeholder="Descripción de la interacción..." />
            </div>
            <div class="col-md-2 d-flex gap-1">
              <button class="btn btn-sm btn-primary" (click)="guardarInteraccion()">
                <i class="bi bi-floppy"></i> Guardar
              </button>
              <button class="btn btn-sm btn-warning" (click)="showForm = false">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Grid de interacciones -->
        <ag-grid-angular
          class="ag-theme-quartz"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [defaultColDef]="defaultColDef"
          [localeText]="AG_GRID_LOCALE_ES"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          style="height:240px; width:100%">
        </ag-grid-angular>
      </ng-container>

      <!-- TAB: Tareas -->
      <ng-container *ngIf="detalleTab==='tareas'">
        <div class="text-end mb-1">
          <button class="btn btn-sm btn-outline-success py-0" (click)="showTareaForm = !showTareaForm">
            <i class="bi bi-plus-lg"></i> Nueva Tarea
          </button>
        </div>

        <!-- Formulario nueva tarea -->
        <div class="border border-success rounded p-2 mb-2 bg-white" *ngIf="showTareaForm">
          <div class="row g-1">
            <div class="col-md-3">
              <select class="form-select form-select-sm" [(ngModel)]="tareaTipo">
                <option *ngFor="let t of TIPOS_TAREA" [value]="t">{{ t }}</option>
              </select>
            </div>
            <div class="col-md-2">
              <input class="form-control form-control-sm" type="date" [(ngModel)]="tareaFechaVenc" />
            </div>
            <div class="col-md-5">
              <input class="form-control form-control-sm" [(ngModel)]="tareaDesc"
                     placeholder="¿Qué hay que hacer?" />
            </div>
            <div class="col-md-2 d-flex gap-1">
              <button class="btn btn-sm btn-success" (click)="crearTareaLocal()">
                <i class="bi bi-floppy"></i>
              </button>
              <button class="btn btn-sm btn-warning" (click)="showTareaForm = false">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loadingTareas" class="text-center py-3">
          <div class="spinner-border spinner-border-sm text-success"></div>
        </div>

        <!-- Sin tareas -->
        <div *ngIf="!loadingTareas && tareasData.length === 0"
             class="text-muted small text-center py-3">
          <i class="bi bi-check2-all"></i> Sin tareas pendientes para este prospecto
        </div>

        <!-- Lista de tareas -->
        <div *ngFor="let t of tareasData"
             class="d-flex align-items-center gap-2 mb-1 p-2 rounded border"
             [style.background]="esTareaVencida(t) ? '#fde8e8' : esTareaHoy(t) ? '#fff9e6' : '#f8fff8'">
          <span class="badge bg-info text-dark" style="font-size:.72rem;min-width:70px">{{ t.tipo }}</span>
          <span class="flex-grow-1 small">{{ t.descripcion }}</span>
          <span class="small"
                [style.color]="esTareaVencida(t) ? '#c0392b' : esTareaHoy(t) ? '#856404' : '#555'">
            <i class="bi bi-calendar2-event me-1"></i>{{ formatFechaTarea(t.fechaVencimiento) }}
            <span *ngIf="esTareaVencida(t)" class="ms-1">⚠️</span>
          </span>
          <button class="btn btn-sm btn-outline-success py-0 px-1" title="Completar"
                  (click)="completarTareaLocal(t)">
            <i class="bi bi-check-lg"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-1" title="Eliminar"
                  (click)="eliminarTareaLocal(t)">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </ng-container>

      <!-- TAB: Timeline -->
      <ng-container *ngIf="detalleTab==='timeline'">
        <div *ngIf="loadingTimeline" class="text-center py-3">
          <div class="spinner-border spinner-border-sm text-primary"></div>
        </div>
        <div *ngIf="!loadingTimeline && timelineItems.length === 0" class="text-muted small text-center py-3">
          <i class="bi bi-calendar2-x"></i> Sin actividad registrada
        </div>
        <div class="timeline-wrap">
          <div *ngFor="let item of timelineItems; let last = last" class="tl-item" [class.tl-last]="last">
            <div class="tl-dot" [ngClass]="'tl-dot-' + colorTipo(item.tipo)"></div>
            <div class="tl-content">
              <div class="d-flex align-items-center gap-2 mb-1">
                <i class="bi {{iconTipo(item.tipo)}}" [ngClass]="'text-' + colorTipo(item.tipo)"></i>
                <span class="small fw-semibold">{{labelTipo(item.tipo)}}</span>
                <span *ngIf="item.resultado" class="badge ms-1"
                      [ngClass]="item.resultado==='positivo' ? 'bg-success' : item.resultado==='negativo' ? 'bg-danger' : 'bg-secondary'"
                      style="font-size:.65rem">{{item.resultado}}</span>
                <span class="text-muted small ms-auto">{{formatFecha(item.fecha)}}</span>
              </div>
              <div class="small">{{item.descripcion}}</div>
              <div class="small text-muted" *ngIf="item.autor">
                <i class="bi bi-person me-1"></i>{{item.autor}}
              </div>
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .detail-container {
      padding: 12px 16px;
      background-color: #f0f4ff;
      border-top: 2px solid #0d6efd;
    }
    .timeline-wrap { padding: 4px 0; max-height: 260px; overflow-y: auto; }
    .tl-item { display: flex; gap: 12px; padding: 6px 0; position: relative; }
    .tl-item:not(.tl-last)::before { content:''; position:absolute; left:7px; top:20px; bottom:-6px; width:2px; background:#dee2e6; }
    .tl-dot { width:16px; height:16px; border-radius:50%; flex-shrink:0; margin-top:3px; border:2px solid #fff; box-shadow:0 0 0 2px #dee2e6; }
    .tl-dot-primary   { background:#0d6efd; }
    .tl-dot-success   { background:#198754; }
    .tl-dot-warning   { background:#ffc107; }
    .tl-dot-danger    { background:#dc3545; }
    .tl-dot-info      { background:#0dcaf0; }
    .tl-dot-secondary { background:#6c757d; }
    .tl-dot-purple    { background:#7b2d8b; }
    .tl-content { flex:1; background:#fff; border-radius:6px; padding:6px 10px; border:1px solid #e9ecef; font-size:.82rem; }
  `]
})
export class DetalleInteraccionesComponent implements OnInit {
  private svc        = inject(ProspectosService);
  private cotSvc     = inject(CotizacionesService);
  private signalsSvc = inject(SignalsService);
  private _colDefs: ColDef[] = [];

  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  prospecto: any = null;
  rowData: Interaccion[] = [];
  countCotizaciones = 0;

  // ── Interacciones ─────────────────────────────────────────────────────────
  showForm       = false;
  intTipo        = 'contacto';
  intResultado   = 'neutral';
  intFecha       = this.getCurrentDateTimeLocal();
  intDescripcion = '';

  estados          = ESTADOS_PROSPECTO;
  // Catálogo dinámico (Firestore por empresa). Se siembra con los defaults y el
  // usuario puede agregar más desde el combo con la opción "➕ Agregar nuevo tipo…".
  tiposInteraccion: string[] = [...TIPOS_INTERACCION_DEFAULT];
  readonly ADD_TIPO_SENTINEL = '__add_tipo__';

  // ── Tareas + Timeline ─────────────────────────────────────────────────────
  detalleTab: 'interacciones' | 'tareas' | 'timeline' = 'interacciones';
  tareasData: Tarea[] = [];
  loadingTareas = false;
  showTareaForm = false;
  tareaTipo = 'llamada';
  tareaDesc = '';
  tareaFechaVenc = this.getTodayDateLocal();
  readonly TIPOS_TAREA = TIPOS_TAREA;

  // Tags
  nuevoTag = '';

  // Timeline
  timelineItems: Array<{ fecha: any; tipo: string; descripcion: string; resultado?: string; autor: string }> = [];
  loadingTimeline = false;

  private readonly TIPO_META: Record<string, { icon: string; color: string; label: string }> = {
    llamada:          { icon: 'bi-telephone-fill',  color: 'primary',   label: 'Llamada' },
    email:            { icon: 'bi-envelope-fill',   color: 'info',      label: 'Email' },
    whatsapp:         { icon: 'bi-whatsapp',         color: 'success',   label: 'WhatsApp' },
    'reunión':        { icon: 'bi-people-fill',      color: 'purple',    label: 'Reunión' },
    visita:           { icon: 'bi-building',         color: 'secondary', label: 'Visita' },
    contacto:         { icon: 'bi-person-check-fill',color: 'primary',   label: 'Contacto' },
    cambio_estado:    { icon: 'bi-arrow-repeat',     color: 'warning',   label: 'Cambio Estado' },
    demo:             { icon: 'bi-laptop',           color: 'info',      label: 'Demo' },
    tarea_completada: { icon: 'bi-check-circle-fill',color: 'success',   label: 'Tarea ✓' },
  };

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }
  get idCompany(): number {
    return this.prospecto?.idCompany ?? this.signalsSvc.getRootSelectedBySidebar()();
  }

  // ── AG Grid ──────────────────────────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 28,
    rowClassRules: {
      'text-success': (p: any) => p.data?.resultado === 'positivo',
      'text-danger':  (p: any) => p.data?.resultado === 'negativo',
    },
  };

  defaultColDef: ColDef = { sortable: true, resizable: true };

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;

    this._colDefs = [
      {
        field: 'fecha', headerName: 'Fecha', width: 165,
        cellRenderer: (p: any) => this.formatFecha(p.value),
        cellStyle: { cursor: 'pointer', backgroundColor: '#fff8e1' },
        tooltipValueGetter: () => 'Doble clic para editar fecha',
        onCellDoubleClicked: (p: any) => this.editarFechaInteraccion(p.data),
      },
      {
        field: 'tipo', headerName: 'Tipo', width: 110,
        cellStyle: { cursor: 'pointer', backgroundColor: '#eefaf0' },
        tooltipValueGetter: () => 'Doble clic para editar tipo',
        onCellDoubleClicked: (p: any) => this.editarTipoInteraccion(p.data),
      },
      {
        field: 'descripcion', headerName: 'Descripcion', flex: 1,
        cellStyle: { cursor: 'pointer', backgroundColor: '#eef4ff' },
        tooltipValueGetter: () => 'Doble clic para editar descripcion',
        onCellDoubleClicked: (p: any) => this.editarDescripcionInteraccion(p.data),
      },
      {
        field: 'resultado', headerName: 'Resultado', width: 110,
        cellRenderer: (p: any) => {
          const color = p.value === 'positivo' ? 'success' : p.value === 'negativo' ? 'danger' : 'secondary';
          return `<span class="badge bg-${color}">${p.value}</span>`;
        },
      },
      { field: 'nombreVendedor', headerName: 'Por', width: 130 },
      { field: 'creadoPor', headerName: 'Canal', width: 90 },
    ];

    return this._colDefs;
  }

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  // ── AG Grid Cell Renderer interface ──────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.params    = params;
    this.prospecto = params.data;
    this.cargarInteracciones();
    this.loadTiposInteraccion();
    if (this.prospecto?.id) {
      this.cotSvc.getCotizacionesByProspecto(this.prospecto.id)
        .then(c => this.countCotizaciones = c.length);
    }
  }

  // ── Catálogo de tipos de interacción (editable por empresa) ────────────────

  private async loadTiposInteraccion() {
    const idCompany = this.idCompany;
    if (!idCompany) return;
    try {
      this.tiposInteraccion = await this.svc.getTiposInteraccion(idCompany);
      if (!this.tiposInteraccion.includes(this.intTipo)) {
        this.intTipo = this.tiposInteraccion[0] ?? 'contacto';
      }
    } catch {
      this.tiposInteraccion = [...TIPOS_INTERACCION_DEFAULT];
    }
  }

  async onTipoChange(value: string) {
    if (value !== this.ADD_TIPO_SENTINEL) return;

    const prev = this.tiposInteraccion[0] ?? 'contacto';
    const { value: nuevo } = await Swal.fire({
      title: 'Nuevo tipo de interacción',
      input: 'text',
      inputPlaceholder: 'Ej. videollamada, referido, evento…',
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => (!v || !v.trim()) ? 'Escribe un nombre' : null,
    });

    if (!nuevo || !nuevo.trim()) {
      this.intTipo = prev;   // revierte la selección del sentinel
      return;
    }

    const idCompany = this.idCompany;
    if (!idCompany) {
      Swal.fire('Atención', 'No se pudo determinar la empresa.', 'warning');
      this.intTipo = prev;
      return;
    }

    try {
      this.tiposInteraccion = await this.svc.addTipoInteraccion(idCompany, nuevo);
      // Selecciona el tipo recién agregado (respeta el nombre normalizado guardado)
      const guardado = this.tiposInteraccion.find(t => t.toLowerCase() === nuevo.trim().toLowerCase());
      this.intTipo = guardado ?? prev;
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tipo agregado', showConfirmButton: false, timer: 1500 });
    } catch {
      this.intTipo = prev;
      Swal.fire('Error', 'No se pudo guardar el nuevo tipo.', 'error');
    }
  }

  private updateCountInParent() {
    const parentNode = this.params?.node?.parent;
    const parentData = parentNode?.data;

    if (parentData) {
      parentData.countInteracciones = this.rowData.length;
      this.params.api?.refreshCells({
        rowNodes: [parentNode],
        columns: ['historial'],
        force: true,
      });
      return;
    }

    if (this.prospecto) {
      this.prospecto.countInteracciones = this.rowData.length;
    }
  }

  refresh(): boolean { return false; }

  ngOnInit() {}

  // ── Interacciones ─────────────────────────────────────────────────────────

  async cargarInteracciones() {
    if (!this.prospecto?.id) return;
    const data = await this.svc.getInteracciones(this.prospecto.id);
    this.rowData = data;
    this.updateCountInParent();
  }

  async guardarInteraccion() {
    if (!this.intDescripcion.trim()) {
      Swal.fire('Requerido', 'Escribe una descripción.', 'warning');
      return;
    }
    try {
      const result = await this.svc.registrarInteraccion(this.prospecto.id, {
        tipo:           this.intTipo,
        descripcion:    this.intDescripcion.trim(),
        fecha:          this.intFecha,
        idVendedor:     this.idVendedor,
        nombreVendedor: this.nombreVendedor,
        resultado:      this.intResultado,
      });
      this.intDescripcion = '';
      this.intFecha = this.getCurrentDateTimeLocal();
      this.showForm = false;
      await this.cargarInteracciones();
      Swal.fire({
        icon: result.synced ? 'success' : 'warning',
        title: result.synced ? 'Registrada' : 'Registrada con sincronizacion pendiente',
        timer: 1400,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire('Error', 'No se pudo registrar.', 'error');
    }
  }

  async cambiarEstado(nuevoEstado: string) {
    try {
      await this.svc.cambiarEstado(this.prospecto.id, nuevoEstado, this.idVendedor, this.nombreVendedor);
      this.prospecto.estado = nuevoEstado;
      const parentNode = this.params?.node?.parent;

      if (parentNode?.data) {
        parentNode.data.estado = nuevoEstado;
        this.params.api?.refreshCells({
          rowNodes: [parentNode],
          columns: ['estado', 'historial', 'fechaUltimaInteraccion'],
          force: true,
        });
      }
      await this.cargarInteracciones();
    } catch {
      Swal.fire('Error', 'No se pudo cambiar el estado.', 'error');
    }
  }

  async editarFechaInteraccion(interaccion: any) {
    if (!this.prospecto?.id || !interaccion?.id) return;

    const { value: nuevaFecha } = await Swal.fire({
      title: 'Editar fecha',
      input: 'datetime-local',
      inputValue: this.formatDateTimeLocal(interaccion.fecha),
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => !value ? 'Selecciona una fecha y hora.' : null,
    });

    if (!nuevaFecha) return;

    try {
      await this.svc.actualizarInteraccion(this.prospecto.id, interaccion.id, { fecha: nuevaFecha });
      interaccion.fecha = new Date(nuevaFecha);
      this.rowData = [...this.rowData];
      this.gridApi.setGridOption('rowData', this.rowData);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Fecha actualizada', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch {
      Swal.fire('Error', 'No se pudo actualizar la fecha.', 'error');
    }
  }

  async editarTipoInteraccion(interaccion: any) {
    if (!this.prospecto?.id || !interaccion?.id) return;

    const opciones = this.tiposInteraccion.reduce((acc: Record<string, string>, tipo) => {
      acc[tipo] = tipo;
      return acc;
    }, {});

    const { value: nuevoTipo } = await Swal.fire({
      title: 'Editar tipo',
      input: 'select',
      inputOptions: opciones,
      inputValue: interaccion.tipo ?? this.tiposInteraccion[0],
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => !value ? 'Selecciona un tipo.' : null,
    });

    if (!nuevoTipo) return;

    try {
      await this.svc.actualizarInteraccion(this.prospecto.id, interaccion.id, { tipo: nuevoTipo });
      interaccion.tipo = nuevoTipo;
      this.rowData = [...this.rowData];
      this.gridApi.setGridOption('rowData', this.rowData);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tipo actualizado', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch {
      Swal.fire('Error', 'No se pudo actualizar el tipo.', 'error');
    }
  }

  async editarDescripcionInteraccion(interaccion: any) {
    if (!this.prospecto?.id || !interaccion?.id) return;

    const { value: nuevaDescripcion } = await Swal.fire({
      title: 'Editar descripcion',
      input: 'text',
      inputValue: interaccion.descripcion ?? '',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => !value?.trim() ? 'Escribe una descripcion.' : null,
    });

    if (!nuevaDescripcion?.trim()) return;

    try {
      const descripcion = nuevaDescripcion.trim();
      await this.svc.actualizarInteraccion(this.prospecto.id, interaccion.id, { descripcion });
      interaccion.descripcion = descripcion;
      this.rowData = [...this.rowData];
      this.gridApi.setGridOption('rowData', this.rowData);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Descripcion actualizada', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch {
      Swal.fire('Error', 'No se pudo actualizar la descripcion.', 'error');
    }
  }

  // ── Tareas ────────────────────────────────────────────────────────────────

  async cargarTareas() {
    if (!this.prospecto?.id) return;
    this.loadingTareas = true;
    this.tareasData = await this.svc.getTareasByProspecto(this.prospecto.id);
    this.loadingTareas = false;
  }

  async crearTareaLocal() {
    if (!this.tareaDesc.trim()) {
      Swal.fire('Requerido', 'Escribe una descripción para la tarea.', 'warning');
      return;
    }
    if (!this.tareaFechaVenc) {
      Swal.fire('Requerido', 'Selecciona una fecha de vencimiento.', 'warning');
      return;
    }
    try {
      await this.svc.crearTarea({
        idProspecto:      this.prospecto.id,
        nombreProspecto:  this.prospecto.nombre ?? '',
        empresaProspecto: this.prospecto.empresa ?? '',
        tipo:             this.tareaTipo,
        descripcion:      this.tareaDesc.trim(),
        fechaVencimiento: Timestamp.fromDate(new Date(this.tareaFechaVenc + 'T12:00:00')),
        idVendedor:       this.idVendedor,
        nombreVendedor:   this.nombreVendedor,
        idCompany:        this.prospecto.idCompany ?? 0,
      });
      this.tareaDesc = '';
      this.tareaFechaVenc = this.getTodayDateLocal();
      this.showTareaForm = false;
      await this.cargarTareas();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tarea creada', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch {
      Swal.fire('Error', 'No se pudo crear la tarea.', 'error');
    }
  }

  async completarTareaLocal(tarea: Tarea) {
    try {
      await this.svc.completarTarea(tarea.id!);
      this.tareasData = this.tareasData.filter(t => t.id !== tarea.id);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '¡Tarea completada!', showConfirmButton: false, timer: 2000, timerProgressBar: true });
    } catch {
      Swal.fire('Error', 'No se pudo completar la tarea.', 'error');
    }
  }

  async eliminarTareaLocal(tarea: Tarea) {
    const res = await Swal.fire({
      title: '¿Eliminar tarea?', text: tarea.descripcion,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    try {
      await this.svc.eliminarTarea(tarea.id!);
      this.tareasData = this.tareasData.filter(t => t.id !== tarea.id);
    } catch {
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  }

  formatFechaTarea(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  esTareaVencida(t: Tarea): boolean {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const f = (t.fechaVencimiento as any)?.toDate ? (t.fechaVencimiento as any).toDate() : new Date(t.fechaVencimiento as any);
    f.setHours(0, 0, 0, 0);
    return f < hoy;
  }

  esTareaHoy(t: Tarea): boolean {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const f = (t.fechaVencimiento as any)?.toDate ? (t.fechaVencimiento as any).toDate() : new Date(t.fechaVencimiento as any);
    f.setHours(0, 0, 0, 0);
    return f.getTime() === hoy.getTime();
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async addTag() {
    const t = this.nuevoTag.toLowerCase().trim().replace(/\s+/g, '-');
    if (!t || !this.prospecto?.id) return;
    if ((this.prospecto.tags ?? []).includes(t)) { this.nuevoTag = ''; return; }
    await this.svc.addTag(this.prospecto.id, t);
    this.prospecto.tags = [...(this.prospecto.tags ?? []), t];
    this.refreshTagsInParent();
    this.nuevoTag = '';
  }

  async removeTag(tag: string) {
    if (!this.prospecto?.id) return;
    await this.svc.removeTag(this.prospecto.id, tag);
    this.prospecto.tags = (this.prospecto.tags ?? []).filter((x: string) => x !== tag);
    this.refreshTagsInParent();
  }

  private refreshTagsInParent() {
    const parentNode = this.params?.node?.parent;
    if (parentNode?.data) {
      parentNode.data.tags = this.prospecto.tags;
      this.params.api?.refreshCells({ rowNodes: [parentNode], columns: ['tags'], force: true });
    }
  }

  // ── Timeline ─────────────────────────────────────────────────────────────

  async cargarTimeline() {
    if (!this.prospecto?.id) return;
    this.loadingTimeline = true;
    const [interacciones, tareasOk] = await Promise.all([
      this.rowData.length ? Promise.resolve(this.rowData) : this.svc.getInteracciones(this.prospecto.id),
      this.svc.getTareasCompletadasByProspecto(this.prospecto.id),
    ]);
    const fromInter = interacciones.map((i: any) => ({
      fecha: i.fecha, tipo: i.tipo, descripcion: i.descripcion,
      resultado: i.resultado, autor: i.nombreVendedor ?? '',
    }));
    const fromTareas = tareasOk.map(t => ({
      fecha: t.fechaCompletada ?? t.fechaCreacion,
      tipo: 'tarea_completada',
      descripcion: `[${t.tipo}] ${t.descripcion}`,
      resultado: 'positivo',
      autor: t.nombreVendedor,
    }));
    this.timelineItems = [...fromInter, ...fromTareas]
      .sort((a, b) => this.getMs(b.fecha) - this.getMs(a.fecha));
    this.loadingTimeline = false;
  }

  private getMs(ts: any): number {
    if (!ts) return 0;
    if (ts.toDate) return ts.toDate().getTime();
    if (ts.seconds) return ts.seconds * 1000;
    return new Date(ts).getTime();
  }

  iconTipo(tipo: string)  { return (this.TIPO_META[tipo] ?? this.TIPO_META['contacto']).icon; }
  colorTipo(tipo: string) { return (this.TIPO_META[tipo] ?? this.TIPO_META['contacto']).color; }
  labelTipo(tipo: string) { return (this.TIPO_META[tipo] ?? { label: tipo }).label; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  estadoColor(val: string) { return ESTADOS_PROSPECTO.find(e => e.value === val)?.color ?? 'secondary'; }
  estadoLabel(val: string) { return ESTADOS_PROSPECTO.find(e => e.value === val)?.label ?? val; }
  estadoIcon(val: string)  { return ESTADOS_PROSPECTO.find(e => e.value === val)?.icon  ?? '•'; }

  private getCurrentDateTimeLocal(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 16);
  }

  private getTodayDateLocal(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  private formatDateTimeLocal(ts: any): string {
    if (!ts) return this.getCurrentDateTimeLocal();
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  }

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

