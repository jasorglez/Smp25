import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getCurrencies(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idCompany}&type=Currency`, { headers: this.trackingService.getHeaders() });
  }

  getPaymentTypes(idCompany: number) {
    return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idCompany}&type=TYPECURRENCY`, { headers: this.trackingService.getHeaders() });
  }

  /**
   * Fase 4: tipo de cambio a MXN de una moneda a una fecha (Banxico FIX → respaldo → caché).
   * El backend devuelve 204 (body vacío) si ninguna fuente respondió → el frontend pide TC manual.
   */
  getRate(moneda: string, fecha: string): Observable<{ tasa: number; fuente: string; fecha: string } | null> {
    return this.http.get<{ tasa: number; fuente: string; fecha: string }>(
      `${environment.urlWarehouse}/Currency/rate?moneda=${encodeURIComponent(moneda)}&fecha=${encodeURIComponent(fecha)}`,
      { headers: this.trackingService.getHeaders() });
  }
}
