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

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

 

  getDataUsersxPermissions(type: string) {
    return this.http.get(`${environment.urlLinux}/Usersxpermission?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  addUserxPermission(data: any): Observable<any> {
    return this.http.post(`${environment.urlLinux}/Usersxpermission`, data, { headers: this.trackingService.getHeaders() });
  }

  updateUserxPermission(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlLinux}/Usersxpermission/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteUserxPermission(id: number): Observable<any> {
    return this.http.delete(`${environment.urlLinux}/Usersxpermission/${id}`, { headers: this.trackingService.getHeaders() });
  }
}