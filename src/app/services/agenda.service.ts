import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface AgendaCliente {
  id?:                   number;
  idCliente:             number;
  idCompany:             number;
  tipo:                  string;
  titulo:                string;
  descripcion?:          string;
  fechaHora:             string;
  notificacionEnviada?:  boolean;
  completada?:           boolean;
  idVendedor?:           number;
  nombreVendedor?:       string;
  createdAt?:            string;
  googleEventId?:        string;   // ID del evento en Google Calendar
}

export interface NotificationConfig {
  idCompany:             number;
  telegramChatId?:       string;
  notificationsEnabled?: boolean;
  // Google Calendar
  googleRefreshToken?:   string;
  googleEmail?:          string;
  googleConnected?:      boolean;
}

export const TIPOS_AGENDA = [
  { value: 'visita',      label: 'Visita',      icon: '🚗', color: 'primary'   },
  { value: 'llamada',     label: 'Llamada',     icon: '📞', color: 'success'   },
  { value: 'demo',        label: 'Demo',        icon: '💻', color: 'info'      },
  { value: 'cobro',       label: 'Cobro',       icon: '💰', color: 'warning'   },
  { value: 'seguimiento', label: 'Seguimiento', icon: '📋', color: 'secondary' },
];

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private http     = inject(HttpClient);
  private tracking = inject(TrackingService);
  private base     = `${environment.urlAdministration}/AgendaClientes`;
  private oauthBase = `${environment.urlAdministration}/GoogleOAuth`;

  getByCliente(idCliente: number, idCompany: number): Observable<AgendaCliente[]> {
    return this.http.get<AgendaCliente[]>(
      `${this.base}/cliente/${idCliente}/${idCompany}`,
      { headers: this.tracking.getHeaders() }
    );
  }

  getSemana(idCompany: number): Observable<AgendaCliente[]> {
    return this.http.get<AgendaCliente[]>(
      `${this.base}/semana/${idCompany}`,
      { headers: this.tracking.getHeaders() }
    );
  }

  create(item: Partial<AgendaCliente>): Observable<AgendaCliente> {
    return this.http.post<AgendaCliente>(this.base, item, { headers: this.tracking.getHeaders() });
  }

  update(id: number, item: Partial<AgendaCliente>): Observable<AgendaCliente> {
    return this.http.put<AgendaCliente>(`${this.base}/${id}`, item, { headers: this.tracking.getHeaders() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { headers: this.tracking.getHeaders() });
  }

  getNotificationConfig(idCompany: number): Observable<NotificationConfig | null> {
    return this.http.get<NotificationConfig | null>(
      `${this.base}/notification-config/${idCompany}`,
      { headers: this.tracking.getHeaders() }
    );
  }

  saveNotificationConfig(config: NotificationConfig): Observable<void> {
    return this.http.post<void>(
      `${this.base}/notification-config`,
      config,
      { headers: this.tracking.getHeaders() }
    );
  }

  // ── Google Calendar OAuth2 ─────────────────────────────────────────────

  /** Obtiene la URL de autorización de Google y la abre en nueva pestaña */
  connectGoogle(idCompany: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.oauthBase}/auth-url?idCompany=${idCompany}`,
      { headers: this.tracking.getHeaders() }
    );
  }

  /** Desconectar Google Calendar */
  disconnectGoogle(idCompany: number): Observable<void> {
    return this.http.post<void>(
      `${this.oauthBase}/disconnect?idCompany=${idCompany}`,
      {},
      { headers: this.tracking.getHeaders() }
    );
  }
}
