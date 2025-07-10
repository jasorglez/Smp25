import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class RolesService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);


    getRoles(idCompany: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/Roles?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
    }


    getRolesById(id: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/Roles/${id}`, { headers: this.trackingService.getHeaders() });
    }


    addRoles(data: any): Observable<any> {
      return this.http.post(`${environment.urlSecurity}/Roles`, data, { headers: this.trackingService.getHeaders() });
    }


    updateRoles(id: string, data: any): Observable<any> {
      console.log('DATA EN EL UPDATE', data)
      return this.http.put(`${environment.urlSecurity}/Roles/${id}`, data, { headers: this.trackingService.getHeaders() });
    }


    deleteRoles(id: number): Observable<any> {
      return this.http.delete(`${environment.urlSecurity}/Roles/${id}`, { headers: this.trackingService.getHeaders() });
    }

    getPermissionsByRoles(idRole: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/RolesxDetailedPermissionsSummary?idRole=${idRole}`, { headers: this.trackingService.getHeaders() });
    }

    getIndividualDetailedPermissionxRol(idRole: number, idDetailedPermission: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/RolesxDetailedPermission?idRole=${idRole}&idDetailedPermission=${idDetailedPermission}`, { headers: this.trackingService.getHeaders() });
    }

    addDetailedPermissionsxRoles(data: any): Observable<any> {
      return this.http.post(`${environment.urlSecurity}/RolesxDetailedPermission`, data, { headers: this.trackingService.getHeaders() });
    }

    updateDetailedPermissionsxRoles(idRole: number, idDetailedPermission: number, data: any): Observable<any> {
      return this.http.put(`${environment.urlSecurity}/RolesxDetailedPermission?idRole=${idRole}&idDetailedPermission=${idDetailedPermission}`, data, { headers: this.trackingService.getHeaders() });
    }


}
