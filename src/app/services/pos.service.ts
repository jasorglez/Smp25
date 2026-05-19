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

  // Obtenemos el setup del POS
  getPosSetup(branchId: number, customerId: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/PosSetup/${branchId}/${customerId}`, { headers: this.trackingService.getHeaders() });
  }

  addPosSetup(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/PosSetup`, data, { headers: this.trackingService.getHeaders() });
  }

  updatePosSetup(idBranch: number, idCustomer: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/PosSetup/${idBranch}/${idCustomer}`, data, { headers: this.trackingService.getHeaders() });
  }

  // --- Loyalty / Fidelidad ---
  getLoyaltyAccount(phone: string, idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/Loyalty/account/${phone}/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getLoyaltyConfig(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/Loyalty/config/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  earnLoyaltyPoints(data: { phoneNumber: string; idCompany: number; idSale: number; amount: number; lines?: { idFamilia: number; amount: number }[] }): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Loyalty/earn`, data, { headers: this.trackingService.getHeaders() });
  }

  getLoyaltyFamilyConfig(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Loyalty/family-config/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  saveLoyaltyFamilyConfig(idCompany: number, configs: any[]): Observable<any[]> {
    return this.http.post<any[]>(`${environment.urlAdministration}/Loyalty/family-config/${idCompany}`, configs, { headers: this.trackingService.getHeaders() });
  }

  updateLoyaltyConfig(idCompany: number, factorPuntos: number): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/Loyalty/config`, { idCompany, factorPuntos }, { headers: this.trackingService.getHeaders() });
  }

}
