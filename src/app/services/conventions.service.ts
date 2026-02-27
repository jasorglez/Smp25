import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { Observable, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConventionsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);


  getConventions() {
    return this.http.get(`${environment.urlSmp}/Convention`, { headers: this.trackingService.getHeaders() });
  }

  getConventionsByContractOrProject(type: string, id: number) {
    return this.http.get(`${environment.urlSmp}/Convention/${id}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  addConvention(data: any) {
    return this.http.post(`${environment.urlSmp}/Convention`, data, { headers: this.trackingService.getHeaders() });
  }

  updateConvention(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Convention/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteConvention(id: number) {
    return this.http.delete(`${environment.urlSmp}/Convention/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getConventionDetails(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/ConventionDetails?conventionId=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getConvention2fields(idContract: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/Convention/2fields/idContract?idContract=${idContract}`, { headers: this.trackingService.getHeaders() });
  }

  addConventionDetails(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/ConventionDetails`, data, { headers: this.trackingService.getHeaders() });
  }

  updateConventionDetails(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/ConventionDetails/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteConventionDetails(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/ConventionDetails/${id}`, { headers: this.trackingService.getHeaders() });
  }

  /** Retorna el convenio vigente de un contrato desde el endpoint dedicado, o null si no hay ninguno. */
  getVigenteConvention(idContract: number): Observable<{ id: number; name: string } | null> {
    return this.http.get<{ id: number; name: string }>(
      `${environment.urlSmp}/Convention/vigente/${idContract}`,
      { headers: this.trackingService.getHeaders() }
    ).pipe(
      catchError(() => of(null))
    );
  }
}
