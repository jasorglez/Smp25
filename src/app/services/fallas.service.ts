import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface FallaIncidencia {
  id?: number;
  folio?: string;
  idCompany: number;
  canal?: string;
  tipoFalla?: string;
  descripcionCiudadano?: string;
  descripcionIa?: string;
  severidadIa?: string;
  departamento?: string;
  latitud?: number;
  longitud?: number;
  fotoUrl?: string;
  status?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  whatsappPhone?: string;
  whatsappName?: string;
  ciudadanoNombre?: string;
  idResponsable?: number;
  notasMunicipio?: string;
  active?: boolean;
  fechaReporte?: string;
  fechaActualizacion?: string;
}

export interface FallaHistorial {
  id?: number;
  idFalla: number;
  statusAnterior?: string;
  statusNuevo: string;
  notas?: string;
  idUsuario?: number;
  notificadoTelegram?: boolean;
  notificadoWhatsapp?: boolean;
  fecha?: string;
}

export interface UpdateStatusDto {
  status: string;
  notas?: string;
  idUsuario?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FallasService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get base() {
    return `${environment.urlAdministration}/Fallas`;
  }

  getByCompany(idCompany: number, soloActivas = true): Observable<FallaIncidencia[]> {
    return this.http.get<FallaIncidencia[]>(
      `${this.base}/company/${idCompany}?soloActivas=${soloActivas}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<FallaIncidencia> {
    return this.http.get<FallaIncidencia>(`${this.base}/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getHistorial(idFalla: number): Observable<FallaHistorial[]> {
    return this.http.get<FallaHistorial[]>(`${this.base}/${idFalla}/historial`, { headers: this.trackingService.getHeaders() });
  }

  create(falla: FallaIncidencia): Observable<FallaIncidencia> {
    return this.http.post<FallaIncidencia>(this.base, falla, { headers: this.trackingService.getHeaders() });
  }

  updateStatus(id: number, dto: UpdateStatusDto): Observable<FallaIncidencia> {
    return this.http.patch<FallaIncidencia>(`${this.base}/${id}/status`, dto, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, falla: FallaIncidencia): Observable<FallaIncidencia> {
    return this.http.put<FallaIncidencia>(`${this.base}/${id}`, falla, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
