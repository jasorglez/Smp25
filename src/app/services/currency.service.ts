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

  getPaymentTypes() {
    return this.http.get(`${environment.urlWarehouse}/Catalog?type=Pay`, { headers: this.trackingService.getHeaders() });
  }
}
