import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, from } from 'rxjs';

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
    const headers = this.getHeaders();
    return this.http.get(`${environment.urlLinux}/Usersxpermission?type=${type}`, { headers });
  }

  addUserxPermission(data: any): Observable<any> {
    const headers = this.getHeaders();
    return this.http.post(`${environment.urlLinux}/Usersxpermission`, data, { headers });
  }

  updateUserxPermission(id: string, data: any): Observable<any> {
    const headers = this.getHeaders();
    return this.http.put(`${environment.urlLinux}/Usersxpermission/${id}`, data, { headers });
  }

  deleteUserxPermission(id: number, data: any): Observable<any> {
    const headers = this.getHeaders();
    return this.http.put(`${environment.urlLinux}/Usersxpermission/${id}`, data, { headers });
  }
}