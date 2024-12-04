import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class AdministrationService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getBanks() {
    return this.http.get(`${environment.urlAdministration}/Bank`, { headers: this.trackingService.getHeaders() });
  }

  addBanks(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Bank`, data, { headers: this.trackingService.getHeaders() });
  }

  updateBanks(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/Bank/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteBanks(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/Bank/${id}`, { headers: this.trackingService.getHeaders() });
  }

}
