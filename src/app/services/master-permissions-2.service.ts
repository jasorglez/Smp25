import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MasterPermissions2Service {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  
  // Obtener todos los permisos maestros
  getMasterPermissions(idEmpresa: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/master/${idEmpresa}`, {headers: this.trackingService.getHeaders()} );
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

  getCompanyUserPermissions(companyId: number, userId: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/company/${companyId}/user/${userId}`, { headers: this.trackingService.getHeaders() });
  }

  updateCompanyUserPermissions(companyId: number, userId: number, permissionIds: number[]): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/UserSystemPermissions/company/${companyId}/user/${userId}`, permissionIds, { headers: this.trackingService.getHeaders() });
  }

  getCompanyMasterPermissions(companyId: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlSecurity}/UserSystemPermissions/master/${companyId}`, { headers: this.trackingService.getHeaders() }).pipe(
      map(masters => (masters || [])
        .filter(master => master.active === true)
        .map(master => {
          const seen = new Set<string>();
          const detailedPermissions = [...(master.detailedPermissions || [])]
            .filter((detail: any) => detail.active === true)
            .sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0) || Number(a.id) - Number(b.id))
            .filter((detail: any) => {
              const identifier = String(detail.identifier ?? detail.id);
              if (seen.has(identifier)) return false;
              seen.add(identifier);
              return true;
            });
          return { ...master, detailedPermissions };
        }))
    );
  }
}
