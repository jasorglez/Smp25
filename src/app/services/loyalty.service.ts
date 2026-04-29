import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private http           = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return { headers: this.trackingService.getHeaders() }; }

  // ── Programas ────────────────────────────────────────────────────────────
  getPrograms(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/LoyaltyProgram/${idCompany}`,
      this.headers
    );
  }

  createProgram(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/LoyaltyProgram`, data, this.headers);
  }

  updateProgram(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlWarehouse}/LoyaltyProgram/${id}`, data, this.headers);
  }

  deleteProgram(id: number): Observable<any> {
    return this.http.delete(`${environment.urlWarehouse}/LoyaltyProgram/${id}`, this.headers);
  }

  // ── Tarjetas de Clientes ─────────────────────────────────────────────────
  getCardsByProgram(idProgram: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/CustomerLoyaltyCard/byProgram/${idProgram}`,
      this.headers
    );
  }

  getCardsByCustomer(idCustomer: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/CustomerLoyaltyCard/byCustomer/${idCustomer}`,
      this.headers
    );
  }

  addStamp(idCustomer: number, idLoyaltyProgram: number): Observable<any> {
    return this.http.post(
      `${environment.urlWarehouse}/CustomerLoyaltyCard/addStamp?idCustomer=${idCustomer}&idLoyaltyProgram=${idLoyaltyProgram}`,
      {},
      this.headers
    );
  }

  createCard(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/CustomerLoyaltyCard`, data, this.headers);
  }
}
