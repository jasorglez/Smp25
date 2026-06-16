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
  // v2.51 — backend renombró PreparacionController → PreparationController (rutas en inglés).
  // Ver Production.Controllers.Delison.PreparationController / PreparationDetalleController /
  // PreparationDetalleParamsController / PreparationLimpiezaController.

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/Preparation`, { headers: this.trackingService.getHeaders() });
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/Preparation`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/Preparation/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/Preparation/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // TODO: backend ya no expone /detalles/frequent (controller eliminado en el refactor a
  // Preparation). Sin reemplazo todavía — este endpoint sigue dando 404 hasta que se agregue.
  getFrequentIngredientes(): Observable<{ ingredientes: any[]; totalPreparaciones: number }> {
    return this.http.get<any>(`${environment.urlProduction}/preparacion/detalles/frequent`, { headers: this.trackingService.getHeaders() });
  }

  // ── Detalles - ingredientes (nivel 2a) ────────────────────────────────────

  getDetalles(idPreparacion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/PreparationDetalle/preparacion/${idPreparacion}`, { headers: this.trackingService.getHeaders() });
  }

  createDetalle(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/PreparationDetalle`, data, { headers: this.trackingService.getHeaders() });
  }

  updateDetalle(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/PreparationDetalle/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteDetalle(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/PreparationDetalle/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Params - parámetros por ingrediente (nivel 3) ─────────────────────────

  getParams(idDetalle: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/PreparationDetalleParams/detalle/${idDetalle}`, { headers: this.trackingService.getHeaders() });
  }

  createParams(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/PreparationDetalleParams`, data, { headers: this.trackingService.getHeaders() });
  }

  updateParams(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/PreparationDetalleParams/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteParams(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/PreparationDetalleParams/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Historial - gastos (nivel 2b) ─────────────────────────────────────────
  // TODO: backend eliminó HistorialGasto/PreparacionService en el refactor a Preparation y no
  // hay controller de reemplazo. Estas 4 rutas siguen dando 404 hasta que se agregue uno.

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
  // TODO: el modelo PreparacionLiberacion sigue existiendo pero no tiene controller en el
  // refactor a Preparation. Estas 4 rutas siguen dando 404 hasta que se agregue uno.

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
    return this.http.get<any[]>(`${environment.urlProduction}/PreparationLimpieza/preparacion/${idPreparacion}`, { headers: this.trackingService.getHeaders() });
  }

  createLimpieza(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/PreparationLimpieza`, data, { headers: this.trackingService.getHeaders() });
  }

  updateLimpieza(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/PreparationLimpieza/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteLimpieza(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/PreparationLimpieza/${id}`, { headers: this.trackingService.getHeaders() });
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

  // ── Molienda Lib. Limpieza ────────────────────────────────────────────────
  getMoliendaLibLimpiezaByParams(idParams: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaLibLimpieza/params/${idParams}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaLibLimpieza(data: { idParams: number; fecha?: string; empleadosIds?: string; idUsuario?: number; actividadesIds?: string }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaLibLimpieza`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaLibLimpieza(id: number, data: { fecha?: string; empleadosIds?: string; idUsuario?: number; actividadesIds?: string }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaLibLimpieza/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaLibLimpieza(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaLibLimpieza/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Catálogo de Actividades ────────────────────────────────────────────────
  getMoliendaActividadesByCatalog(idCatalog: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaActividad/catalog/${idCatalog}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaActividad(data: { idCatalog: number; actividad?: string; periodicidad?: string }): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaActividad`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaActividad(id: number, data: { actividad?: string; periodicidad?: string; active?: boolean }): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaActividad/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaActividad(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaActividad/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // ── Catálogo Bloques Extracción y Fermentación ────────────────────────────
  getMoliendaBloqueEFByCatalog(idCatalog: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaBloqueEF/catalog/${idCatalog}`, { headers: this.trackingService.getHeaders() });
  }
  getProductosTerminadosEF(idCompany: number): Observable<{ id: number; producto: string; categoria: string }[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/productos-ef?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
  createMoliendaBloqueEF(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/MoliendaBloqueEF`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMoliendaBloqueEF(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/MoliendaBloqueEF/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMoliendaBloqueEF(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/MoliendaBloqueEF/${id}`, { headers: this.trackingService.getHeaders() });
  }
  getMoliendaBloqueEFByCompany(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/MoliendaBloqueEF/company/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  // ── OH y Bloque ────────────────────────────────────────────────────────────
  getOhBloqueByCompany(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/OhBloque/company/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
  createOhBloque(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/OhBloque`, data, { headers: this.trackingService.getHeaders() });
  }
  updateOhBloque(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/OhBloque/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteOhBloque(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.urlProduction}/OhBloque/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getOhBloqueProductosByOhBloque(idOhBloque: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/OhBloqueProducto/by-oh-bloque/${idOhBloque}`, { headers: this.trackingService.getHeaders() });
  }

  saveOhBloqueProductosBatch(idOhBloque: number, items: any[]): Observable<void> {
    return this.http.post<void>(`${environment.urlProduction}/OhBloqueProducto/batch/${idOhBloque}`, items, { headers: this.trackingService.getHeaders() });
  }

  updateOhBloqueProductoCantidadProducida(id: number, cantidadProducida: number): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/OhBloqueProducto/cantidad-producida/${id}`, cantidadProducida, { headers: this.trackingService.getHeaders() });
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

  // ── CatalogJerarquico (Preparacion 1 — Lista Tablas / Grupos / Catálogos) ─
  getCatalogJerarquicoByType(type: string, idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/CatalogJerarquico/bytype?type=${type}&idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getCatalogJerarquicoByMaster(idCompany: number, idCatalog: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlProduction}/CatalogJerarquico?idCompany=${idCompany}&idCatalog=${idCatalog}`, { headers: this.trackingService.getHeaders() });
  }

  createCatalogJerarquico(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlProduction}/CatalogJerarquico`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCatalogJerarquico(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlProduction}/CatalogJerarquico/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteCatalogJerarquico(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlProduction}/CatalogJerarquico/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
