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

  updateBillingManagement(idRoot: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/BillingManagement/${idRoot}`, data, { headers: this.trackingService.getHeaders() });
  }

  uploadCertificates(idRoot: number, formData: FormData): Observable<any> {
      console.log('idRoot:', idRoot);
    const headers = this.trackingService.getHeaders().delete('Content-Type');
    return this.http.post(`${environment.urlAdministration}/BillingManagement/upload-certificates/${idRoot}`, formData, { headers });
  }

  checkCertificates(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/BillingManagement/check-certificates/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  // Timbrado con Finkok (endpoint correcto según documentación)
  stampInvoice(idIncomeExpense: number): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/BillingManagement/stamp/${idIncomeExpense}`, {}, { headers: this.trackingService.getHeaders() });
  }

  // Generar XML sin timbrar (opcional, para preview)
  generateXml(idIncomeExpense: number): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/BillingManagement/generate-xml/${idIncomeExpense}`, {}, { headers: this.trackingService.getHeaders() });
  }

  // Validar con SAT
  validateWithSat(idIncomeExpense: number): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/BillingManagement/validate-sat/${idIncomeExpense}`, {}, { headers: this.trackingService.getHeaders() });
  }

  // Cancelar CFDI
  cancelInvoice(idIncomeExpense: number, motivoCancelacion: string, folioSustitucion?: string): Observable<any> {
    const body = {
      motivoCancelacion: motivoCancelacion,
      folioSustitucion: folioSustitucion || null
    };
    return this.http.post(`${environment.urlAdministration}/BillingManagement/cancel/${idIncomeExpense}`, body, { headers: this.trackingService.getHeaders() });
  }

  // Generar PDF
  getPdfInvoice(idIncomeExpense: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/BillingManagement/pdf/${idIncomeExpense}`, {
      headers: this.trackingService.getHeaders(),
      responseType: 'blob' as 'json'
    });
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
    //console.log("----- llamada a getNormalPayrolls, idBranch es: ", idBranch);
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
    return this.http.get<number>(`${environment.urlAdministration}/GetPayrollExistenceId`, { params });
  }

  // NormalPayroll
  addNormalPayroll(data: any): Observable<any> {
    console.log("------ entrando a administration service -- addNormalPayroll", data);
    return this.http.post<number>(`${environment.urlAdministration}/NormalPayrolls`, data, { headers: this.trackingService.getHeaders() }).pipe(
      tap(response => {
        console.log("Respuesta del servidor: ", response);
      })
    );
  }
  
  updateNormalPayroll(idNormal: number){
    return this.http.put(`${environment.urlAdministration}/NormalPayrolls/NormalPayrollClosing/${idNormal}`, {}, { headers: this.trackingService.getHeaders() })
  }

  updateSavingNormalPayroll(idNormalEmployee: number, monto: number): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/NormalPayrolls/UpdateSavingEmployeePayroll/${idNormalEmployee}/${monto}`, {}, { headers: this.trackingService.getHeaders() })
  }

  updateRealDiscountNormalPayroll(idNormalEmployee: number, monto: number): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/NormalPayrolls/UpdateRealDiscountEmployeePayroll/${idNormalEmployee}/${monto}`, {}, { headers: this.trackingService.getHeaders() })
  }

  getTypecustomers(idRoot: number){
    return this.http.get(`${environment.urlAdministration}/Customer/GetTypeCustomer?idCompany=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  getEmployeesBonus(startDate: string, endDate: string,  idBranch: number) {
    return this.http.get(`${environment.urlAdministration}/NormalPayrolls/bonus?startDate=${startDate}&endDate=${endDate}&idBranch=${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  addEmployeesBonus(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/NormalPayrolls/save-bonuses`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteEmployeeBonus(iDBonus: number): Observable<any> {
    console.log("------ entrando a administration service -- delete bonus");
    return this.http.delete(`${environment.urlAdministration}/NormalPayrolls/bonus/${iDBonus}`, { headers: this.trackingService.getHeaders() })
  }

  updateEmployeesBonus(iDBonus: number, data: any): Observable<any> {
    console.log("------ entrando a administration service -- update bonus", data);
    return this.http.put(`${environment.urlAdministration}/NormalPayrolls/${iDBonus}`, data, { headers: this.trackingService.getHeaders() })
  }

}
