import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { DemosService, Demo, ESTADOS_DEMO } from 'app/services/demos.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-demos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <section class="col-12 mt-2">

      <!-- Filtros y acciones -->
      <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">

        <!-- Filtro estado -->
        <div class="d-flex align-items-center gap-2">
          <label class="form-label small fw-semibold mb-0">Estado:</label>
          <select class="form-select form-select-sm" style="width:180px"
                  [(ngModel)]="filtroEstado" (change)="aplicarFiltro()">
            <option value="">Todos</option>
            <option *ngFor="let e of estados" [value]="e.value">
              {{ e.icon }} {{ e.label }}
            </option>
          </select>
        </div>

        <!-- Badge total -->
        <span class="badge bg-secondary">{{ rowDataFiltrada.length }} registro(s)</span>

        <!-- Botón exportar -->
        <button class="btn btn-sm btn-outline-success ms-auto"
                (click)="exportar()" [disabled]="!rowDataFiltrada.length" title="Exportar CSV">
          <i class="bi bi-file-earmark-excel"></i> Exportar
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="cargando" class="text-center py-5 text-muted">
        <div class="spinner-border spinner-border-sm me-2"></div> Cargando solicitudes…
      </div>

      <!-- Grid -->
      <ag-grid-angular
        *ngIf="!cargando"
        class="ag-theme-quartz small-text-ag-grid"
        style="width:100%; height:72vh"
        [rowData]="rowDataFiltrada"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)">
      </ag-grid-angular>

      <!-- Modal cambio de estado -->
      <div class="modal fade" id="modalEstado" tabindex="-1">
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white py-2">
              <h6 class="modal-title mb-0"><i class="bi bi-pencil-square me-1"></i> Cambiar Estado</h6>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="small mb-2 text-muted">
                <strong>{{ demoSeleccionado?.nombre }}</strong><br>
                <span>{{ demoSeleccionado?.empresa }}</span>
              </p>
              <select class="form-select form-select-sm" [(ngModel)]="nuevoEstado">
                <option *ngFor="let e of estados" [value]="e.value">
                  {{ e.icon }} {{ e.label }}
                </option>
              </select>
            </div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-sm btn-primary"
                      (click)="guardarEstado()" [disabled]="guardando">
                <span *ngIf="guardando" class="spinner-border spinner-border-sm me-1"></span>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

    </section>
  `,
})
export class DemosComponent implements OnInit, OnDestroy {
  private svc = inject(DemosService);

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  estados           = ESTADOS_DEMO;

  gridApi!: GridApi;
  cargando          = true;
  guardando         = false;
  filtroEstado      = '';

  rowData:         Demo[] = [];
  rowDataFiltrada: Demo[] = [];

  demoSeleccionado: Demo | null = null;
  nuevoEstado = '';

  private sub?: Subscription;
  private modalEl: any;

  defaultColDef: ColDef = {
    sortable: true, resizable: true, filter: true, minWidth: 80,
  };

  colDefs: ColDef[] = [
    {
      headerName: 'Estado',
      field: 'estado',
      width: 145,
      pinned: 'left',
      cellRenderer: (p: ICellRendererParams) => {
        const e = ESTADOS_DEMO.find(x => x.value === p.value);
        if (!e) return p.value ?? '';
        return `<span class="badge bg-${e.color} text-white">${e.icon} ${e.label}</span>`;
      },
    },
    { headerName: 'Nombre',   field: 'nombre',   width: 180 },
    { headerName: 'Empresa',  field: 'empresa',  width: 180 },
    { headerName: 'Email',    field: 'email',    width: 200 },
    { headerName: 'Teléfono', field: 'telefono', width: 130 },
    { headerName: 'Rol',      field: 'rol',      width: 140 },
    {
      headerName: 'Fecha Solicitud',
      field: 'fechaCreacion',
      width: 160,
      valueFormatter: (p) => {
        if (!p.value) return '';
        const d: Date = p.value?.toDate ? p.value.toDate() : new Date(p.value);
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      headerName: 'Última Act.',
      field: 'fechaUltimaActualizacion',
      width: 150,
      valueFormatter: (p) => {
        if (!p.value) return '';
        const d: Date = p.value?.toDate ? p.value.toDate() : new Date(p.value);
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      },
    },
    {
      headerName: '',
      field: 'id',
      width: 110,
      sortable: false,
      filter: false,
      pinned: 'right',
      cellRenderer: () =>
        `<button class="btn btn-xs btn-outline-primary py-0 px-2 btn-cambiar-estado" style="font-size:0.75rem">
           <i class="bi bi-pencil"></i> Estado
         </button>`,
      onCellClicked: (p) => this.abrirModal(p.data),
    },
  ];

  gridOptions = {
    rowHeight: 36,
    suppressCellFocus: true,
    rowClassRules: {
      'table-warning': (p: any) => p.data?.estado === 'pendiente',
      'table-success': (p: any) => p.data?.estado === 'aprobado',
    },
  };

  ngOnInit(): void {
    this.sub = this.svc.getAll().subscribe(data => {
      this.rowData  = data;
      this.cargando = false;
      this.aplicarFiltro();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
  }

  aplicarFiltro(): void {
    this.rowDataFiltrada = this.filtroEstado
      ? this.rowData.filter(d => d.estado === this.filtroEstado)
      : [...this.rowData];
  }

  abrirModal(demo: Demo): void {
    this.demoSeleccionado = demo;
    this.nuevoEstado      = demo.estado;
    // Bootstrap 5 modal
    if (!this.modalEl) {
      const el = document.getElementById('modalEstado');
      if (el) {
        const { Modal } = (window as any).bootstrap;
        this.modalEl = new Modal(el);
      }
    }
    this.modalEl?.show();
  }

  async guardarEstado(): Promise<void> {
    if (!this.demoSeleccionado?.id) return;
    this.guardando = true;
    try {
      await this.svc.cambiarEstado(this.demoSeleccionado.id, this.nuevoEstado);
      this.modalEl?.hide();
    } finally {
      this.guardando = false;
    }
  }

  exportar(): void {
    this.gridApi?.exportDataAsCsv({ fileName: 'demos.csv' });
  }
}
