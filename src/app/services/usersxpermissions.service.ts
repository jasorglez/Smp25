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

  getDataUsersxPermissions(type: string) {
    return this.http.get(`${environment.urlSecurity}/Usersxpermission?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  addUserxPermission(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/Usersxpermission`, data, { headers: this.trackingService.getHeaders() });
  }

  updateUserxPermission(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/Usersxpermission/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteUserxPermission(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSecurity}/Usersxpermission/${id}`, { headers: this.trackingService.getHeaders() });
  }


}