import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class CashRegistersService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  
  getCashRegisterAll(): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/all`, { headers: this.trackingService.getHeaders() });
  }
  getCashRegisterByBranch(idBranch: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getCashRegisterByCompany(idCompany: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/company/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getCashRegisterList(idStore: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/store/${idStore}`, { headers: this.trackingService.getHeaders() });
  }

  getCashRegister(idCashRegister: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, { headers: this.trackingService.getHeaders() });
  }

  addCashRegister(store: any): Observable<any> {
    return this.http.post<any>(`${environment.urlAdministration}/CashRegisters`, store, { headers: this.trackingService.getHeaders() });
  }

  updateCashRegister(idCashRegister: number, store: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, store, { headers: this.trackingService.getHeaders() });
  }

  deleteCashRegister(idCashRegister: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, { headers: this.trackingService.getHeaders() });
  }

}
