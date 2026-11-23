import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CobranzaOfflineService } from './cobranza-offline.service';

@Injectable({
  providedIn: 'root'
})
export class CashRegistersService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private offline = inject(CobranzaOfflineService);
  
  getCashRegisterAll(): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/CashRegisters/all`, { headers: this.trackingService.getHeaders() });
  }
  getCashRegisterByBranch(idBranch: number): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-registers-branch', companyId, idBranch), 'cajas registradoras de la sucursal', companyId,
      this.http.get<any>(`${environment.urlAdministration}/CashRegisters/branch/${idBranch}`, { headers: this.trackingService.getHeaders() }));
  }

  getCashRegisterByCompany(idCompany: number): Observable<any> {
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-registers-company', idCompany), 'cajas registradoras de la empresa', idCompany,
      this.http.get<any>(`${environment.urlAdministration}/CashRegisters/company/${idCompany}`, { headers: this.trackingService.getHeaders() }));
  }

  getCashRegisterList(idStore: number): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-registers', companyId, idStore), 'cajas registradoras', companyId,
      this.http.get<any>(`${environment.urlAdministration}/CashRegisters/store/${idStore}`, { headers: this.trackingService.getHeaders() }));
  }

  getCashRegister(idCashRegister: number): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.offline.cachedRequest(this.offline.snapshotKey('cash-register', companyId, idCashRegister), 'caja registradora', companyId,
      this.http.get<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, { headers: this.trackingService.getHeaders() }));
  }

  addCashRegister(store: any): Observable<any> {
    return this.http.post<any>(`${environment.urlAdministration}/CashRegisters`, store, { headers: this.trackingService.getHeaders() });
  }

  updateCashRegister( store: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/CashRegisters/`, store, { headers: this.trackingService.getHeaders() });
  }

  deleteCashRegister(idCashRegister: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/CashRegisters/${idCashRegister}`, { headers: this.trackingService.getHeaders() });
  }

}
