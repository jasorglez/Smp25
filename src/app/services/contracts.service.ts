import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractsService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  getContracts(contract: number) {
    return this.http.get(`${environment.urlSmp}/Contract?idBussines=${contract}`, { headers: this.trackingService.getHeaders() });
  }

  getContractsByProvider(id: number) {
    return this.http.get(`${environment.urlSmp}/Contract/provider?provider=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getContractsBy2fields(id: number) {
    return this.http.get(`${environment.urlSmp}/Contract/2fields?idBussines=${id}`, { headers: this.trackingService.getHeaders() });
  }

}
