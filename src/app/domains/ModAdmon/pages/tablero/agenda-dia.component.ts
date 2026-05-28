import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaService, AgendaCliente, NotificationConfig, TIPOS_AGENDA } from 'app/services/agenda.service';
import { SignalsService } from 'app/services/signals.service';
import { CustomersService } from 'app/services/customers.service';
import Swal from 'sweetalert2';

interface EventoConCliente extends AgendaCliente {
  nombreCliente?: string;
}

@Component({
  selector: 'app-agenda-dia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid p-3">

      <!-- ── Cabecera ─────────────────────────────────────────────────────── -->
      <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <div>
          <h5 class="mb-0 fw-bold text-success">
            <i class="bi bi-calendar-week me-2"></i>Agenda de Clientes
          </h5>
          <div class="text-muted small">Próximos 7 días</div>
        </div>

        <!-- Filtro por tipo -->
        <div class="d-flex gap-1 flex-wrap ms-auto">
          <button class="btn btn-sm"
                  [class.btn-outline-secondary]="filtroTipo !== ''"
                  [class.btn-secondary]="filtroTipo === ''"
                  (click)="filtroTipo = ''">
            Todos
          </button>
          <button *ngFor="let t of TIPOS_AGENDA"
                  class="btn btn-sm"
                  [class]="filtroTipo === t.value ? 'btn-' + t.color : 'btn-outline-' + t.color"
                  (click)="filtroTipo = filtroTipo === t.value ? '' : t.value">
            {{ t.icon }} {{ t.label }}
          </button>
        </div>

        <!-- Config Telegram -->
        <button class="btn btn-sm btn-outline-info" (click)="openConfigTelegram()"
                title="Configurar notificaciones Telegram">
          <i class="bi bi-telegram me-1"></i> Telegram
        </button>
      </div>

      <!-- ── Loading ──────────────────────────────────────────────────────── -->
      <div *ngIf="cargando()" class="text-center py-5">
        <div class="spinner-border text-success"></div>
      </div>

      <!-- ── Sin eventos ──────────────────────────────────────────────────── -->
      <div *ngIf="!cargando() && eventosFiltrados.length === 0"
           class="text-center text-muted py-5">
        <i class="bi bi-calendar3 fs-1 d-block mb-3"></i>
        <div class="fw-semibold">Sin eventos esta semana</div>
        <div class="small">Los eventos se crean desde el módulo de Clientes</div>
      </div>

      <!-- ── Grupos por día ──────────────────────────────────────────────── -->
      <div *ngFor="let grupo of gruposPorDia">
        <!-- Encabezado de día -->
        <div class="d-flex align-items-center gap-2 mb-2 mt-3">
          <div class="agenda-day-badge"
               [class.agenda-day-today]="esHoy(grupo.fecha)"
               [class.agenda-day-tomorrow]="esManana(grupo.fecha)">
            <div class="fw-bold">{{ grupo.fecha | date:'d' }}</div>
            <div class="small text-uppercase">{{ grupo.fecha | date:'MMM' : '' : 'es-MX' }}</div>
          </div>
          <div>
            <div class="fw-semibold">{{ nombreDia(grupo.fecha) }}</div>
            <div class="text-muted small">{{ grupo.eventos.length }} evento{{ grupo.eventos.length !== 1 ? 's' : '' }}</div>
          </div>
        </div>

        <!-- Eventos del día -->
        <div class="row g-2 mb-2">
          <div class="col-md-6 col-lg-4" *ngFor="let ev of grupo.eventos">
            <div class="card h-100 shadow-sm border-start border-4"
                 [ngClass]="getBorderClass(ev.tipo)"
                 [class.opacity-50]="ev.completada">
              <div class="card-body py-2 px-3">

                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="badge" [ngClass]="'bg-' + getTipoBadge(ev.tipo)">
                    {{ getTipoIcon(ev.tipo) }} {{ getTipoLabel(ev.tipo) }}
                  </span>
                  <span class="ms-auto text-muted small">
                    <i class="bi bi-clock me-1"></i>{{ formatHora(ev.fechaHora) }}
                  </span>
                  <button class="btn btn-xs p-0 px-1"
                          [class.btn-outline-success]="!ev.completada"
                          [class.btn-success]="ev.completada"
                          (click)="toggleCompletada(ev)"
                          title="{{ ev.completada ? 'Marcar pendiente' : 'Marcar completada' }}">
                    <i class="bi" [class.bi-check2-circle]="ev.completada"
                                  [class.bi-circle]="!ev.completada"></i>
                  </button>
                </div>

                <div class="fw-semibold small"
                     [class.text-decoration-line-through]="ev.completada">
                  {{ ev.titulo }}
                </div>
                <div *ngIf="ev.nombreCliente" class="text-muted small">
                  <i class="bi bi-person me-1"></i>{{ ev.nombreCliente }}
                </div>
                <div *ngIf="ev.descripcion" class="text-muted small mt-1">
                  {{ ev.descripcion }}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .agenda-day-badge {
      width: 48px; height: 48px;
      border-radius: 10px;
      background: #e9ecef;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-size: 0.85rem; line-height: 1.2;
      flex-shrink: 0;
    }
    .agenda-day-today    { background: #198754; color: #fff; }
    .agenda-day-tomorrow { background: #0d6efd; color: #fff; }
    .btn-xs { font-size: 0.7rem; line-height: 1.2; }
    .border-start.border-4 { border-left-width: 4px !important; }
  `],
})
export class AgendaDiaComponent implements OnInit {
  private agendaSvc  = inject(AgendaService);
  private signalsSvc = inject(SignalsService);
  private custSvc    = inject(CustomersService);

  TIPOS_AGENDA = TIPOS_AGENDA;
  cargando     = signal(false);
  eventos:     EventoConCliente[] = [];
  clientes:    any[] = [];
  filtroTipo:  string = '';
  notifConfig: NotificationConfig | null = null;

  get idCompany() { return this.signalsSvc.getRootSelectedBySidebar()(); }

  ngOnInit() { this.cargar(); }

  cargar() {
    if (!this.idCompany) return;
    this.cargando.set(true);

    // Cargar clientes para mostrar nombres
    this.custSvc.getCustomersByCompany(this.idCompany, 'CUSTOMERS').subscribe({
      next: (data: any) => { this.clientes = data?.data ?? data ?? []; },
    });

    this.agendaSvc.getSemana(this.idCompany).subscribe({
      next: (data) => {
        this.eventos = data.map(ev => ({
          ...ev,
          nombreCliente: this.clientes.find(c => c.id === ev.idCliente)
            ?.nameContact ?? `Cliente #${ev.idCliente}`,
        }));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    // Config Telegram
    this.agendaSvc.getNotificationConfig(this.idCompany).subscribe({
      next: (cfg) => { this.notifConfig = cfg; },
      error: () => {},
    });
  }

  get eventosFiltrados(): EventoConCliente[] {
    return this.filtroTipo
      ? this.eventos.filter(e => e.tipo === this.filtroTipo)
      : this.eventos;
  }

  get gruposPorDia(): { fecha: Date; eventos: EventoConCliente[] }[] {
    const map = new Map<string, { fecha: Date; eventos: EventoConCliente[] }>();
    for (const ev of this.eventosFiltrados) {
      const d    = new Date(ev.fechaHora);
      const key  = d.toDateString();
      if (!map.has(key)) map.set(key, { fecha: d, eventos: [] });
      map.get(key)!.eventos.push(ev);
    }
    return Array.from(map.values())
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }

  esHoy(d: Date): boolean {
    const hoy = new Date();
    return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth();
  }

  esManana(d: Date): boolean {
    const man = new Date(); man.setDate(man.getDate() + 1);
    return d.getDate() === man.getDate() && d.getMonth() === man.getMonth();
  }

  nombreDia(d: Date): string {
    if (this.esHoy(d))    return 'Hoy';
    if (this.esManana(d)) return 'Mañana';
    return d.toLocaleDateString('es-MX', { weekday: 'long' })
             .replace(/^\w/, c => c.toUpperCase());
  }

  formatHora(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  getTipoIcon(tipo: string)  { return TIPOS_AGENDA.find(t => t.value === tipo)?.icon  ?? '📅'; }
  getTipoLabel(tipo: string) { return TIPOS_AGENDA.find(t => t.value === tipo)?.label ?? tipo; }
  getTipoBadge(tipo: string) { return TIPOS_AGENDA.find(t => t.value === tipo)?.color ?? 'secondary'; }

  getBorderClass(tipo: string): string {
    const c = TIPOS_AGENDA.find(t => t.value === tipo)?.color ?? 'secondary';
    return `border-${c}`;
  }

  toggleCompletada(ev: EventoConCliente) {
    const updated = { ...ev, completada: !ev.completada };
    this.agendaSvc.update(ev.id!, updated).subscribe({
      next: (res) => {
        const idx = this.eventos.findIndex(e => e.id === ev.id);
        if (idx !== -1) this.eventos[idx] = { ...res, nombreCliente: ev.nombreCliente };
        this.eventos = [...this.eventos];
      },
    });
  }

  async openConfigTelegram() {
    const { value: chatId } = await Swal.fire({
      title: 'Configurar notificaciones Telegram',
      html: `
        <div class="text-start">
          <p class="small text-muted mb-2">
            Ingresa tu <strong>Chat ID de Telegram</strong> para recibir alertas 1 hora antes de cada evento.
          </p>
          <p class="small text-muted mb-3">
            Para obtener tu Chat ID, envía un mensaje a <strong>@userinfobot</strong> en Telegram.
          </p>
          <label class="form-label small fw-semibold">Chat ID</label>
          <input id="swal-chatid" class="swal2-input"
                 value="${this.notifConfig?.telegramChatId ?? ''}"
                 placeholder="Ej. -100123456789">
          <div class="form-check mt-2">
            <input type="checkbox" class="form-check-input" id="swal-enabled"
                   ${this.notifConfig?.notificationsEnabled !== false ? 'checked' : ''}>
            <label class="form-check-label small" for="swal-enabled">
              Notificaciones activadas
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText:  'Cancelar',
      preConfirm: () => {
        const chatIdInput  = (document.getElementById('swal-chatid') as HTMLInputElement).value.trim();
        const enabledInput = (document.getElementById('swal-enabled') as HTMLInputElement).checked;
        return { chatId: chatIdInput, enabled: enabledInput };
      },
    });

    if (!chatId) return;

    const config: NotificationConfig = {
      idCompany:             this.idCompany,
      telegramChatId:        chatId.chatId,
      notificationsEnabled:  chatId.enabled,
    };

    this.agendaSvc.saveNotificationConfig(config).subscribe({
      next: () => {
        this.notifConfig = config;
        Swal.fire({
          icon: 'success', title: 'Configuración guardada',
          text: chatId.chatId ? 'Recibirás alertas 1 hora antes de cada evento.' : 'Sin Chat ID — notificaciones desactivadas.',
          timer: 2000, showConfirmButton: false,
        });
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la configuración.', 'error'),
    });
  }
}
