import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { from, Observable, of, Subject } from 'rxjs';
import { ICustomer } from 'app/interface/icustomer';
import { CobranzaOfflineService } from './cobranza-offline.service';
import { CobranzaOfflineStoreService } from './cobranza-offline-store.service';

@Injectable({
  providedIn: 'root'
})
export class CustomersService {

  private readonly catalogSavedSubject = new Subject<{ idRoot: number; type: string }>();
  readonly catalogSaved$ = this.catalogSavedSubject.asObservable();

  notifyCatalogSaved(idRoot: number, type: string): void {
    this.catalogSavedSubject.next({ idRoot, type: (type || '').toUpperCase() });
  }

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private cobranzaOffline = inject(CobranzaOfflineService);
  private cobranzaOfflineStore = inject(CobranzaOfflineStoreService);

  // Clientes

  getCustomers(id: number, type: string) {
    const companyId = Number(localStorage.getItem('company') || 0);
    const key = this.cobranzaOffline.snapshotKey('customers-branch', companyId, id, type);
    return this.cobranzaOffline.cachedRequest(key, 'clientes de la sucursal', companyId,
      this.http.get(`${environment.urlAdministration}/Customer/branch/${id}?type=${type}`, { headers: this.trackingService.getHeaders() }));
  }

  getCustomersxPalace(idRoot: number) {
    //const apiUrl = `${environment.urlAdministration}/Customer/palacio?idCompany=${idRoot}`;
    //alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/Customer/palacio?idCompany=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  getProviders(id: number,type: string) {
    //const apiUrl = `${environment.urlAdministration}/Customer/branch/${id}?type=${type}`;      
    //alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/Customer/cusorprov?idCompany=${id}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getCustomersByCompany(idCompany: number, type: string = 'CUSTOMERS') {
    const key = this.cobranzaOffline.snapshotKey('customers-company', idCompany, type);
    return this.cobranzaOffline.cachedRequest(key, 'clientes', idCompany,
      this.http.get(`${environment.urlAdministration}/Customer/company?idCompany=${idCompany}&Type=${type}`, { headers: this.trackingService.getHeaders() }));
  }

  getCobranzaCustomersByBranch(branchId: number, companyId: number, type = 'CUSTOMERS') {
    const key = this.cobranzaOffline.snapshotKey('customers-branch', companyId, branchId, type);
    return this.cobranzaOffline.cachedRequest(key, 'clientes de la sucursal', companyId,
      this.http.get(`${environment.urlAdministration}/Customer/branch/${branchId}?type=${type}`, { headers: this.trackingService.getHeaders() }));
  }

  getCobranzaCustomerById(id: number, companyId: number, branchId: number, type = 'CUSTOMERS'): Observable<any> {
    if (!this.cobranzaOffline.isOffline) return this.getCustomerById(id);
    return from((async () => {
      for (const key of [
        this.cobranzaOffline.snapshotKey('customers-branch', companyId, branchId, type),
        this.cobranzaOffline.snapshotKey('customers-company', companyId, type)
      ]) {
        const rows = this.collection(await this.cobranzaOffline.readSnapshot<any>(key));
        const customer = rows.find(item => Number(item?.id) === Number(id));
        if (customer) return customer;
      }
      throw new Error('El cliente no está guardado en esta computadora para usarlo offline.');
    })());
  }

  createCobranzaCustomer(data: any): Observable<any> {
    if (!this.cobranzaOffline.isOffline) return this.addCustomer(data);
    const companyId = Number(data?.idRoot || localStorage.getItem('company') || 0);
    const branchId = Number(data?.idBranch || localStorage.getItem('branch') || 0);
    const localId = this.localId();
    const customer = { ...data, id: localId, idRoot: companyId, __offlinePending: true };
    return from((async () => {
      await this.cobranzaOffline.queueOperation({ companyId, type: 'customer.create', localEntityId: localId, payload: { customer, branchId } });
      await this.updateCustomerSnapshots(companyId, branchId, customer, localId);
      return customer;
    })());
  }

  updateCobranzaCustomer(id: number, data: any): Observable<any> {
    if (!this.cobranzaOffline.isOffline) return this.updateCustomer(id, data);
    const companyId = Number(data?.idRoot || localStorage.getItem('company') || 0);
    const branchId = Number(data?.idBranch || localStorage.getItem('branch') || 0);
    const customer = { ...data, id: Number(id), idRoot: companyId, __offlinePending: true };
    return from((async () => {
      await this.cobranzaOffline.queueOperation({ companyId, type: 'customer.update', localEntityId: Number(id), payload: { customer, branchId } });
      await this.updateCustomerSnapshots(companyId, branchId, customer, Number(id));
      return customer;
    })());
  }

  deleteCobranzaCustomer(id: number): Observable<any> {
    if (!this.cobranzaOffline.isOffline) return this.deleteCustomer(id);
    const companyId = Number(localStorage.getItem('company') || 0);
    const branchId = Number(localStorage.getItem('branch') || 0);
    return from((async () => {
      await this.cobranzaOffline.queueOperation({ companyId, type: 'customer.delete', localEntityId: Number(id), payload: { id: Number(id), branchId } });
      for (const key of [
        this.cobranzaOffline.snapshotKey('customers-branch', companyId, branchId, 'CUSTOMERS'),
        this.cobranzaOffline.snapshotKey('customers-company', companyId, 'CUSTOMERS')
      ]) {
        const snapshot = await this.cobranzaOffline.readSnapshot<any>(key);
        if (snapshot) await this.cobranzaOffline.saveSnapshot(key, companyId, 'clientes', this.replaceCollection(snapshot, this.collection(snapshot).filter(item => Number(item?.id) !== Number(id))));
      }
      return { id, offlinePending: true };
    })());
  }

  // Clientes configurados para facturación electrónica
  getCustomersBilling(idRoot: number): Observable<any> {
    //  const apiUrl = `${environment.urlAdministration}/CustomersBilling/by-root/${idRoot}`;      
    //  alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/CustomersBilling/by-root/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  // Obtener datos de facturación por customer específico
  getCustomersBillingByCustomer(idCustomer: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/CustomersBilling/by-customer/${idCustomer}`, { headers: this.trackingService.getHeaders() });
  }

  addCustomerBilling(data: any): Observable<any> {
     // const apiUrl = `${environment.urlAdministration}/CustomersBilling/` + data;      
     // console.log('log apiUrl', data);
     // alert(apiUrl)  

    return this.http.post(`${environment.urlAdministration}/CustomersBilling`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCustomerBilling(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/CustomersBilling/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteCustomerBilling(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/CustomersBilling/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getCobranzaLoans(customerId: number): Observable<any[]> {
    const companyId = Number(localStorage.getItem('company') || 0);
    const key = this.cobranzaOffline.snapshotKey('loans-customer', companyId, customerId);
    return this.cobranzaOffline.cachedRequest(key, 'préstamos del cliente', companyId,
      this.http.get<any[]>(`${environment.urlAdministration}/PrestamosCobranza/cliente/${customerId}`, { headers: this.trackingService.getHeaders() }));
  }

  getCobranzaDashboard(rootId: number): Observable<any[]> {
    const key = this.cobranzaOffline.snapshotKey('dashboard', rootId);
    return this.cobranzaOffline.cachedRequest(key, 'resumen de Cobranza', rootId,
      this.http.get<any[]>(`${environment.urlAdministration}/PrestamosCobranza/dashboard/${rootId}`, { headers: this.trackingService.getHeaders() }));
  }

  createCobranzaLoan(data: any): Observable<any> {
    if (this.cobranzaOffline.isOffline) return from(this.createLocalCobranzaLoan(data));
    return this.http.post(`${environment.urlAdministration}/PrestamosCobranza`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCobranzaLoan(loanId: number, data: any): Observable<void> {
    if (this.cobranzaOffline.isOffline) return from(this.updateLocalCobranzaLoan(loanId, data));
    return this.http.put<void>(`${environment.urlAdministration}/PrestamosCobranza/${loanId}`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCobranzaSalesNoteNumber(loanId: number, data: { numeroNotaVenta: string }): Observable<void> {
    if (this.cobranzaOffline.isOffline) return from(this.updateLocalSalesNoteNumber(loanId, data.numeroNotaVenta));
    return this.http.put<void>(`${environment.urlAdministration}/PrestamosCobranza/${loanId}/nota-venta`, data, { headers: this.trackingService.getHeaders() });
  }

  addCobranzaInstallmentPayment(installmentId: number, data: any): Observable<any> {
    if (this.cobranzaOffline.isOffline) return from(this.addLocalCobranzaPayment(installmentId, data));
    return this.http.post(`${environment.urlAdministration}/PrestamosCobranza/cuota/${installmentId}/abonos`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCobranzaInstallmentDate(installmentId: number, data: { fechaProgramada: string }): Observable<void> {
    if (this.cobranzaOffline.isOffline) return from(this.updateLocalInstallmentDate(installmentId, data.fechaProgramada));
    return this.http.put<void>(`${environment.urlAdministration}/PrestamosCobranza/cuota/${installmentId}/fecha`, data, { headers: this.trackingService.getHeaders() });
  }

  deactivateCobranzaInstallment(installmentId: number): Observable<void> {
    if (this.cobranzaOffline.isOffline) return from(this.deactivateLocalInstallment(installmentId));
    return this.http.delete<void>(`${environment.urlAdministration}/PrestamosCobranza/cuota/${installmentId}`, { headers: this.trackingService.getHeaders() });
  }

  deactivateCobranzaInstallmentPayment(paymentId: number): Observable<any> {
    if (this.cobranzaOffline.isOffline) return from(this.deactivateLocalCobranzaPayment(paymentId));
    return this.http.delete(`${environment.urlAdministration}/PrestamosCobranza/abonos/${paymentId}`, { headers: this.trackingService.getHeaders() });
  }

  getCobranzaPayments(customerId: number): Observable<any[]> {
    const companyId = Number(localStorage.getItem('company') || 0);
    const key = this.cobranzaOffline.snapshotKey('payments-customer', companyId, customerId);
    return this.cobranzaOffline.cachedRequest(key, 'pagos del cliente', companyId,
      this.http.get<any[]>(`${environment.urlAdministration}/PagosCobranza/cliente/${customerId}`, { headers: this.trackingService.getHeaders() }));
  }

  addCobranzaPayment(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/PagosCobranza`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCobranzaPayment(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/PagosCobranza/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deactivateCobranzaPayment(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/PagosCobranza/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addCustomer(data: any): Observable<ICustomer> {
    return this.http.post<ICustomer>(`${environment.urlAdministration}/Customer`, data, { headers: this.trackingService.getHeaders() });
  }

  getCustomerById(id: number): Observable<ICustomer> {
    return this.http.get<ICustomer>(`${environment.urlAdministration}/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }
  

  updateCustomer(id: number, data: any): Observable<ICustomer> {
    return this.http.put<ICustomer>(`${environment.urlAdministration}/Customer/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteCustomer(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  private localId(): number { return -(Date.now() * 1000 + Math.floor(Math.random() * 1000)); }
  private collection(value: any): any[] { return Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items : []; }
  private replaceCollection(original: any, rows: any[]): any { return Array.isArray(original) ? rows : { ...original, data: rows }; }

  private async updateCustomerSnapshots(companyId: number, branchId: number, customer: any, id: number): Promise<void> {
    for (const key of [
      this.cobranzaOffline.snapshotKey('customers-branch', companyId, branchId, 'CUSTOMERS'),
      this.cobranzaOffline.snapshotKey('customers-company', companyId, 'CUSTOMERS')
    ]) {
      const snapshot = await this.cobranzaOffline.readSnapshot<any>(key);
      const rows = this.collection(snapshot);
      const index = rows.findIndex(item => Number(item?.id) === Number(id));
      if (index >= 0) rows[index] = customer;
      else rows.push(customer);
      await this.cobranzaOffline.saveSnapshot(key, companyId, 'clientes', this.replaceCollection(snapshot ?? [], rows));
    }
  }

  private offlineCompanyId(): number { return Number(localStorage.getItem('company') || 0); }
  private loanSnapshotKey(companyId: number, customerId: number): string { return this.cobranzaOffline.snapshotKey('loans-customer', companyId, customerId); }

  private async updateLoanSnapshots(companyId: number, customerId: number, loanId: number, update: (loan: any) => any, create?: any): Promise<any> {
    const key = this.loanSnapshotKey(companyId, customerId);
    const loans = this.collection(await this.cobranzaOffline.readSnapshot<any>(key));
    const updated = loans.map(loan => Number(loan.id) === Number(loanId) ? update(loan) : loan);
    if (create && !updated.some(loan => Number(loan.id) === Number(create.id))) updated.push(create);
    await this.cobranzaOffline.saveSnapshot(key, companyId, 'préstamos', updated);
    const dashboardKey = this.cobranzaOffline.snapshotKey('dashboard', companyId);
    const dashboard = this.collection(await this.cobranzaOffline.readSnapshot<any>(dashboardKey));
    const remaining = dashboard.filter(loan => Number(loan.idCustomer) !== Number(customerId));
    await this.cobranzaOffline.saveSnapshot(dashboardKey, companyId, 'préstamos', [...remaining, ...updated.map(loan => ({ ...loan, idCustomer: customerId }))]);
    return updated.find(loan => create ? Number(loan.id) === Number(create.id) : true);
  }

  private async createLocalCobranzaLoan(data: any): Promise<any> {
    const companyId = this.offlineCompanyId();
    const customerId = Number(data?.idCustomer);
    const id = this.localId();
    const count = Math.max(1, Math.trunc(Number(data?.numeroCuotas || 1)));
    const principal = Number(data?.montoTotal || 0);
    const interest = Number(data?.montoInteresTotal || 0);
    const capitalEach = Math.round(principal / count * 100) / 100;
    const interestEach = Math.round(interest / count * 100) / 100;
    const first = new Date(`${data.fechaPrimerPago}T12:00:00`);
    let assignedCapital = 0, assignedInterest = 0;
    const cuotas = Array.from({ length: count }, (_, index) => {
      const montoCapital = index === count - 1 ? Math.round((principal - assignedCapital) * 100) / 100 : capitalEach;
      const montoInteres = index === count - 1 ? Math.round((interest - assignedInterest) * 100) / 100 : interestEach;
      assignedCapital += montoCapital; assignedInterest += montoInteres;
      const frequency = String(data.frecuenciaPago || 'MENSUAL').toUpperCase();
      const date = frequency === 'DIARIO' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + index)
        : frequency === 'SEMANAL' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + index * 7)
          : frequency === 'QUINCENAL' ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + index * 14)
            : new Date(first.getFullYear(), first.getMonth() + index, Math.min(first.getDate(), new Date(first.getFullYear(), first.getMonth() + index + 1, 0).getDate()));
      const fechaProgramada = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { id: this.localId(), idPrestamo: id, numeroCuota: index + 1, fechaProgramada, montoCapital, montoInteres, montoProgramado: montoCapital + montoInteres, montoAplicado: 0, abonos: [], active: true, __offlinePending: true };
    });
    const loan = { ...data, id, idCustomer: customerId, montoInteresTotal: interest, totalInteres: interest, cuotas, active: true, __offlinePending: true };
    await this.cobranzaOffline.queueOperation({ companyId, type: 'loan.create', localEntityId: id, payload: { loan, request: data } });
    await this.updateLoanSnapshots(companyId, customerId, id, current => current, loan);
    return loan;
  }

  private async updateLocalCobranzaLoan(id: number, data: any): Promise<void> {
    const loan = await this.findLocalLoan(id);
    if (!loan) throw new Error('El préstamo no está disponible en los datos offline de esta computadora.');
    const companyId = this.offlineCompanyId();
    const customerId = Number(loan.idCustomer);
    await this.cobranzaOffline.queueOperation({ companyId, type: 'loan.update', localEntityId: Number(id), payload: { id: Number(id), data: { ...data } } });
    await this.updateLoanSnapshots(companyId, customerId, Number(id), current => ({ ...current, ...data, __offlinePending: true }));
  }

  private async updateLocalSalesNoteNumber(id: number, numeroNotaVenta: string): Promise<void> {
    const loan = await this.findLocalLoan(id);
    if (!loan) throw new Error('El préstamo no está disponible en los datos offline de esta computadora.');
    const companyId = this.offlineCompanyId();
    const customerId = Number(loan.idCustomer);
    await this.cobranzaOffline.queueOperation({ companyId, type: 'loan.note', localEntityId: Number(id), payload: { id: Number(id), data: { numeroNotaVenta } } });
    await this.updateLoanSnapshots(companyId, customerId, Number(id), current => ({ ...current, numeroNotaVenta, __offlinePending: true }));
  }

  private async findLocalLoan(loanId: number): Promise<any | null> {
    const companyId = this.offlineCompanyId();
    for (const snapshot of await this.cobranzaOfflineStore.getSnapshots<any>(companyId, 'préstamos')) {
      for (const loan of this.collection(snapshot.value)) if (Number(loan.id) === Number(loanId)) return loan;
    }
    return null;
  }

  private async findLocalInstallment(installmentId: number): Promise<{ loan: any; customerId: number; installment: any } | null> {
    const companyId = this.offlineCompanyId();
    for (const snapshot of await this.cobranzaOfflineStore.getSnapshots<any>(companyId, 'préstamos')) {
      for (const loan of this.collection(snapshot.value)) {
        const installment = (loan.cuotas || []).find((item: any) => Number(item.id) === Number(installmentId));
        if (installment) return { loan, customerId: Number(loan.idCustomer), installment };
      }
    }
    return null;
  }

  private async updateLocalInstallmentDate(installmentId: number, date: string): Promise<void> {
    const found = await this.findLocalInstallment(installmentId);
    if (!found) throw new Error('La cuota no está guardada en esta computadora para usarla offline.');
    const companyId = this.offlineCompanyId();
    await this.cobranzaOffline.queueOperation({ companyId, type: 'installment.date', localEntityId: Number(installmentId), payload: { installmentId: Number(installmentId), loanId: Number(found.loan.id), customerId: found.customerId, numeroCuota: found.installment.numeroCuota, fechaProgramada: date } });
    await this.updateLoanSnapshots(companyId, found.customerId, Number(found.loan.id), loan => ({
      ...loan, cuotas: (loan.cuotas || []).map((item: any) => Number(item.id) === Number(installmentId) ? { ...item, fechaProgramada: date, __offlinePending: true } : item)
    }));
  }

  private async addLocalCobranzaPayment(installmentId: number, data: any): Promise<any> {
    const found = await this.findLocalInstallment(installmentId);
    if (!found) throw new Error('La cuota no está guardada en esta computadora para registrar el pago.');
    const companyId = this.offlineCompanyId();
    const payment = { ...data, id: this.localId(), idCuota: Number(installmentId), active: true, __offlinePending: true };
    await this.cobranzaOffline.queueOperation({ companyId, type: 'payment.create', localEntityId: Number(payment.id), payload: { installmentId: Number(installmentId), loanId: Number(found.loan.id), customerId: found.customerId, payment } });
    const movementKey = this.cobranzaOffline.snapshotKey('local-cash-movements', companyId);
    const localMovements = this.collection(await this.cobranzaOffline.readSnapshot<any>(movementKey));
    localMovements.push({ ...payment, idPrestamo: Number(found.loan.id), idCuota: Number(installmentId), idCustomer: found.customerId, __offlineOrigin: true });
    await this.cobranzaOffline.saveSnapshot(movementKey, companyId, 'movimientos locales', localMovements);
    const paymentKey = this.cobranzaOffline.snapshotKey('payments-customer', companyId, found.customerId);
    const cachedPayments = this.collection(await this.cobranzaOffline.readSnapshot<any>(paymentKey));
    await this.cobranzaOffline.saveSnapshot(paymentKey, companyId, 'pagos', [...cachedPayments, payment]);
    await this.updateLoanSnapshots(companyId, found.customerId, Number(found.loan.id), loan => ({
      ...loan,
      cuotas: (loan.cuotas || []).map((item: any) => Number(item.id) === Number(installmentId)
        ? { ...item, montoAplicado: Number(item.montoAplicado || 0) + Number(payment.monto || 0), abonos: [...(item.abonos || []), payment], __offlinePending: true }
        : item)
    }));
    return payment;
  }

  private async deactivateLocalInstallment(installmentId: number): Promise<void> {
    const found = await this.findLocalInstallment(installmentId);
    if (!found) throw new Error('La cuota no está guardada en esta computadora para modificarla.');
    const companyId = this.offlineCompanyId();
    await this.cobranzaOffline.queueOperation({ companyId, type: 'installment.delete', localEntityId: Number(installmentId), payload: { installmentId: Number(installmentId), loanId: Number(found.loan.id), customerId: found.customerId } });
    await this.updateLoanSnapshots(companyId, found.customerId, Number(found.loan.id), loan => ({ ...loan, cuotas: (loan.cuotas || []).map((item: any) => Number(item.id) === Number(installmentId) ? { ...item, active: false, __offlinePending: true } : item) }));
  }

  private async deactivateLocalCobranzaPayment(paymentId: number): Promise<any> {
    const companyId = this.offlineCompanyId();
    for (const snapshot of await this.cobranzaOfflineStore.getSnapshots<any>(companyId, 'préstamos')) {
      for (const loan of this.collection(snapshot.value)) {
        for (const installment of loan.cuotas || []) {
          const payment = (installment.abonos || []).find((item: any) => Number(item.id) === Number(paymentId));
          if (!payment) continue;
          await this.cobranzaOffline.queueOperation({ companyId, type: 'payment.delete', localEntityId: Number(paymentId), payload: { paymentId: Number(paymentId), installmentId: Number(installment.id), loanId: Number(loan.id), customerId: Number(loan.idCustomer) } });
          await this.updateLoanSnapshots(companyId, Number(loan.idCustomer), Number(loan.id), current => ({
            ...current, cuotas: (current.cuotas || []).map((item: any) => Number(item.id) === Number(installment.id)
              ? { ...item, montoAplicado: Math.max(0, Number(item.montoAplicado || 0) - Number(payment.monto || 0)), abonos: (item.abonos || []).map((entry: any) => Number(entry.id) === Number(paymentId) ? { ...entry, active: false, __offlinePending: true } : entry) }
              : item)
          }));
          return { id: paymentId, offlinePending: true };
        }
      }
    }
    throw new Error('El abono no está guardado en esta computadora.');
  }

  updateFiel(id: number, type: string, operacion: string): Observable<ICustomer> {
  return this.http.put<ICustomer>(
    `${environment.urlAdministration}/Customer/Increment/${id}/${type}?operacion=${operacion}`,
    {},
    { headers: this.trackingService.getHeaders() }
  );
}

  //Customer/Increment/1114/CONTACT?operacion=RESTA
  // Clientes Créditos

  getClientCredits(id: number) {
    return this.http.get(`${environment.urlAdministration}/CustomerCredits/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addClientCredit(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/CustomerCredits`, data, { headers: this.trackingService.getHeaders() });
  }

  updateClientCredit(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/CustomerCredits/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteClientCredit(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/CustomerCredits/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Detalles créditos
  getDetailsCredits(id: number) {
    return this.http.get(`${environment.urlAdministration}/PaymentsCreditsxCustomers/credit/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addDetailCredit(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/PaymentsCreditsxCustomers`, data, { headers: this.trackingService.getHeaders() });
  }

  updateDetailCredit(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/PaymentsCreditsxCustomers/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteDetailCredit(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/PaymentsCreditsxCustomers/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addProveedorCredit(data: any): Observable<ICustomer> {
    return this.http.post<ICustomer>(`${environment.urlAdministration}/CustomerCreditsDelison`, data, { headers: this.trackingService.getHeaders() });
  }
  getProveedorCredit(id: number, table: number) {
    return this.http.get(`${environment.urlAdministration}/CustomerCreditsDelison/customer/${id}/${table}`, { headers: this.trackingService.getHeaders() });
  }

  addAbonoCustomer(id: number): Observable<ICustomer> {
    return this.http.put<ICustomer>(`${environment.urlAdministration}/CustomerCreditsDelison/abonoCuentas/${id}`, {}, { headers: this.trackingService.getHeaders() });
  }

  updateAbonoCustomer(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/CustomerCreditsDelison/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteAbonoCustomer(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/CustomerCreditsDelison/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getProductsPurchased(customerId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Salesxcustomer/productsPurchased/${customerId}`, { headers: this.trackingService.getHeaders() });
  }
}
