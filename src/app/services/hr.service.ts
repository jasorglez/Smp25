import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HRService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  addHRManagementData(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/HRManagement`, data, { headers: this.trackingService.getHeaders() });
  }

  getHRManagementData(idBranch: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/HRManagement/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  updateHRManagementData(idBranch: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/HRManagement/${idBranch}`, data, { headers: this.trackingService.getHeaders() });
  }
  
  addHRManagementByRootData(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/HRManagementByRoot`, data, { headers: this.trackingService.getHeaders() });
  }

  getHRManagementByRootData(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/HRManagementByRoot/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  updateHRManagementByRootData(idRoot: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/HRManagementByRoot/${idRoot}`, data, { headers: this.trackingService.getHeaders() });
  }

  getGlobalConfig(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/GlobalConfig/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  createGlobalConfig(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/GlobalConfig`, data, { headers: this.trackingService.getHeaders() });
  }

  updateGlobalConfig(idRoot: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/GlobalConfig/${idRoot}`, data, { headers: this.trackingService.getHeaders() });
  }

}
