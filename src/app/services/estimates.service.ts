import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class EstimatesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getEstimates(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Estimates?idContract=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getEstimateById(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/Estimates/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addEstimate(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Estimates`, data, { headers: this.trackingService.getHeaders() });
  }

  updateEstimate(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Estimates/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteEstimate(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Estimates/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getItemsFromEstimate(idEstimate: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/ItemsGeneradoresEstimates?idType=${idEstimate}&Type=ESTIMACION`, { headers: this.trackingService.getHeaders() });
  }

  getSubcontractEstimates(idRoot: number, idProvider: number, idProgram: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Estimates/subcontract`, {
      params: { idRoot, idProvider, idProgram },
      headers: this.trackingService.getHeaders()
    });
  }

  getSubcontractEstimate(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/Estimates/subcontract/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getSubcontractProgress(idRoot: number, idProvider: number, idProgram: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Estimates/subcontract-progress`, {
      params: { idRoot, idProvider, idProgram },
      headers: this.trackingService.getHeaders()
    });
  }

  saveSubcontractEstimate(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSmp}/Estimates/subcontract`, data, { headers: this.trackingService.getHeaders() });
  }
}
