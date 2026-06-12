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
          <div class="col-md-5">
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

  colDefs: ColDef[] = [
    {
      field: 'fecha', headerName: 'Fecha', width: 165,
      cellRenderer: (p: any) => this.formatFecha(p.value),
    },
    { field: 'tipo',        headerName: 'Tipo',        width: 110 },
    { field: 'descripcion', headerName: 'Descripción', flex: 1    },
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
        idVendedor:     this.idVendedor,
        nombreVendedor: this.nombreVendedor,
        resultado:      this.intResultado,
      });
      this.intDescripcion = ''; this.showForm = false;
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  estadoColor(val: string) { return ESTADOS_PROSPECTO.find(e => e.value === val)?.color ?? 'secondary'; }
  estadoLabel(val: string) { return ESTADOS_PROSPECTO.find(e => e.value === val)?.label ?? val; }
  estadoIcon(val: string)  { return ESTADOS_PROSPECTO.find(e => e.value === val)?.icon  ?? '•'; }

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
