import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class AdministrationService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

 // Clientes

  getCustomers(id: number) {
    return this.http.get(`${environment.urlAdministration}/Customer/branch/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addCustomer(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Customer`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCustomer(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/Customer/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteCustomer(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Bancos
  
  getBanks() {
    return this.http.get(`${environment.urlAdministration}/Bank`, { headers: this.trackingService.getHeaders() });
  }
  get2fieldsBanks() {
    return this.http.get(`${environment.urlAdministration}/Bank/2fields`, { headers: this.trackingService.getHeaders() });
  }


  addBanks(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Bank`, data, { headers: this.trackingService.getHeaders() });
  }

  updateBanks(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/Bank/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteBanks(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/Bank/${id}`, { headers: this.trackingService.getHeaders() });
  }


  // Cuentas Bancos
  getAccountBanks( idRoot : number) {
    return this.http.get(`${environment.urlAdministration}/AccountBanks/Bussines/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  addAccountBanks(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/AccountBanks`, data, { headers: this.trackingService.getHeaders() });
  }

  updateAccountBanks(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/AccountBanks/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteAccountBanks(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/AccountBanks/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Income and Expense x Accounts
  getBalance( idAccount : number) {
    return this.http.get(`${environment.urlAdministration}/Incomeandexpense/Bussines/balance?id=${idAccount}`, { headers: this.trackingService.getHeaders() });
  }


  // Setup Puestos

  getSetupManagementInfo(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/SetupManagement/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }
  
  addSetupManagementInfo(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/SetupManagement`, data, { headers: this.trackingService.getHeaders() });
  }

  updateSetupManagementInfo(idRoot: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/SetupManagement/${idRoot}`, data, { headers: this.trackingService.getHeaders() });
  }
  
}
