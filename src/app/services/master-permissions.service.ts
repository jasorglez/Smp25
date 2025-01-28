import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class MasterPermissionsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getMasterPermissionByUser(idUser: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSecurity}/MasterPermissions/${idUser}`, { headers: this.trackingService.getHeaders() });
  }

  addMasterPermission(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSecurity}/MasterPermissions`, data, { headers: this.trackingService.getHeaders() });
  }

  updateMasterPermission(idUser: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlSecurity}/MasterPermissions/${idUser}`, data, { headers: this.trackingService.getHeaders() });
  }
}
