import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { from } from 'rxjs';
import { CobranzaOfflineService } from './cobranza-offline.service';
import { CobranzaOfflineStoreService } from './cobranza-offline-store.service';

@Injectable({ providedIn: 'root' })
export class CortesCobranzaService {
  private http = inject(HttpClient);
  private tracking = inject(TrackingService);
  private offline = inject(CobranzaOfflineService);
  private offlineStore = inject(CobranzaOfflineStoreService);
  private base = `${environment.urlAdministration}/CortesCobranza`;

  getResumen(rootId: number, desde: string, hasta: string, usuarioId: number | null) {
    if (this.offline.isOffline) return from(this.getLocalSummary(rootId, desde, hasta, usuarioId));
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (usuarioId) params = params.set('idUsuarioCobrador', usuarioId);
    return this.http.get<any>(`${this.base}/resumen/${rootId}`, { params, headers: this.tracking.getHeaders() });
  }
  getGanancias(rootId: number, desde: string, hasta: string, usuarioId: number | null) {
    if (this.offline.isOffline) return from(this.getLocalSummary(rootId, desde, hasta, usuarioId));
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (usuarioId) params = params.set('idUsuarioCobrador', usuarioId);
    return this.http.get<any>(`${this.base}/ganancias/${rootId}`, { params, headers: this.tracking.getHeaders() });
  }
  getHistorial(rootId: number) {
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-history', rootId), 'historial de cortes', rootId,
      this.http.get<any[]>(`${this.base}/historial/${rootId}`, { headers: this.tracking.getHeaders() }));
  }
  create(data: any) {
    if (this.offline.isOffline) return from(this.createLocalCut(data));
    return this.http.post<any>(this.base, data, { headers: this.tracking.getHeaders() });
  }

  getTurnos(rootId: number, dateFrom?: string, dateTo?: string) {
    let params = `idCompany=${rootId}`;
    if (dateFrom) params += `&dateFrom=${encodeURIComponent(dateFrom)}`;
    if (dateTo) params += `&dateTo=${encodeURIComponent(dateTo)}`;
    const request = this.http.get<any[]>(`${environment.urlAdministration}/CajeroTurno/byCompany?${params}`, { headers: this.tracking.getHeaders() });
    if (dateFrom || dateTo) {
      if (this.offline.isOffline) return this.offline.cachedRequest(this.offline.snapshotKey('cash-turns', rootId), 'turnos de caja', rootId, request);
      return request;
    }
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-turns', rootId), 'turnos de caja', rootId, request);
  }
  getSaldosFondoAhorro(rootId: number) {
    return this.offline.cachedRequest(this.offline.snapshotKey('savings-balances', rootId), 'saldos de ahorro', rootId,
      this.http.get<any[]>(`${this.base}/fondos-ahorro/${rootId}`, { headers: this.tracking.getHeaders() }));
  }
  abrirTurno(data: any) {
    if (this.offline.isOffline) return from(this.openLocalTurn(data));
    return this.http.post<any>(`${environment.urlAdministration}/CajeroTurno`, data, { headers: this.tracking.getHeaders() });
  }
  cerrarTurno(id: number, efectivoContado: number, notas?: string) {
    if (this.offline.isOffline) return from(this.closeLocalTurn(id, efectivoContado, notas));
    return this.http.put<any>(`${environment.urlAdministration}/CajeroTurno/${id}/cerrar`, { efectivoContado, notas }, { headers: this.tracking.getHeaders() });
  }

  private async getLocalSummary(companyId: number, fromDate: string, toDate: string, userId: number | null): Promise<any> {
    const movements = await this.offline.readSnapshot<any[]>(this.offline.snapshotKey('local-cash-movements', companyId)) || [];
    const rows = movements.filter(item => {
      if (item.__offlineOrigin !== true || item.__offlinePending === false) return false;
      const date = String(item.fechaPago || '').slice(0, 10);
      return date >= fromDate && date <= toDate && (!userId || Number(item.idUsuarioCobrador) === Number(userId));
    });
    const types = await this.offline.readSnapshot<any[]>(this.offline.snapshotKey('payment-types', companyId)) || [];
    const typeNames = new Map(types.map(item => [Number(item.id), String(item.description || item.name || `Tipo ${item.id}`)]));
    const customers = (await this.offlineStore.getSnapshots<any>(companyId, 'clientes')).flatMap(snapshot => this.collection(snapshot.value));
    const customersById = new Map(customers.map(item => [Number(item.id), item]));
    const interestAllocations = new Map<number, { capital: number; interest: number }>();
    const customerIds = [...new Set(rows.map(item => Number(item.idCustomer)).filter(Boolean))];
    const loanSnapshots = await Promise.all(customerIds.map(customerId =>
      this.offline.readSnapshot<any>(this.offline.snapshotKey('loans-customer', companyId, customerId))));
    for (const snapshot of loanSnapshots) {
      for (const loan of this.collection(snapshot)) {
        const schedule = this.collection(loan?.cuotas).filter(item => item.active !== false)
          .sort((a, b) => Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0))
          .map(item => ({ due: Number(item.montoProgramado || 0), interest: Number(item.montoInteres || 0) }));
        const history = this.collection(loan?.cuotas).flatMap(item => this.collection(item?.abonos)
          .filter(payment => payment.active !== false)
          .map(payment => ({ id: Number(payment.id), date: String(payment.fechaPago || ''), amount: Number(payment.monto || 0) })));
        let paidBefore = 0;
        const totalDue = schedule.reduce((total, item) => total + item.due, 0);
        for (const payment of history.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
          const paidAfter = Math.min(totalDue, paidBefore + payment.amount);
          let scheduleStart = 0;
          let interest = 0;
          for (const installment of schedule) {
            const scheduleEnd = scheduleStart + installment.due;
            const applied = Math.max(0, Math.min(paidAfter, scheduleEnd) - Math.max(paidBefore, scheduleStart));
            if (applied > 0 && installment.due > 0) interest += applied * installment.interest / installment.due;
            scheduleStart = scheduleEnd;
          }
          interest = Math.round(Math.min(payment.amount, interest) * 100) / 100;
          interestAllocations.set(payment.id, { capital: payment.amount - interest, interest });
          paidBefore += payment.amount;
        }
      }
    }
    const movementsForView = rows.map(item => {
      const allocation = interestAllocations.get(Number(item.id)) || { capital: Number(item.monto || 0), interest: 0 };
      return ({
      ...item,
      cliente: customersById.get(Number(item.idCustomer))?.nameContact || customersById.get(Number(item.idCustomer))?.company || `Cliente #${item.idCustomer}`,
      tipoPago: typeNames.get(Number(item.idTipoPago)) || 'Sin tipo de pago',
      capitalCobrado: allocation.capital,
      interesCobrado: allocation.interest,
      __offlineOrigin: true
    });
    });
    const porTipoPago: Record<string, number> = {};
    for (const item of movementsForView) porTipoPago[item.tipoPago] = (porTipoPago[item.tipoPago] || 0) + Number(item.monto || 0);
    return {
      total: movementsForView.reduce((sum, item) => sum + Number(item.monto || 0), 0),
      capitalCobrado: movementsForView.reduce((sum, item) => sum + Number(item.capitalCobrado || 0), 0),
      interesCobrado: movementsForView.reduce((sum, item) => sum + Number(item.interesCobrado || 0), 0),
      numeroPagos: movementsForView.length, porTipoPago, movimientos: movementsForView, offline: true
    };
  }

  private async openLocalTurn(data: any): Promise<any> {
    const companyId = Number(data.idCompany || localStorage.getItem('company') || 0);
    const turn = { ...data, id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)), fechaInicio: new Date().toISOString(), active: true, fechaCierre: null, offlinePending: true };
    await this.offline.queueOperation({ companyId, type: 'cash.open', localEntityId: turn.id, payload: { turn } });
    const key = this.offline.snapshotKey('cash-turns', companyId);
    const turns = await this.offline.readSnapshot<any[]>(key) || [];
    await this.offline.saveSnapshot(key, companyId, 'caja', [...turns.filter(item => Number(item.id) !== Number(turn.id)), turn]);
    return turn;
  }

  private async closeLocalTurn(id: number, efectivoContado: number, notas?: string): Promise<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    const key = this.offline.snapshotKey('cash-turns', companyId);
    const turns = await this.offline.readSnapshot<any[]>(key) || [];
    const turn = turns.find(item => Number(item.id) === Number(id));
    if (!turn) throw new Error('La apertura de caja no está disponible en esta computadora.');
    const movements = await this.offline.readSnapshot<any[]>(this.offline.snapshotKey('local-cash-movements', companyId)) || [];
    const localTurnMovements = movements.filter(item => item.__offlineOrigin === true && item.__offlinePending !== false && Number(item.idCajeroTurno) === Number(id));
    const total = localTurnMovements.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const closed = { ...turn, active: false, fechaCierre: new Date().toISOString(), efectivoContado, efectivoEsperado: Number(turn.fondoInicial || 0) + total, diferencia: efectivoContado - Number(turn.fondoInicial || 0) - total, notas, offlinePending: true };
    await this.offline.queueOperation({ companyId, type: 'cash.close', localEntityId: Number(id), payload: { turnId: Number(id), efectivoContado, notas } });
    await this.offline.saveSnapshot(key, companyId, 'caja', turns.map(item => Number(item.id) === Number(id) ? closed : item));
    await this.createLocalCut({ idCompany: companyId, fechaDesde: String(turn.fechaInicio).slice(0, 10), fechaHasta: String(closed.fechaCierre).slice(0, 10), total: total + Number(turn.fondoInicial || 0), numeroPagos: localTurnMovements.length, idCajeroTurno: id, efectivoContado, offline: true });
    return closed;
  }

  private async createLocalCut(data: any): Promise<any> {
    const companyId = Number(data.idCompany || localStorage.getItem('company') || 0);
    const cut = { ...data, id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)), createdAt: new Date().toISOString(), offlinePending: true };
    await this.offline.queueOperation({ companyId, type: 'cash.cut.create', localEntityId: cut.id, payload: { cut } });
    const key = this.offline.snapshotKey('cash-history', companyId);
    const history = await this.offline.readSnapshot<any[]>(key) || [];
    await this.offline.saveSnapshot(key, companyId, 'caja', [cut, ...history]);
    return cut;
  }

  private collection(value: any): any[] { return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items : []; }
}
