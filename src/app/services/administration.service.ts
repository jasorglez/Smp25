import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, tap } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})

export class AdministrationService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Bancos
  getBanks() {
     //const apiUrl = `${environment.urlAdministration}/Bank`;
    // alert(apiUrl)
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
    const apiUrl = `${environment.urlAdministration}/Bank/${id}`;
    alert(apiUrl)
    return this.http.delete<any[]>(`${environment.urlAdministration}/Bank/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Cuentas Bancos
  getAccountBanks(idRoot: number): Observable<any> {
    //const apiUrl = `${environment.urlAdministration}/AccountBanks/Bussines/${idRoot}`;
   // alert(apiUrl)
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
  getBalance(idAccount: number) {
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

  // Setup Facturacion
  getBillingManagementInfo(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/BillingManagement/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  addBillingManagementInfo(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/BillingManagement`, data, { headers: this.trackingService.getHeaders() });
  }

  updateBillingManagementInfo(idRoot: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/BillingManagement/${idRoot}`, data, { headers: this.trackingService.getHeaders() });
  }

  getFiscalRegimes(): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/FiscalRegime`, { headers: this.trackingService.getHeaders() });
  }

  getAdditionalInfo(id: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/InformationAditional/idInExp/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addAdditionalInfo(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/InformationAditional`, data, { headers: this.trackingService.getHeaders() });
  }

  updateAdditionalInfo(id: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/InformationAditional/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  // Payroll
  getNormalPayrolls(idBranch: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/NormalPayrolls/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getEmployeesByNormalPayroll(id: number){
    return this.http.get(`${environment.urlAdministration}/EmployeesByNormalPayroll`);
  }

  getDPPayrollsExistence(startDate: Date, endDate: Date, idBranch: number): Observable<number> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('idBranch', idBranch.toString());
    return this.http.get<number>(`${environment.urlLocalJG}/GetPayrollExistenceId`, { params });
  }

  // NormalPayroll
  addNormalPayroll(data: any): Observable<any> {
    return this.http.post<number>(`${environment.urlAdministration}/NormalPayrolls`, data, { headers: this.trackingService.getHeaders() }).pipe(
      tap(response => {
        console.log("Respuesta del servidor: ", response);
      })
    );
  }
}
