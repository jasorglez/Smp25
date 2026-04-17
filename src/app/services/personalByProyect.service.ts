import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, EMPTY, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PersonalByProyectService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  getPersonalByProyect(idProyect: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/TDPersonalByProyects/${idProyect}`, { headers: this.trackingService.getHeaders() });
  }

  getCantidadPersonal(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/TDPersonalByProyects/personalByProyect`, { headers: this.trackingService.getHeaders() });
  }

  addPersonalByProyect(data: any) {
    return this.http.post(`${environment.urlSmp}/TDPersonalByProyects`, data, { headers: this.trackingService.getHeaders() });
  }

  updatePersonalByProyect(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/TDPersonalByProyects/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deletePersonalByProyect(id: number) {
    return this.http.delete(`${environment.urlSmp}/TDPersonalByProyects/${id}`, { headers: this.trackingService.getHeaders() });
  }

}



