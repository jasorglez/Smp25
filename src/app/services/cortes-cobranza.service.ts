import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class CortesCobranzaService {
  private http = inject(HttpClient);
  private tracking = inject(TrackingService);
  private base = `${environment.urlAdministration}/CortesCobranza`;

  getResumen(rootId: number, desde: string, hasta: string, usuarioId: number | null) {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (usuarioId) params = params.set('idUsuarioCobrador', usuarioId);
    return this.http.get<any>(`${this.base}/resumen/${rootId}`, { params, headers: this.tracking.getHeaders() });
  }
  getHistorial(rootId: number) {
    return this.http.get<any[]>(`${this.base}/historial/${rootId}`, { headers: this.tracking.getHeaders() });
  }
  create(data: any) {
    return this.http.post<any>(this.base, data, { headers: this.tracking.getHeaders() });
  }

  getTurnos(rootId: number) {
    return this.http.get<any[]>(`${environment.urlAdministration}/CajeroTurno/byCompany?idCompany=${rootId}`, { headers: this.tracking.getHeaders() });
  }
  abrirTurno(data: any) {
    return this.http.post<any>(`${environment.urlAdministration}/CajeroTurno`, data, { headers: this.tracking.getHeaders() });
  }
  cerrarTurno(id: number, efectivoContado: number, notas?: string) {
    return this.http.put<any>(`${environment.urlAdministration}/CajeroTurno/${id}/cerrar`, { efectivoContado, notas }, { headers: this.tracking.getHeaders() });
  }
}
