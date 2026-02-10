import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class MasterPermissionsService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);

  getMasterPermissions(): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/MasterPermissions`, { headers: this.trackingService.getHeaders() });
  } 

  updateMasterPermissions(id: number, permissions: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/MasterPermissions/${id}`, permissions, { headers: this.trackingService.getHeaders() });
  }

  addMasterPermissions(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/MasterPermissions`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteMasterPermissions(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSecurity}/MasterPermissions/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
