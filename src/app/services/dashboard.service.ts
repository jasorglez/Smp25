import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getContractsByClassification() {
    return this.http.get<any[]>(`${environment.urlSmp}/Contract/state?idBussines=1`, { headers: this.trackingService.getHeaders() });
  }

  getOilfieldsByState() {
    return this.http.get<any[]>(`${environment.urlSmp}/Contract/Countxstate`, { headers: this.trackingService.getHeaders() });
  }

  getTotalContracts() {
    return this.http.get<any[]>(`${environment.urlSmp}/Contract/totales?idBussines=1`, { headers: this.trackingService.getHeaders() });
  }

  getContractsBySpeciality() {
    return this.http.get<any[]>(`${environment.urlSmp}/Contract/totalesxspeciality?idBussines=1`, { headers: this.trackingService.getHeaders() });
  }

  getTotalInactivesByCause() {
    return this.http.get<any[]>(`${environment.urlSmp}/Timeinactives/totalxcause`, { headers: this.trackingService.getHeaders() });
  }

  getTotalSeverity() {
    return this.http.get<any[]>(`${environment.urlSmp}/Analysis/totalxseverity`, { headers: this.trackingService.getHeaders() });
  }
}
