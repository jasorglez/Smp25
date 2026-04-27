import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface MoliendaProduccion {
  id?: number;
  idCompany?: number | null;
  idSucursal?: number | null;
  idMatPrima?: number | null;
  fecha?: string | null;
  nombre?: string | null;
  cantidad?: number | null;
  cuantoQueda?: number | null;
  jugo?: number | null;
  liberCompra?: boolean | null;
  columna1?: string | null;
  active?: boolean;
}

export interface MaterialJarabeConfig {
  id?: number;
  idMaterial: number;
  usarEnJarabe: boolean;
  prefijoNota?: string | null;
  consecutivoNota?: number | null;
  prefijoLote?: string | null;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // ── Preparacion (nivel 1) ──────────────────────────────────────────────────

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

  getFrequentIngredientes(): Observable<{ ingredientes: any[]; totalPreparaciones: number }> {
    return this.http.get<any>(`${environment.urlProduction}/preparacion/detalles/frequent`, { headers: this.trackingService.getHeaders() });
  }

  // ── Detalles - ingredientes (nivel 2a) ────────────────────────────────────

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

  // ── Params - parámetros por ingrediente (nivel 3) ─────────────────────────

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

  // ── Historial - gastos (nivel 2b) ─────────────────────────────────────────

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

  // ── Material Jarabe ────────────────────────────────────────────────────────

  getMaterialJarabeAll(): Observable<MaterialJarabeConfig[]> {
    return this.http.get<MaterialJarabeConfig[]>(`${environment.urlProduction}/materialjarabe`, { headers: this.trackingService.getHeaders() });
  }

  getMaterialJarabeByMaterial(idMaterial: number): Observable<MaterialJarabeConfig> {
    return this.http.get<MaterialJarabeConfig>(`${environment.urlProduction}/materialjarabe/${idMaterial}`, { headers: this.trackingService.getHeaders() });
  }

  saveMaterialJarabe(idMaterial: number, data: MaterialJarabeConfig): Observable<MaterialJarabeConfig> {
    return this.http.put<MaterialJarabeConfig>(`${environment.urlProduction}/materialjarabe/${idMaterial}`, data, { headers: this.trackingService.getHeaders() });
  }

  // ── Molienda Producción ───────────────────────────────────────────────────

  getMoliendaByCompany(idCompany: number): Observable<MoliendaProduccion[]> {
    return this.http.get<MoliendaProduccion[]>(`${environment.urlProduction}/Molienda/company/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaByCompanyAndSucursal(idCompany: number, idSucursal: number): Observable<MoliendaProduccion[]> {
    return this.http.get<MoliendaProduccion[]>(`${environment.urlProduction}/Molienda/company/${idCompany}/sucursal/${idSucursal}`, { headers: this.trackingService.getHeaders() });
  }

  createMolienda(data: MoliendaProduccion): Observable<MoliendaProduccion> {
    return this.http.post<MoliendaProduccion>(`${environment.urlProduction}/Molienda`, data, { headers: this.trackingService.getHeaders() });
  }

  updateMolienda(id: number, data: MoliendaProduccion): Observable<MoliendaProduccion> {
    return this.http.put<MoliendaProduccion>(`${environment.urlProduction}/Molienda/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteMolienda(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/Molienda/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Molienda Detalles (Entradas/Salidas) ──────────────────────────

  getMoliendaDetalles(idMolienda: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/Molienda/${idMolienda}/detalles`, { headers: this.trackingService.getHeaders() });
  }

  createMoliendaDetalle(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/Molienda/detalle`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteMoliendaDetalle(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/Molienda/detalle/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
