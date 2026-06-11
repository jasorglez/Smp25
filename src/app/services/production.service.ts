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

  // ── Liberación Jarabe (N2-C) ──────────────────────────────────────────────

  getLiberacion(idPreparacion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/preparacion/${idPreparacion}/liberacion`, { headers: this.trackingService.getHeaders() });
  }

  createLiberacion(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/preparacion/liberacion`, data, { headers: this.trackingService.getHeaders() });
  }

  updateLiberacion(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/preparacion/liberacion/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteLiberacion(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/preparacion/liberacion/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Limpieza (N2-D) ───────────────────────────────────────────────────────

  getLimpieza(idPreparacion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/preparacion/${idPreparacion}/limpieza`, { headers: this.trackingService.getHeaders() });
  }

  createLimpieza(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/preparacion/limpieza`, data, { headers: this.trackingService.getHeaders() });
  }

  updateLimpieza(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/preparacion/limpieza/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteLimpieza(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/preparacion/limpieza/${id}`, { headers: this.trackingService.getHeaders() });
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

  // ── Molienda Mat Detalle ───────────────────────────────────────────────────

  getMoliendaMatDetalleByMolienda(idMolienda: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaMatDetalle/molienda/${idMolienda}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaMatDetalleCountsByCompany(idCompany: number): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${environment.urlProduction}/MoliendaMatDetalle/counts/company/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  createMoliendaMatDetalle(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaMatDetalle`, data, { headers: this.trackingService.getHeaders() });
  }

  updateMoliendaMatDetalle(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaMatDetalle/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  patchMoliendaMatDetalleLocked(id: number, locked: boolean): Observable<any> {
    return this.http.patch<any>(`${environment.urlProduction}/MoliendaMatDetalle/${id}/locked`, locked, { headers: this.trackingService.getHeaders() });
  }

  patchMoliendaMatDetalleBote(id: number, bote: number | null): Observable<any> {
    return this.http.patch<any>(`${environment.urlProduction}/MoliendaMatDetalle/${id}/bote`, bote, { headers: this.trackingService.getHeaders() });
  }

  deleteMoliendaMatDetalle(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaMatDetalle/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaMatArticuloSumsByMolienda(idMolienda: number): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${environment.urlProduction}/MoliendaMatArticulo/sums/molienda/${idMolienda}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaMatArticuloCountsByMolienda(idMolienda: number): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${environment.urlProduction}/MoliendaMatArticulo/counts/molienda/${idMolienda}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaMatArticuloByDetalle(idMatDetalle: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaMatArticulo/matdetalle/${idMatDetalle}`, { headers: this.trackingService.getHeaders() });
  }

  createMoliendaMatArticulo(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaMatArticulo`, data, { headers: this.trackingService.getHeaders() });
  }

  updateMoliendaMatArticulo(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaMatArticulo/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteMoliendaMatArticulo(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaMatArticulo/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Molienda Bote (asignación múltiple de botes) ──────────────────────────

  getMoliendaBoteByMatDetalle(idMatDetalle: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaBote/matdetalle/${idMatDetalle}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaBoteUsage(): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${environment.urlProduction}/MoliendaBote/usage`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaBoteSumsByMolienda(idMolienda: number): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${environment.urlProduction}/MoliendaBote/sums/molienda/${idMolienda}`, { headers: this.trackingService.getHeaders() });
  }

  createMoliendaBote(data: { idMatDetalle: number; idBoteCatalog: number | null; cantidad: number | null }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaBote`, data, { headers: this.trackingService.getHeaders() });
  }

  patchMoliendaBoteCantidad(id: number, cantidad: number | null): Observable<any> {
    return this.http.patch<any>(`${environment.urlProduction}/MoliendaBote/${id}/cantidad`, { cantidad }, { headers: this.trackingService.getHeaders() });
  }

  deleteMoliendaBote(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaBote/${id}`, { headers: this.trackingService.getHeaders() });
  }

  createMoliendaBoteHistorial(data: { idMoliendaBote: number; cantidad: number; usuario?: string; comentario?: string }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaBote/historial`, data, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaBoteHistorialByBote(idMoliendaBote: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaBote/historial/bote/${idMoliendaBote}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaBoteHistorialByMatDetalle(idMatDetalle: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaBote/historial/matdetalle/${idMatDetalle}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Prefijos Fase ──
  getMoliendaPrefijos(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaPrefijo?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaPrefijo(data: { idCompany: number; nombreFase: string; prefijo: string; active: boolean }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaPrefijo`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaPrefijo(id: number, data: { nombreFase: string; prefijo: string; active: boolean }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaPrefijo/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaPrefijo(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaPrefijo/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Molienda Params (Folio / Parámetros / Objetivo / Lib. Limpieza) ────────
  getMoliendaParamsByMolienda(idMolienda: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaParams/molienda/${idMolienda}`, { headers: this.trackingService.getHeaders() });
  }
  getMoliendaParamsByMoliendaAndBote(idMolienda: number, idBoteCatalog: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaParams/molienda/${idMolienda}/bote/${idBoteCatalog}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaParams(data: { idMolienda: number; idBoteCatalog?: number; folio?: string; parametros?: string; objetivo?: number; libLimpieza: boolean }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaParams`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaParams(id: number, data: { folio?: string; parametros?: string; objetivo?: number; libLimpieza: boolean }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaParams/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaParams(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaParams/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getMoliendaParamsBoteCounts(ids: number[]): Observable<Record<number, number>> {
    return this.http.post<Record<number, number>>(`${environment.urlProduction}/MoliendaParams/bote-counts`, ids, { headers: this.trackingService.getHeaders() });
  }

  // ── Catálogo de parámetros de molienda ────────────────────────────────────
  getMoliendaParamCatalog(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaParamCatalog`, { headers: this.trackingService.getHeaders() });
  }
  getMoliendaParamCatalogByArticulo(idArticulo: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaParamCatalog/articulo/${idArticulo}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaParamCatalog(data: { nombre: string; valorMin?: number; valorMax?: number; idArticulo?: number }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaParamCatalog`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaParamCatalog(id: number, data: { nombre: string; valorMin?: number; valorMax?: number; idArticulo?: number }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaParamCatalog/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaParamCatalog(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaParamCatalog/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Configuración parámetro × materia prima (activo + mín/máx) ───────────
  getMoliendaParamConfigByParam(idParam: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaParamConfig/param/${idParam}`, { headers: this.trackingService.getHeaders() });
  }
  upsertMoliendaParamConfig(data: { idParam: number; idArticulo: number; valorMin?: number; valorMax?: number; active: boolean }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaParamConfig`, data, { headers: this.trackingService.getHeaders() });
  }

  // ── Mediciones por bote (parámetros medidos) ──────────────────────────────
  getMoliendaMedicionesByParams(idMoliendaParams: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaMedicion/params/${idMoliendaParams}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaMedicion(dto: { idMoliendaParams: number; fecha: string; hora: string; faseFe?: string; idMateriaPrima?: number; valores: { idParamCatalog: number; valor?: number }[] }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaMedicion`, dto, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaMedicion(id: number, dto: { idMoliendaParams: number; fecha: string; hora: string; faseFe?: string; idMateriaPrima?: number; valores: { idParamCatalog: number; valor?: number }[] }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaMedicion/${id}`, dto, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaMedicion(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaMedicion/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getMedicionMatPrimas(idMedicion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaMedicionMatPrima/medicion/${idMedicion}`, { headers: this.trackingService.getHeaders() });
  }
  createMedicionMatPrima(dto: { idMedicion: number; idMatPrima: number; cantidad?: number }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaMedicionMatPrima`, dto, { headers: this.trackingService.getHeaders() });
  }
  updateMedicionMatPrima(id: number, dto: { idMatPrima: number; cantidad?: number }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaMedicionMatPrima/${id}`, dto, { headers: this.trackingService.getHeaders() });
  }
  deleteMedicionMatPrima(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaMedicionMatPrima/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
