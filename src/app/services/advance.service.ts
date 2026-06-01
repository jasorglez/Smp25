import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdvanceService {
  private apiUrl = environment.urlSmp;
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getAdvancesByContract(contractId: number, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Advanced/${contractId}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  getAdvancesByProject(projectId: number, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Advanced/${projectId}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  getAdvancesByConvenio(projectId: number, type: string, idConvenio: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/Advanced/${projectId}/${type}/${idConvenio}`, { headers: this.trackingService.getHeaders() });
  }

  addAdvance(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Advanced`, data, { headers: this.trackingService.getHeaders() });
  }

  updateAdvance(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Advanced/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteAdvance(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Advanced/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
