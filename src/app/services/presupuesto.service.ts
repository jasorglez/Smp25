import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  IPresupuesto,
  IPresupuestoForm,
  IPresupuestoLinea,
  IPresupuestoLineaForm,
  IPresupuestoMes,
  IPreregistroGasto,
  IPresupuestoMigracion,
  IMigracionForm,
  IPresupuestoIncremento,
  IReporteDesempeno,
} from 'app/interface/ipresupuesto';

@Injectable({ providedIn: 'root' })
export class PresupuestoService {
  private http = inject(HttpClient);
  private api = `${environment.urlAdministration}/Presupuesto`;

  // ── PRESUPUESTO (header) ──────────────────────────────────

  getAll(idCompany: number, idProject: number): Observable<IPresupuesto[]> {
    return this.http.get<IPresupuesto[]>(`${this.api}/getAll/${idCompany}/${idProject}`);
  }

  getVigente(idCompany: number, idProject: number): Observable<IPresupuesto> {
    return this.http.get<IPresupuesto>(`${this.api}/getVigente/${idCompany}/${idProject}`);
  }

  getById(id: number): Observable<IPresupuesto> {
    return this.http.get<IPresupuesto>(`${this.api}/getById/${id}`);
  }

  create(data: IPresupuestoForm): Observable<IPresupuesto> {
    return this.http.post<IPresupuesto>(this.api, data);
  }

  update(id: number, data: IPresupuestoForm): Observable<any> {
    return this.http.put(`${this.api}/update/${id}`, data);
  }

  setVigente(id: number, idCompany: number, idProject: number): Observable<any> {
    return this.http.put(`${this.api}/setVigente/${id}`, { idCompany, idProject });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/delete/${id}`);
  }

  // ── LÍNEAS ───────────────────────────────────────────────

  getLineas(idPresupuesto: number): Observable<IPresupuestoLinea[]> {
    return this.http.get<IPresupuestoLinea[]>(`${this.api}/lineas/${idPresupuesto}`);
  }

  createLinea(data: IPresupuestoLineaForm): Observable<IPresupuestoLinea> {
    return this.http.post<IPresupuestoLinea>(`${this.api}/lineas`, data);
  }

  updateLinea(id: number, data: IPresupuestoLineaForm): Observable<any> {
    return this.http.put(`${this.api}/lineas/update/${id}`, data);
  }

  deleteLinea(id: number): Observable<any> {
    return this.http.delete(`${this.api}/lineas/delete/${id}`);
  }

  // ── DISTRIBUCIÓN MENSUAL ──────────────────────────────────

  getMeses(idLinea: number): Observable<IPresupuestoMes[]> {
    return this.http.get<IPresupuestoMes[]>(`${this.api}/meses/${idLinea}`);
  }

  saveMeses(idLinea: number, meses: IPresupuestoMes[]): Observable<any> {
    return this.http.post(`${this.api}/meses/${idLinea}`, meses);
  }

  // ── PREREGISTRO DE GASTO ─────────────────────────────────

  getPreregistros(idCompany: number, idProject: number): Observable<IPreregistroGasto[]> {
    return this.http.get<IPreregistroGasto[]>(`${this.api}/preregistro/${idCompany}/${idProject}`);
  }

  createPreregistro(data: Partial<IPreregistroGasto>): Observable<IPreregistroGasto> {
    return this.http.post<IPreregistroGasto>(`${this.api}/preregistro`, data);
  }

  updatePreregistro(id: number, data: Partial<IPreregistroGasto>): Observable<any> {
    return this.http.put(`${this.api}/preregistro/update/${id}`, data);
  }

  deletePreregistro(id: number): Observable<any> {
    return this.http.delete(`${this.api}/preregistro/delete/${id}`);
  }

  // ── MIGRACIONES ───────────────────────────────────────────

  getMigraciones(idPresupuesto: number): Observable<IPresupuestoMigracion[]> {
    return this.http.get<IPresupuestoMigracion[]>(`${this.api}/migraciones/${idPresupuesto}`);
  }

  ejecutarMigracion(data: IMigracionForm): Observable<IPresupuesto> {
    return this.http.post<IPresupuesto>(`${this.api}/migraciones`, data);
  }

  // ── INCREMENTOS ───────────────────────────────────────────

  getIncrementos(idPresupuesto: number): Observable<IPresupuestoIncremento[]> {
    return this.http.get<IPresupuestoIncremento[]>(`${this.api}/incrementos/${idPresupuesto}`);
  }

  solicitarIncremento(data: Partial<IPresupuestoIncremento>): Observable<IPresupuestoIncremento> {
    return this.http.post<IPresupuestoIncremento>(`${this.api}/incrementos`, data);
  }

  autorizarIncremento(id: number, usuario: string): Observable<IPresupuesto> {
    return this.http.put<IPresupuesto>(`${this.api}/incrementos/autorizar/${id}`, { usuario });
  }

  rechazarIncremento(id: number, usuario: string): Observable<any> {
    return this.http.put(`${this.api}/incrementos/rechazar/${id}`, { usuario });
  }

  // ── REPORTE DE DESEMPEÑO ──────────────────────────────────

  getReporteDesempeno(idCompany: number, idProject: number): Observable<IReporteDesempeno[]> {
    return this.http.get<IReporteDesempeno[]>(
      `${this.api}/reporte/${idCompany}/${idProject}`
    );
  }

  // ── VALIDACIÓN DE SALDO (para compras y preregistro) ─────

  getSaldoDisponible(idCompany: number, idProject: number, idCuenta: number): Observable<{ saldo: number }> {
    return this.http.get<{ saldo: number }>(
      `${this.api}/saldo/${idCompany}/${idProject}/${idCuenta}`
    );
  }
}
