import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersxpermissionsService {
  constructor(private http: HttpClient) { }

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  private getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getDataUsersxPermissions(type: string) {
    return this.http.get(`${environment.urlLinux}/Usersxpermission?type=${type}`, { headers: this.getHeaders() });
  }

  addUserxPermission(data: any): Observable<any> {
    return this.http.post(`${environment.urlLinux}/Usersxpermission`, data, { headers: this.getHeaders() });
  }

  updateUserxPermission(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlLinux}/Usersxpermission/${id}`, data, { headers: this.getHeaders() });
  }

  deleteUserxPermission(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlLinux}/Usersxpermission/${id}`, data, { headers: this.getHeaders() });
  }
}