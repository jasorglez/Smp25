import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class RiskmatrixService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Riesgos de identificación

  getIdentificationRisks(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Identificationrisk/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addIdentificationRisk(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Identificationrisk`, data, { headers: this.trackingService.getHeaders() });
  }

  updateIdentificationRisk(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Identificationrisk/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteIdentificationRisk(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Identificationrisk/${id}`, { headers: this.trackingService.getHeaders() });
  }

}
