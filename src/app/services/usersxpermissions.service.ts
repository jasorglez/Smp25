import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { TrackingService } from './tracking.service';

import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class UsersxpermissionsService {

  constructor(private http: HttpClient) { }

  private trackingService = inject(TrackingService);

  getDataUsersxPermissions(type: string): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/Usersxpermission?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  addUserxPermission(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/Usersxpermission`, data, { headers: this.trackingService.getHeaders() });
  }

  updateUserxPermission(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlSecurity}/Usersxpermission/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteUserxPermission(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlSecurity}/Usersxpermission/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getUserxPermissionByEmail(type: string, email: string): Observable<any> {
    return this.http.get<any[]>(`${environment.urlSecurity}/Usersxpermission/email?type=${type}&email=${email}`, { headers: this.trackingService.getHeaders() });
  }

  getUsersxPermissionsGeneral(type: string, idUser: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlSecurity}/Usersxpermission/idUser?type=${type}&idUser=${idUser}`, { headers: this.trackingService.getHeaders() });
  }

  setPrincipal(idUser: number, idPermission: number): Observable<any> {
    return this.http.put(
      `${environment.urlSecurity}/Usersxpermission/principal?idUser=${idUser}&idPermission=${idPermission}`,
      {},
      { headers: this.trackingService.getHeaders() }
    );
  }

  getDataUsersxPermissionsbranch(idCompany, idUser: number): Observable<any> {
     //const apiUrl = `${environment.urlSecurity}/Usersxpermission/available?idCompany=${idCompany}&idUser=${idUser}`;      
    // alert(apiUrl) 
    return this.http.get(`${environment.urlSecurity}/Usersxpermission/available?idCompany=${idCompany}&idUser=${idUser}`, { headers: this.trackingService.getHeaders() });
  }                                                  
  
}
