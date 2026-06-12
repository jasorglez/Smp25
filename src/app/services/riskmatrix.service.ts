import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class RiskmatrixService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Riesgos de identificación

  getIdentificationRisks(id: number, fecha: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Identificationrisk/${id}?date=${fecha}`, { headers: this.trackingService.getHeaders() });
  }

  addIdentificationRisk(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Identificationrisk`, data, { headers: this.trackingService.getHeaders() });
  }

  updateIdentificationRisk(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Identificationrisk/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteIdentificationRisk(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Identificationrisk/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // RIesgos de analisis

  getAnalysisRisks(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Analysisrisk?idIdent=${id}`, { headers: this.trackingService.getHeaders() });
  }

  addAnalysisRisk(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Analysisrisk`, data, { headers: this.trackingService.getHeaders() });
  }

  updateAnalysisRisk(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Analysisrisk/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteAnalysisRisk(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Analysisrisk/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Planificacion de riesgos
  getPlanificationRisks(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Planificationrisk?idAnalisis=${id}`, { headers: this.trackingService.getHeaders() });
  }

  addPlanificationRisk(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Planificationrisk`, data, { headers: this.trackingService.getHeaders() });
  }

  updatePlanificationRisk(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Planificationrisk/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deletePlanificationRisk(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Planificationrisk/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Implementación de riesgos
  getImplementationRisks(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Implementationrisk?idPlanification=${id}`, { headers: this.trackingService.getHeaders() });
  }

  addImplementationRisk(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Implementationrisk`, data, { headers: this.trackingService.getHeaders() });
  }

  updateImplementationRisk(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Implementationrisk/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteImplementationRisk(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Implementationrisk/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
