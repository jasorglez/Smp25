import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class RestaurantMesasService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // ── Mesas ─────────────────────────────────────────────────────────────────
  getMesas(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlAdministration}/Restaurant/mesas/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  createMesa(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlAdministration}/Restaurant/mesas`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  updateMesa(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlAdministration}/Restaurant/mesas/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  deleteMesa(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlAdministration}/Restaurant/mesas/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // ── Reporte del día ───────────────────────────────────────────────────────
  getReporte(idCompany: number, fecha?: string): Observable<any[]> {
    const params = fecha ? `?fecha=${fecha}` : '';
    return this.http.get<any[]>(
      `${environment.urlAdministration}/Restaurant/reporte/${idCompany}${params}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // ── Impresoras de Cocina ───────────────────────────────────────────────────
  getImpresoras(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlAdministration}/Restaurant/impresoras/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  createImpresora(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlAdministration}/Restaurant/impresoras`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  updateImpresora(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlAdministration}/Restaurant/impresoras/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  deleteImpresora(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlAdministration}/Restaurant/impresoras/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
