import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class SubDetailedPermissionsService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);

  getSubDetailedPermissions(idMasterPermission: number, idDetailedPermission: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/SubDetailedPermissions?idMasterPermission=${idMasterPermission}&idDetailedPermission=${idDetailedPermission}`, { headers: this.trackingService.getHeaders() });
  } 

  updateSubDetailedPermissions(id: number, permissions: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/SubDetailedPermissions/${id}`, permissions, { headers: this.trackingService.getHeaders() });
  }

  addSubDetailedPermissions(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/SubDetailedPermissions/`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteSubDetailedPermissions(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSecurity}/SubDetailedPermissions/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
