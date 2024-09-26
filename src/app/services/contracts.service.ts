import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { EMPTY, Observable } from 'rxjs';

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
    return this.http.get(`${environment.urlLinux3}/Contract/2cont?idBussines=${contract}`, { headers: this.trackingService.getHeaders() });
  }

}
