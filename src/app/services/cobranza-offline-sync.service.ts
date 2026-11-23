import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { CobranzaOfflineService } from './cobranza-offline.service';
import { CobranzaOfflineOperation, CobranzaOfflineSnapshot, CobranzaOfflineStoreService } from './cobranza-offline-store.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CobranzaOfflineSyncService {
  private readonly http = inject(HttpClient);
  private readonly tracking = inject(TrackingService);
  private readonly offline = inject(CobranzaOfflineService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(CobranzaOfflineStoreService);
  private readonly base = `${environment.urlAdministration}`;
  private syncing = false;
  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', () => { void this.syncCurrentCompany(); });
    window.setInterval(() => { if (navigator.onLine) void this.syncCurrentCompany(); }, 30_000);
    if (navigator.onLine) void this.syncCurrentCompany();
  }

  async retryFailed(companyId: number): Promise<void> {
    await this.sync(companyId, true);
  }

  async syncCurrentCompany(): Promise<void> {
    const companyId = Number(localStorage.getItem('company') || 0);
    if (companyId) await this.sync(companyId, false);
  }

  private async sync(companyId: number, retryErrors: boolean): Promise<void> {
    if (!navigator.onLine || this.syncing) return;
    this.syncing = true;
    let synchronizedAny = false;
    try {
      if (this.auth.isTokenExpired() && !(await this.auth.renewToken())) {
        this.offline.setSyncError('La sesión debe renovarse al recuperar internet. Inicia sesión y vuelve a sincronizar.');
        return;
      }
      this.currentIdMap = await this.store.getMeta<Record<string, number>>(`id-map:${companyId}`) || {};
      const operations = await this.store.getPendingOperations(companyId);
      if (retryErrors || !operations.some(operation => operation.status === 'ERROR')) this.offline.setSyncError('');
      for (const operation of operations) {
        const activeEmail = String(localStorage.getItem('mail') || '').toLowerCase();
        if (operation.userEmail && operation.userEmail.toLowerCase() !== activeEmail) {
          this.offline.setSyncError('Hay movimientos locales de otra sesión. Inicia sesión con la cuenta que los capturó para sincronizarlos.');
          break;
        }
        // Mantener el orden: una operación posterior puede depender de IDs creados antes.
        if (operation.status === 'ERROR' && !retryErrors) {
          this.offline.setSyncError(operation.error || 'Una operación anterior requiere revisión antes de continuar.');
          break;
        }
        if (!navigator.onLine) break;
        operation.status = 'SYNCING';
        operation.error = undefined;
        await this.store.updateOperation(operation);
        try {
          await this.execute(operation);
          operation.status = 'SYNCED';
          await this.store.updateOperation(operation);
          synchronizedAny = true;
        } catch (error: any) {
          operation.status = navigator.onLine ? 'ERROR' : 'PENDING';
          operation.error = this.describeError(error);
          await this.store.updateOperation(operation);
          this.offline.setSyncError(operation.error);
          break;
        }
      }
    } finally {
      this.syncing = false;
      if (synchronizedAny) {
        await this.offline.markSnapshotSynced();
        this.offline.notifySyncCompleted();
      }
      await this.offline.refreshPendingCount(companyId);
    }
  }

  private async execute(operation: CobranzaOfflineOperation): Promise<void> {
    const payload: any = operation.payload || {};
    const headers = this.tracking.getHeaders().set('X-Offline-Operation-Id', operation.id);
    let result: any;
    switch (operation.type) {
      case 'customer.create': {
        const customer = { ...payload.customer };
        delete customer.id; delete customer.__offlinePending;
        result = await firstValueFrom(this.http.post<any>(`${this.base}/Customer`, customer, { headers }));
        await this.saveMapping(operation, this.extractId(result));
        return;
      }
      case 'customer.update': {
        const id = this.resolveId(Number(payload.customer?.id));
        const customer = this.resolveDeep({ ...payload.customer, id });
        delete customer.__offlinePending;
        await firstValueFrom(this.http.put<any>(`${this.base}/Customer/${id}`, customer, { headers }));
        return;
      }
      case 'customer.delete': {
        const id = this.resolveId(Number(payload.id));
        await firstValueFrom(this.http.delete<any>(`${this.base}/Customer/${id}`, { headers }));
        return;
      }
      case 'loan.create': {
        const request = this.resolveDeep({ ...payload.request });
        delete request.id; delete request.cuotas; delete request.active; delete request.__offlinePending;
        result = await firstValueFrom(this.http.post<any>(`${this.base}/PrestamosCobranza`, request, { headers }));
        const serverLoanId = this.extractId(result) || await this.findCreatedLoanId(request);
        if (!serverLoanId) throw new Error('El préstamo se envió, pero el servidor no devolvió su identificador para continuar la sincronización.');
        await this.saveMapping(operation, serverLoanId);
        await this.mapInstallments(payload.loan, serverLoanId, Number(request.idCustomer));
        return;
      }
      case 'loan.update': {
        const id = this.resolveId(Number(payload.id));
        const data = this.resolveDeep({ ...payload.data });
        delete data.__offlinePending;
        await firstValueFrom(this.http.put<any>(`${this.base}/PrestamosCobranza/${id}`, data, { headers }));
        return;
      }
      case 'loan.note': {
        const id = this.resolveId(Number(payload.id));
        await firstValueFrom(this.http.put<any>(`${this.base}/PrestamosCobranza/${id}/nota-venta`, payload.data, { headers }));
        return;
      }
      case 'installment.date': {
        const id = this.resolveId(Number(payload.installmentId));
        await firstValueFrom(this.http.put<any>(`${this.base}/PrestamosCobranza/cuota/${id}/fecha`, { fechaProgramada: payload.fechaProgramada }, { headers }));
        return;
      }
      case 'installment.delete': {
        const id = this.resolveId(Number(payload.installmentId));
        await firstValueFrom(this.http.delete<any>(`${this.base}/PrestamosCobranza/cuota/${id}`, { headers }));
        return;
      }
      case 'payment.create': {
        const id = this.resolveId(Number(payload.installmentId));
        const payment = this.resolveDeep({ ...payload.payment });
        delete payment.id; delete payment.idCuota; delete payment.__offlinePending;
        result = await firstValueFrom(this.http.post<any>(`${this.base}/PrestamosCobranza/cuota/${id}/abonos`, payment, { headers }));
        await this.saveMapping(operation, this.extractId(result));
        await this.markLocalPaymentSynced(operation);
        return;
      }
      case 'payment.delete': {
        const id = this.resolveId(Number(payload.paymentId));
        await firstValueFrom(this.http.delete<any>(`${this.base}/PrestamosCobranza/abonos/${id}`, { headers }));
        return;
      }
      case 'cash.open': {
        const turn = this.resolveDeep({ ...payload.turn });
        delete turn.id; delete turn.offlinePending;
        result = await firstValueFrom(this.http.post<any>(`${this.base}/CajeroTurno`, turn, { headers }));
        await this.saveMapping(operation, this.extractId(result));
        return;
      }
      case 'cash.close': {
        const id = this.resolveId(Number(payload.turnId));
        await firstValueFrom(this.http.put<any>(`${this.base}/CajeroTurno/${id}/cerrar`, { efectivoContado: payload.efectivoContado, notas: payload.notas }, { headers }));
        return;
      }
      case 'cash.cut.create': {
        const cut = this.resolveDeep({ ...payload.cut });
        delete cut.id; delete cut.offlinePending;
        result = await firstValueFrom(this.http.post<any>(`${this.base}/CortesCobranza`, cut, { headers }));
        await this.saveMapping(operation, this.extractId(result));
        return;
      }
      default:
        throw new Error(`Operación offline no reconocida: ${operation.type}`);
    }
  }

  private async saveMapping(operation: CobranzaOfflineOperation, serverId: number | null): Promise<void> {
    const localId = Number(operation.localEntityId || 0);
    if (!(localId < 0) || !serverId) {
      if (localId < 0) throw new Error(`El servidor no confirmó el identificador de ${operation.type}.`);
      return;
    }
    const map = await this.store.getMeta<Record<string, number>>(`id-map:${operation.companyId}`) || {};
    map[String(localId)] = serverId;
    await this.store.saveMeta(`id-map:${operation.companyId}`, map);
    this.currentIdMap = map;
    await this.remapSnapshots(operation.companyId, localId, serverId);
  }

  private async mapInstallments(localLoan: any, serverLoanId: number, customerId: number): Promise<void> {
    const key = this.offline.snapshotKey('loans-customer', Number(localStorage.getItem('company') || 0), customerId);
    let serverLoans: any[] = [];
    try {
      const response: any = await firstValueFrom(this.http.get<any>(`${this.base}/PrestamosCobranza/cliente/${customerId}`, { headers: this.tracking.getHeaders() }));
      serverLoans = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
    } catch { throw new Error('El préstamo se creó, pero no se pudieron recuperar sus cuotas para continuar la sincronización.'); }
    const serverLoan = serverLoans.find(item => Number(item.id) === Number(serverLoanId));
    if (!serverLoan) throw new Error('El préstamo se creó, pero no se encontró su calendario para continuar la sincronización.');
    const map = await this.store.getMeta<Record<string, number>>(`id-map:${Number(localStorage.getItem('company') || 0)}`) || {};
    for (const localInstallment of localLoan?.cuotas || []) {
      const serverInstallment = (serverLoan.cuotas || []).find((item: any) => Number(item.numeroCuota) === Number(localInstallment.numeroCuota));
      if (serverInstallment?.id) map[String(localInstallment.id)] = Number(serverInstallment.id);
    }
    await this.store.saveMeta(`id-map:${Number(localStorage.getItem('company') || 0)}`, map);
    this.currentIdMap = map;
    await this.remapSnapshots(Number(localStorage.getItem('company') || 0), Number(localLoan.id), Number(serverLoanId));
    for (const localInstallment of localLoan?.cuotas || []) {
      const serverInstallment = (serverLoan.cuotas || []).find((item: any) => Number(item.numeroCuota) === Number(localInstallment.numeroCuota));
      if (serverInstallment?.id) await this.remapSnapshots(Number(localStorage.getItem('company') || 0), Number(localInstallment.id), Number(serverInstallment.id));
    }
    const cached = await this.store.getSnapshot<any[]>(key);
    if (cached) await this.store.saveSnapshot({ ...cached, value: serverLoans });
  }

  private async findCreatedLoanId(request: any): Promise<number | null> {
    try {
      const response: any = await firstValueFrom(this.http.get<any>(`${this.base}/PrestamosCobranza/cliente/${request.idCustomer}`, { headers: this.tracking.getHeaders() }));
      const loans = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.items) ? response.items : [];
      const match = loans.filter(item => String(item.numeroNotaVenta || '') === String(request.numeroNotaVenta || ''))
        .sort((a, b) => Number(b.id) - Number(a.id))[0];
      return match ? Number(match.id) : null;
    } catch { return null; }
  }

  private resolveId(id: number): number {
    if (!(id < 0)) return id;
    // Resolve through every local mapping created in the queue for the current company.
    return this.currentIdMap[String(id)] || id;
  }

  private currentIdMap: Record<string, number> = {};

  private resolveDeep<T>(value: T): T {
    if (typeof value === 'number') return this.resolveId(value) as T;
    if (Array.isArray(value)) return value.map(item => this.resolveDeep(item)) as T;
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as any).map(([key, item]) => [key, this.resolveDeep(item)])) as T;
    return value;
  }

  private async remapSnapshots(companyId: number, localId: number, serverId: number): Promise<void> {
    this.currentIdMap[String(localId)] = serverId;
    for (const snapshot of await this.store.getSnapshots<any>(companyId)) {
      const remapped = this.replaceValue(snapshot.value, localId, serverId);
      if (JSON.stringify(remapped) !== JSON.stringify(snapshot.value)) await this.store.saveSnapshot({ ...snapshot, value: remapped });
    }
  }

  private async markLocalPaymentSynced(operation: CobranzaOfflineOperation): Promise<void> {
    const localId = Number(operation.localEntityId || 0);
    const serverId = this.currentIdMap[String(localId)] || localId;
    const key = this.offline.snapshotKey('local-cash-movements', operation.companyId);
    const snapshot = await this.store.getSnapshot<any[]>(key);
    if (!snapshot || !Array.isArray(snapshot.value)) return;
    const value = snapshot.value.map(payment => Number(payment.id) === Number(serverId)
      ? { ...payment, __offlinePending: false, __offlineOrigin: false }
      : payment);
    await this.store.saveSnapshot({ ...snapshot, value });
  }

  private replaceValue(value: any, from: number, to: number): any {
    if (typeof value === 'number') return value === from ? to : value;
    if (Array.isArray(value)) return value.map(item => this.replaceValue(item, from, to));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, this.replaceValue(child, from, to)]));
  }

  private extractId(result: any): number | null {
    const candidates = [result?.id, result?.data?.id, result?.data?.data?.id, result?.result?.id];
    const id = candidates.map(Number).find(value => Number.isInteger(value) && value > 0);
    return id || null;
  }

  private describeError(error: any): string {
    return String(error?.error?.error || error?.error?.message || error?.message || 'No se pudo sincronizar; revisa la conexión y vuelve a intentar.');
  }
}
