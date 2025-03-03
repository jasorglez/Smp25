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


}
