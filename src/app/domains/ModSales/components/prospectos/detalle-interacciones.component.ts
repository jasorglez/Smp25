import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ProspectosService, Interaccion, ESTADOS_PROSPECTO } from 'app/services/prospectos.service';
import { SignalsService } from 'app/services/signals.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detalle-interacciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-container">

      <!-- Toolbar detalle -->
      <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">

        <!-- Info del prospecto -->
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

        <div class="ms-auto d-flex gap-1 align-items-center flex-wrap">
          <!-- Cambiar estado rápido -->
          <span class="small text-muted me-1">Cambiar a:</span>
          <button *ngFor="let e of estados"
            class="btn btn-sm py-0 px-1"
            [ngClass]="'btn-outline-' + e.color"
            [disabled]="prospecto?.estado === e.value"
            (click)="cambiarEstado(e.value)"
            [title]="e.label">
            {{ e.icon }}
          </button>

          <div class="vr mx-1"></div>

          <!-- Registrar interacción -->
          <button class="btn btn-sm btn-outline-primary py-0" (click)="showForm = !showForm">
            <i class="bi bi-plus-lg"></i> Registrar
          </button>
        </div>
      </div>

      <!-- Formulario nueva interacción -->
      <div class="border border-primary rounded p-2 mb-2 bg-white" *ngIf="showForm">
        <div class="row g-1">
          <div class="col-md-3">
            <select class="form-select form-select-sm" [(ngModel)]="intTipo">
              <option *ngFor="let t of tiposInteraccion" [value]="t">{{ t }}</option>
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
        style="height:280px; width:100%">
      </ag-grid-angular>

    </div>
  `,
  styles: [`
    .detail-container {
      padding: 12px 16px;
      background-color: #f0f4ff;
      border-top: 2px solid #0d6efd;
    }
  `]
})
export class DetalleInteraccionesComponent implements OnInit {
  private svc        = inject(ProspectosService);
  private signalsSvc = inject(SignalsService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  prospecto: any = null;
  rowData: Interaccion[] = [];

  showForm       = false;
  intTipo        = 'contacto';
  intResultado   = 'neutral';
  intFecha       = this.getCurrentDateTimeLocal();
  intDescripcion = '';

  estados          = ESTADOS_PROSPECTO;
  tiposInteraccion = ['contacto', 'llamada', 'reunión', 'email', 'whatsapp', 'visita'];

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

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

  legacyColDefs: ColDef[] = [
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
    { field: 'descripcion', headerName: 'Descripción', flex: 1    },
    {
      field: 'descripcion', headerName: 'DescripciÃ³n', flex: 1,
      cellStyle: { cursor: 'pointer', backgroundColor: '#eef4ff' },
      tooltipValueGetter: () => 'Doble clic para editar descripciÃ³n',
      onCellDoubleClicked: (p: any) => this.editarDescripcionInteraccion(p.data),
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
    { field: 'creadoPor',      headerName: 'Canal', width: 90 },
  ];

  get colDefs(): ColDef[] {
    return [
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
  }

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  // ── AG Grid Cell Renderer interface ──────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.params    = params;
    this.prospecto = params.data;
    this.cargarInteracciones();
  }

  private updateCountInParent() {
    if (this.params?.node) {
      this.params.node.setDataValue('countInteracciones', this.rowData.length);
    }
  }

  refresh(): boolean { return false; }

  ngOnInit() {}

  // ── Datos ─────────────────────────────────────────────────────────────────

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
      await this.svc.registrarInteraccion(this.prospecto.id, {
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
      await this.cargarInteracciones();  // ya llama updateCountInParent()
      Swal.fire({ icon: 'success', title: 'Registrada', timer: 1000, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo registrar.', 'error');
    }
  }

  async cambiarEstado(nuevoEstado: string) {
    try {
      await this.svc.cambiarEstado(this.prospecto.id, nuevoEstado, this.idVendedor, this.nombreVendedor);
      this.prospecto.estado = nuevoEstado;
      // Actualizar la fila del maestro
      if (this.params?.node) {
        this.params.node.setDataValue('estado', nuevoEstado);
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
      Swal.fire({ icon: 'success', title: 'Fecha actualizada', timer: 1000, showConfirmButton: false });
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
      Swal.fire({ icon: 'success', title: 'Tipo actualizado', timer: 1000, showConfirmButton: false });
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
      Swal.fire({ icon: 'success', title: 'Descripcion actualizada', timer: 1000, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo actualizar la descripcion.', 'error');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  estadoColor(val: string) { return ESTADOS_PROSPECTO.find(e => e.value === val)?.color ?? 'secondary'; }
  estadoLabel(val: string) { return ESTADOS_PROSPECTO.find(e => e.value === val)?.label ?? val; }
  estadoIcon(val: string)  { return ESTADOS_PROSPECTO.find(e => e.value === val)?.icon  ?? '•'; }

  private getCurrentDateTimeLocal(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 16);
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
