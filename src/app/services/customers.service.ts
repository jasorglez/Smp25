import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CustomersService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Clientes

  getCustomers(id: number, type: string) {
    //const apiUrl = `${environment.urlAdministration}/Customer/branch/${id}?type=${type}`;      
    //alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/Customer/branch/${id}?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getCustomersByCompany(root : number, type: string) {
    
    const apiUrl = `${environment.urlAdministration}/Customer/company?idCompany=${root}&Type=${type}`;
    return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
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




}
