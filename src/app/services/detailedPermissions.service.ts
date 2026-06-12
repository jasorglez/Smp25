import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class DetailedPermissionsService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);

  getDetailedPermissions(id: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/DetailedPermissions/detail/${id}`, { headers: this.trackingService.getHeaders() });
  } 

  updateDetailedPermissions(id: number, permissions: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/DetailedPermissions/${id}`, permissions, { headers: this.trackingService.getHeaders() });
  }

  addDetailedPermissions(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/DetailedPermissions/create`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteDetailedPermissions(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSecurity}/DetailedPermissions/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
