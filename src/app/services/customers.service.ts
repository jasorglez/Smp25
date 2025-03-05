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
    
    getCustomers(id: number, type : string) {
      //const apiUrl = `${environment.urlAdministration}/Customer/branch/${id}?type=${type}`;      
       //alert(apiUrl)  
      return this.http.get(`${environment.urlAdministration}/Customer/branch/${id}?type=${type}`, { headers: this.trackingService.getHeaders() });                                              
    }
  
    getCustomersByCompany(branchIds: number[], type: string) {
      const ids = branchIds.join(','); // Convertimos los IDs a una cadena separada por comas
      const apiUrl = `${environment.urlAdministration}/Customer/company?branchIds=${encodeURIComponent(ids)}&type=${type}`;    
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

}
