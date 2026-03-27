import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CursosService, Curso } from 'app/services/cursos.service';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { lastValueFrom } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mis-cursos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <section class="col-12 mt-2">
      <div class="row">

        <!-- Botonera lateral -->
        <div class="col-auto">
          <div class="d-flex flex-column gap-1">
            <button class="btn btn-success" (click)="abrirModal()" title="Agregar curso">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="btn btn-warning" (click)="expandirCupo()" [disabled]="!selectedItem" title="Expandir cupo">
              <i class="bi bi-arrow-up-circle"></i>
            </button>
            <button class="btn btn-danger" (click)="eliminar()" [disabled]="!selectedItem" title="Desactivar curso">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>

        <!-- Grid -->
        <main class="col">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            style="width:100%; height:75vh"
            [rowData]="rowData"
            [columnDefs]="colDefs"
            [defaultColDef]="defaultColDef"
            [gridOptions]="gridOptions"
            [localeText]="AG_GRID_LOCALE_ES"
            (gridReady)="onGridReady($event)">
          </ag-grid-angular>
        </main>
      </div>
    </section>

    <!-- ══ MODAL ══ -->
    <div *ngIf="showModal" class="modal-backdrop-custom" (click)="cerrarModal()"></div>
    <div *ngIf="showModal" class="modal-curso shadow">
      <div class="modal-curso-header">
        <i class="bi bi-mortarboard-fill me-2"></i>
        <span class="fw-semibold small">{{ editando ? 'Editar curso' : 'Nuevo curso' }}</span>
        <button type="button" class="btn-close ms-auto btn-close-white btn-close-sm" (click)="cerrarModal()"></button>
      </div>
      <div class="modal-curso-body">
        <div class="row g-2">

          <div class="col-md-8">
            <label class="form-label small fw-semibold mb-1">Nombre <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm" [(ngModel)]="form.nombre" placeholder="Ej: Curso Gemini Avanzado">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold mb-1">Slug (URL) <i class="bi bi-question-circle text-muted" title="Identificador en ?c="></i></label>
            <div class="input-group input-group-sm">
              <span class="input-group-text">?c=</span>
              <input class="form-control form-control-sm" [(ngModel)]="form.slug" placeholder="gemini-ene2026">
            </div>
          </div>

          <div class="col-12">
            <label class="form-label small fw-semibold mb-1">Descripción</label>
            <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="form.descripcion"></textarea>
          </div>

          <div class="col-md-4">
            <label class="form-label small fw-semibold mb-1">Fecha inicio</label>
            <input type="date" class="form-control form-control-sm" [(ngModel)]="fechaInicioStr">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold mb-1">Fecha fin</label>
            <input type="date" class="form-control form-control-sm" [(ngModel)]="fechaFinStr">
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-semibold mb-1">Días</label>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="form.diasDuracion" min="1">
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-semibold mb-1">Cupo máx.</label>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="form.cupoMax" min="1">
          </div>

          <div class="col-md-5">
            <label class="form-label small fw-semibold mb-1">Horario</label>
            <input class="form-control form-control-sm" [(ngModel)]="form.horario" placeholder="9:00 AM – 1:00 PM">
          </div>
          <div class="col-md-3 d-flex align-items-end pb-1 gap-3">
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="esGratuito" [(ngModel)]="form.esGratuito">
              <label class="form-check-label small" for="esGratuito">Gratuito</label>
            </div>
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="activo" [(ngModel)]="form.activo">
              <label class="form-check-label small" for="activo">Activo</label>
            </div>
          </div>
          <div class="col-md-2" *ngIf="!form.esGratuito">
            <label class="form-label small fw-semibold mb-1">Precio</label>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="form.precio" min="0">
          </div>
          <div class="col-md-2" *ngIf="!form.esGratuito">
            <label class="form-label small fw-semibold mb-1">Moneda</label>
            <select class="form-select form-select-sm" [(ngModel)]="form.moneda">
              <option>MXN</option><option>USD</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label small fw-semibold mb-1"><i class="bi bi-person-badge me-1"></i>Instructor</label>
            <input class="form-control form-control-sm" [(ngModel)]="form.instructor" placeholder="Nombre del instructor">
          </div>

          <div class="col-md-6">
            <label class="form-label small fw-semibold mb-1"><i class="bi bi-telegram me-1"></i>Chat ID Telegram</label>
            <input class="form-control form-control-sm" [(ngModel)]="form.telegramChatId" placeholder="-1001234567890">
          </div>

          <div class="col-12">
            <label class="form-label small fw-semibold mb-1"><i class="bi bi-camera-video me-1"></i>Liga de reunión</label>
            <input class="form-control form-control-sm" [(ngModel)]="form.reunionUrl" placeholder="https://teams.microsoft.com/meet/... o Zoom/Meet">
          </div>

          <div class="col-12" *ngIf="form.slug">
            <label class="form-label small fw-semibold mb-1 text-success"><i class="bi bi-link-45deg me-1"></i>Link para compartir</label>
            <div>
              <a [href]="getLinkCompartir(form.slug)" target="_blank" rel="noopener noreferrer"
                 class="small d-inline-block text-break border rounded px-2 py-1 bg-light mw-100">
                {{ getLinkCompartir(form.slug) }}
              </a>
            </div>
          </div>

        </div>
      </div>
      <div class="modal-curso-footer">
        <button class="btn btn-sm btn-secondary" (click)="cerrarModal()">Cancelar</button>
        <button class="btn btn-sm btn-primary" (click)="guardar()" [disabled]="guardando">
          <span *ngIf="guardando" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!guardando" class="bi bi-floppy me-1"></i>
          {{ guardando ? 'Guardando...' : (editando ? 'Actualizar' : 'Crear') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop-custom { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:1050; }
    .modal-curso {
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:620px; max-width:96vw; max-height:88vh;
      background:#fff; border-radius:6px; z-index:1060;
      overflow:hidden; display:flex; flex-direction:column;
    }
    .modal-curso-header {
      background:#003366; color:#fff; padding:8px 14px;
      display:flex; align-items:center; flex-shrink:0;
    }
    .modal-curso-body { padding:12px 14px; overflow-y:auto; flex:1; }
    .modal-curso-footer {
      padding:8px 14px; background:#f8f9fa;
      display:flex; justify-content:flex-end; gap:6px;
      border-top:1px solid #dee2e6; flex-shrink:0;
    }
  `],
})
export class MisCursosComponent implements OnInit {
  private svc        = inject(CursosService);
  private signalsSvc = inject(SignalsService);
  private rootSvc    = inject(RootService);

  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  rowData: Curso[] = [];
  selectedItem: Curso | null = null;
  showModal = false;
  editando  = false;
  guardando = false;

  fechaInicioStr = '';
  fechaFinStr    = '';
  form: Partial<Curso> = this.formVacio();
  private root = 0;

  defaultColDef: ColDef = { sortable: true, resizable: true, minWidth: 80 };

  colDefs: ColDef[] = [
    { field: 'nombre', headerName: 'Curso', flex: 2 },
    { field: 'slug',   headerName: 'Slug',  width: 150 },
    {
      field: 'cupo', headerName: 'Cupo', width: 80,
      valueGetter: (p) => `${p.data?.cupoUsado ?? 0}/${p.data?.cupoMax ?? 0}`,
      cellStyle: (p: any) =>
        (p.data?.cupoUsado ?? 0) >= (p.data?.cupoMax ?? 1) ? { color: '#dc3545', fontWeight: 'bold' } : {},
    },
    { field: 'instructor',  headerName: 'Instructor', width: 140 },
    { field: 'fechaInicio', headerName: 'Inicio', width: 110, valueFormatter: (p) => this.fmtDate(p.value) },
    { field: 'horario',     headerName: 'Horario', width: 130 },
    {
      field: 'esGratuito', headerName: 'Precio', width: 100,
      cellRenderer: (p: any) => p.data?.esGratuito
        ? '<span class="badge bg-success">Gratis</span>'
        : `<span class="badge bg-primary">$${p.data?.precio} ${p.data?.moneda}</span>`,
    },
    {
      field: 'activo', headerName: 'Estado', width: 80,
      cellRenderer: (p: any) => p.value
        ? '<span class="badge bg-success">Activo</span>'
        : '<span class="badge bg-secondary">Inactivo</span>',
    },
    {
      field: 'link', headerName: 'Enlace', flex: 1, minWidth: 160, maxWidth: 320, sortable: false,
      cellRenderer: (p: any) => this.renderCeldaLinkRegistro(p),
    },
  ];

  gridOptions: any = {
    headerHeight: 35, rowHeight: 28,
    rowSelection: 'single',
    onRowClicked:       (e: any) => { this.selectedItem = e.data; },
    onRowDoubleClicked: (e: any) => { this.selectedItem = e.data; this.abrirModal(e.data); },
  };

  constructor() {
    effect(() => {
      this.root = this.signalsSvc.getRootSelectedBySidebar()();
      if (this.root) this.cargar();
    });
  }

  ngOnInit() {}
  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  cargar() {
    this.svc.getCursos(this.root).subscribe(data => {
      this.rowData = data.sort((a, b) => (b.fechaInicio as any)?.seconds - (a.fechaInicio as any)?.seconds);
    });
  }

  formVacio(): Partial<Curso> {
    return { nombre: '', slug: '', descripcion: '', horario: '', diasDuracion: 1,
             esGratuito: true, precio: 0, moneda: 'MXN', cupoMax: 30, activo: true,
             instructor: '', telegramChatId: '', logoUrl: '', logo2Url: '', reunionUrl: '' };
  }

  async abrirModal(curso?: Curso) {
    this.editando = !!curso;
    if (curso) {
      this.form           = { ...curso };
      this.fechaInicioStr = this.tsToInput(curso.fechaInicio);
      this.fechaFinStr    = this.tsToInput(curso.fechaFin);
    } else {
      this.form           = this.formVacio();
      this.fechaInicioStr = '';
      this.fechaFinStr    = '';
      try {
        const root: any = await lastValueFrom(this.rootSvc.getRootbyId(this.root));
        this.form.logoUrl  = root?.picture  ?? '';
        this.form.logo2Url = root?.picture2 ?? '';
      } catch {}
    }
    this.showModal = true;
  }

  cerrarModal() { this.showModal = false; }

  async guardar() {
    if (!this.form.nombre?.trim() || !this.form.slug?.trim()) {
      Swal.fire('Atención', 'Nombre y slug son requeridos.', 'warning'); return;
    }
    this.guardando = true;
    try {
      this.form.fechaInicio = this.inputToTs(this.fechaInicioStr);
      this.form.fechaFin    = this.inputToTs(this.fechaFinStr);
      if (this.editando && this.form.id) {
        await this.svc.actualizarCurso(this.form.id, this.form);
      } else {
        this.form.idCompany = this.root;
        await this.svc.crearCurso(this.form);
      }
      this.cerrarModal();
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1300, showConfirmButton: false });
    } catch { Swal.fire('Error', 'No se pudo guardar.', 'error'); }
    finally   { this.guardando = false; }
  }

  async expandirCupo() {
    if (!this.selectedItem) return;
    const { value } = await Swal.fire({
      title: 'Expandir cupo',
      text: `Actual: ${this.selectedItem.cupoMax}. Nuevo cupo:`,
      input: 'number', inputValue: this.selectedItem.cupoMax,
      showCancelButton: true, confirmButtonText: 'Guardar',
    });
    if (!value) return;
    await this.svc.expandirCupo(this.selectedItem.id!, Number(value));
    Swal.fire({ icon: 'success', title: 'Cupo actualizado', timer: 1300, showConfirmButton: false });
  }

  async eliminar() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Desactivar curso?', text: this.selectedItem.nombre,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545', confirmButtonText: 'Sí',
    });
    if (!res.isConfirmed) return;
    await this.svc.actualizarCurso(this.selectedItem.id!, { activo: false });
    this.selectedItem = null;
  }

  getLinkCompartir(slug: string) { return `${window.location.origin}/registrocursos?c=${slug}`; }

  /** Enlace HTML para la grilla: abre en nueva pestaña y no altera la selección de fila. */
  renderCeldaLinkRegistro(p: any): string {
    const slug = p.data?.slug as string | undefined;
    if (!slug) return '';
    const url = this.getLinkCompartir(slug);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="small text-truncate d-inline-block align-middle" style="max-width:100%" title="${esc(url)}" onclick="event.stopPropagation()">${esc(url)}</a>`;
  }

  private tsToInput(ts: Timestamp): string {
    if (!ts) return '';
    return (ts.toDate ? ts.toDate() : new Date(ts as any)).toISOString().substring(0, 10);
  }
  private inputToTs(str: string): Timestamp {
    return str ? Timestamp.fromDate(new Date(str)) : Timestamp.now();
  }
  fmtDate(ts: any): string {
    if (!ts) return '';
    return (ts.toDate ? ts.toDate() : new Date(ts))
      .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
