import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class PreparacionService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Preparacion (nivel 1)
  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/preparacion`, { headers: this.trackingService.getHeaders() });
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/preparacion`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/preparacion/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/preparacion/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Detalles - ingredientes (nivel 2a)
  getDetalles(idPreparacion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/preparacion/${idPreparacion}/detalles`, { headers: this.trackingService.getHeaders() });
  }

  createDetalle(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/preparacion/detalles`, data, { headers: this.trackingService.getHeaders() });
  }

  updateDetalle(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/preparacion/detalles/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteDetalle(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/preparacion/detalles/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Params - parámetros por ingrediente (nivel 3)
  getParams(idDetalle: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/preparacion/detalles/${idDetalle}/params`, { headers: this.trackingService.getHeaders() });
  }

  createParams(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/preparacion/params`, data, { headers: this.trackingService.getHeaders() });
  }

  updateParams(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/preparacion/params/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteParams(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/preparacion/params/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Historial - gastos (nivel 2b)
  getHistorial(idPreparacion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/preparacion/${idPreparacion}/historial`, { headers: this.trackingService.getHeaders() });
  }

  createHistorial(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/preparacion/historial`, data, { headers: this.trackingService.getHeaders() });
  }

  updateHistorial(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/preparacion/historial/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteHistorial(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/preparacion/historial/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
