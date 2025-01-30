import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MasterPermissions2Service {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  
  // Obtener todos los permisos maestros
  getMasterPermissions(): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/master`, {headers: this.trackingService.getHeaders()} );
  }

  // Obtener permisos detallados por masterId
  getDetailedPermissions(masterId: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/detailed/${masterId}`, {headers: this.trackingService.getHeaders()} );
  }

  // Obtener permisos de un usuario específico
  getUserPermissions(userId: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/user/${userId}`, {headers: this.trackingService.getHeaders()} );
  }

  // Actualizar permisos de un usuario
  updateUserPermissions(userId: number, permissionIds: number[]): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/UserSystemPermissions/user/${userId}`, permissionIds, {headers: this.trackingService.getHeaders()} );
  }
}
