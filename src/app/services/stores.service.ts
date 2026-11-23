import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CobranzaOfflineService } from './cobranza-offline.service';

@Injectable({
  providedIn: 'root'
})
export class StoresService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private offline = inject(CobranzaOfflineService);

  getStoreAll(){
    return this.http.get<any>(`${environment.urlAdministration}/Stores/all`, { headers: this.trackingService.getHeaders() });
  }

  getStoreCompany(idCompany: number): Observable<any> {
    return this.offline.cachedRequest(this.offline.snapshotKey('stores', idCompany), 'tiendas', idCompany,
      this.http.get<any>(`${environment.urlAdministration}/Stores/company/${idCompany}`, { headers: this.trackingService.getHeaders() }));
  }

  getStoreList(idBranch: number): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.offline.cachedRequest(this.offline.snapshotKey('stores-branch', companyId, idBranch), 'tiendas de la sucursal', companyId,
      this.http.get<any>(`${environment.urlAdministration}/Stores/branch/${idBranch}`, { headers: this.trackingService.getHeaders() }));
  }

  getStore(idStore: number): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.offline.cachedRequest(this.offline.snapshotKey('store', companyId, idStore), 'tienda', companyId,
      this.http.get<any>(`${environment.urlAdministration}/Stores/${idStore}`, { headers: this.trackingService.getHeaders() }));
  }

  addStore(store: any): Observable<any> {
    console.log(store);
    return this.http.post<any>(`${environment.urlAdministration}/Stores`, store, { headers: this.trackingService.getHeaders() });
  }

  updateStore(idStore: number, store: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/Stores/${idStore}`, store, { headers: this.trackingService.getHeaders() });
  }

  deleteStore(idStore: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/Stores/${idStore}`, { headers: this.trackingService.getHeaders() });
  }

  addCashRegister(cashRegister: any): Observable<any> {
    return this.http.post<any>(`${environment.urlAdministration}/CashRegisters`, cashRegister, { headers: this.trackingService.getHeaders() });
  }

  getCashRegisters(idStore: number): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-registers', companyId, idStore), 'cajas registradoras', companyId,
      this.http.get<any>(`${environment.urlAdministration}/CashRegisters/store/${idStore}`, { headers: this.trackingService.getHeaders() }));
  }

  getCashRegister(idCashRegister: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, { headers: this.trackingService.getHeaders() });
  }

  updateCashRegister(idCashRegister: number, cashRegister: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, cashRegister, { headers: this.trackingService.getHeaders() });
  }

  deleteCashRegister(idCashRegister: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, { headers: this.trackingService.getHeaders() });
  }

}
