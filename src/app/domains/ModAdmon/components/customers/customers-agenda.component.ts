import { Component, inject, Input, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaService, AgendaCliente, TIPOS_AGENDA } from 'app/services/agenda.service';
import { SignalsService } from 'app/services/signals.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-customers-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="agenda-wrapper">

      <!-- ── Barra de herramientas ────────────────────────────────────────── -->
      <div class="d-flex align-items-center gap-2 px-3 py-2 border-bottom flex-wrap"
           style="background:#f0fff4;">
        <i class="bi bi-calendar-check text-success"></i>
        <span class="fw-semibold small">
          Agenda — <strong>{{ customer?.nameContact || customer?.company }}</strong>
        </span>

        <div class="ms-auto d-flex gap-1">
          <button class="btn btn-sm btn-success" (click)="showForm = !showForm"
                  title="Nueva actividad">
            <i class="bi bi-plus-lg me-1"></i> Nueva
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelected()"
                  [disabled]="!selectedItem" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <!-- ── Formulario rápido ─────────────────────────────────────────────── -->
      <div *ngIf="showForm" class="p-3 border-bottom" style="background:#f8fff8;">
        <div class="row g-2">
          <div class="col-md-2">
            <label class="form-label form-label-sm mb-0">Tipo</label>
            <select class="form-select form-select-sm" [(ngModel)]="newItem.tipo">
              <option *ngFor="let t of TIPOS_AGENDA" [value]="t.value">
                {{ t.icon }} {{ t.label }}
              </option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label form-label-sm mb-0">Título *</label>
            <input class="form-control form-control-sm" [(ngModel)]="newItem.titulo"
                   placeholder="Ej. Presentación de propuesta" />
          </div>
          <div class="col-md-3">
            <label class="form-label form-label-sm mb-0">Fecha y hora</label>
            <input type="datetime-local" class="form-control form-control-sm"
                   [(ngModel)]="newItem.fechaHora" />
          </div>
          <div class="col-md-3">
            <label class="form-label form-label-sm mb-0">Notas</label>
            <input class="form-control form-control-sm" [(ngModel)]="newItem.descripcion"
                   placeholder="Opcional" />
          </div>
        </div>
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-sm btn-primary" (click)="guardarNuevo()">
            <i class="bi bi-floppy me-1"></i> Guardar
          </button>
          <button class="btn btn-sm btn-secondary" (click)="showForm = false; resetNew()">
            Cancelar
          </button>
        </div>
      </div>

      <!-- ── Lista de eventos ──────────────────────────────────────────────── -->
      <div class="agenda-list p-2">
        <div *ngIf="rowData.length === 0" class="text-center text-muted py-4 small">
          <i class="bi bi-calendar3 fs-4 d-block mb-2"></i>
          Sin eventos. Haz clic en <strong>Nueva</strong> para agregar uno.
        </div>

        <div *ngFor="let ev of rowData"
             class="agenda-card mb-2 p-2 rounded border"
             [class.selected-card]="selectedItem?.id === ev.id"
             [class.completado-card]="ev.completada"
             (click)="selectItem(ev)">

          <div class="d-flex align-items-center gap-2">
            <!-- Tipo badge -->
            <span class="badge" [ngClass]="'bg-' + getTipoBadge(ev.tipo)">
              {{ getTipoIcon(ev.tipo) }} {{ getTipoLabel(ev.tipo) }}
            </span>

            <!-- Título -->
            <span class="fw-semibold small flex-grow-1"
                  [class.text-decoration-line-through]="ev.completada">
              {{ ev.titulo }}
            </span>

            <!-- Fecha -->
            <span class="text-muted small ms-auto">
              <i class="bi bi-clock me-1"></i>{{ formatFecha(ev.fechaHora) }}
            </span>

            <!-- Completada toggle -->
            <button class="btn btn-xs p-0 px-1"
                    [class.btn-outline-success]="!ev.completada"
                    [class.btn-success]="ev.completada"
                    (click)="toggleCompletada(ev, $event)"
                    title="{{ ev.completada ? 'Marcar pendiente' : 'Marcar completada' }}">
              <i class="bi" [class.bi-check2-circle]="ev.completada"
                            [class.bi-circle]="!ev.completada"></i>
            </button>
          </div>

          <!-- Descripción -->
          <div *ngIf="ev.descripcion" class="text-muted small ps-1 mt-1">
            {{ ev.descripcion }}
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .agenda-wrapper {
      background: #f0fff4;
      border-top: 2px solid #198754;
      min-height: 180px;
    }
    .agenda-list { max-height: 500px; overflow-y: auto; }
    .agenda-card {
      cursor: pointer;
      background: #fff;
      transition: box-shadow 0.15s;
    }
    .agenda-card:hover { box-shadow: 0 2px 6px rgba(0,0,0,.1); }
    .selected-card { border-color: #198754 !important; background: #f0fff4 !important; }
    .completado-card { opacity: 0.6; }
    .btn-xs { font-size: 0.75rem; line-height: 1.2; }
  `],
})
export class CustomersAgendaComponent implements OnChanges, OnDestroy {
  private trackingService = inject(TrackingService);
  private agendaSvc  = inject(AgendaService);
  private signalsSvc = inject(SignalsService);

  @Input() inputCustomer:  any;
  @Input() inputIdCompany: number = 0;

  TIPOS_AGENDA = TIPOS_AGENDA;

  customer:     any    = null;
  idCompany:    number = 0;
  rowData:      AgendaCliente[] = [];
  selectedItem: AgendaCliente | null = null;
  showForm:     boolean = false;

  newItem: Partial<AgendaCliente> = {};

  private sub?: Subscription;

  ngOnChanges() {
    if (this.inputCustomer) {
      this.customer  = this.inputCustomer;
      this.idCompany = this.inputIdCompany || this.signalsSvc.getRootSelectedBySidebar()();
      this.cargarDatos();
    }
  }

  cargarDatos() {
    this.sub?.unsubscribe();
    if (!this.customer?.id || !this.idCompany) return;
    this.sub = this.agendaSvc.getByCliente(this.customer.id, this.idCompany).subscribe({
      next: (data) => {
        this.rowData = data.sort(
          (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()
        );
      },
      error: (err) => console.error('[CustomersAgenda] Error:', err),
    });
  }

  selectItem(ev: AgendaCliente) {
    this.selectedItem = this.selectedItem?.id === ev.id ? null : ev;
  }

  resetNew() {
    this.newItem = {};
  }

  async guardarNuevo() {
    if (!this.newItem.titulo?.trim()) {
      Swal.fire({ icon: 'warning', title: 'El título es obligatorio', timer: 1500, showConfirmButton: false });
      return;
    }
    if (!this.newItem.fechaHora) {
      Swal.fire({ icon: 'warning', title: 'Selecciona fecha y hora', timer: 1500, showConfirmButton: false });
      return;
    }

    const item: Partial<AgendaCliente> = {
      idCliente:    this.customer.id,
      idCompany:    this.idCompany,
      tipo:         this.newItem.tipo ?? 'visita',
      titulo:       this.newItem.titulo!.trim(),
      descripcion:  this.newItem.descripcion,
      fechaHora:    new Date(this.newItem.fechaHora!).toISOString(),
      completada:   false,
    };

    this.agendaSvc.create(item).subscribe({
      next: (created) => {
        this.rowData = [...this.rowData, created].sort(
          (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()
        );
        this.showForm = false;
        this.resetNew();
      },
      error: (err) => {
        console.error('[CustomersAgenda] Error al crear:', err);
        Swal.fire('Error', 'No se pudo guardar el evento.', 'error');
      },
    });
  }

  toggleCompletada(ev: AgendaCliente, e: Event) {
    e.stopPropagation();
    const updated = { ...ev, completada: !ev.completada };
    this.agendaSvc.update(ev.id!, updated).subscribe({
      next: (res) => {
        const idx = this.rowData.findIndex(r => r.id === ev.id);
        if (idx !== -1) this.rowData[idx] = res;
        this.rowData = [...this.rowData];
      },
    });
  }

  async deleteSelected() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó customers agenda', 'Admon', this.trackingService.getEmail());
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar evento?',
      text: this.selectedItem.titulo,
      icon: 'warning',
      showCancelButton:   true,
      confirmButtonColor: '#dc3545',
      confirmButtonText:  'Sí, eliminar',
      cancelButtonText:   'Cancelar',
    });
    if (!res.isConfirmed) return;

    this.agendaSvc.delete(this.selectedItem.id!).subscribe({
      next: () => {
        this.rowData      = this.rowData.filter(r => r.id !== this.selectedItem?.id);
        this.selectedItem = null;
      },
      error: () => Swal.fire('Error', 'No se pudo eliminar el evento.', 'error'),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getTipoIcon(tipo: string)  { return TIPOS_AGENDA.find(t => t.value === tipo)?.icon  ?? '📅'; }
  getTipoLabel(tipo: string) { return TIPOS_AGENDA.find(t => t.value === tipo)?.label ?? tipo; }
  getTipoBadge(tipo: string) { return TIPOS_AGENDA.find(t => t.value === tipo)?.color ?? 'secondary'; }

  formatFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
