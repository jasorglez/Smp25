import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PosService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getClients(id: number) {
    return this.http.get(`${environment.urlAdministration}/Customer/active?idBranch=${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Este es el endpoint que añade la lista de artículos comprados
  addSaleXConceptItem(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Salesxconcept`, data, { headers: this.trackingService.getHeaders() });
  }

  // Este es el endpoint que debe crear el id de la venta
  addSaleXCustomerItem(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Salesxcustomer`, data, { 
      headers: this.trackingService.getHeaders() 
    }).pipe(
      map((response: any) => {
        // Extraer el ID de la respuesta
        const saleId = response.id;
        return response;
      })
    );
  }

  getSalesXCustomer(id: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/Salesxcustomer/byCustomer/${id}`, { headers: this.trackingService.getHeaders() });
  }

}
