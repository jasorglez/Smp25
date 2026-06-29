import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class StoresService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getStoreAll(){
    return this.http.get<any>(`${environment.urlAdministration}/Stores/all`, { headers: this.trackingService.getHeaders() });
  }

  getStoreCompany(idCompany: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/Stores/company/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getStoreList(idBranch: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/Stores/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getStore(idStore: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/Stores/${idStore}`, { headers: this.trackingService.getHeaders() });
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
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/store/${idStore}`, { headers: this.trackingService.getHeaders() });
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
