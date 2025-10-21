import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class TdConceptsService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  // Get all TDConcepts
  getTDConcepts(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/api/TDConcepts`, { headers: this.trackingService.getHeaders() });
  }

  // Get TDConcept by ID
  getTDConceptById(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/api/TDConcepts/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Add new TDConcept
  addTDConcept(concept: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSmp}/api/TDConcepts`, concept, { headers: this.trackingService.getHeaders() });
  }

  // Update TDConcept
  updateTDConcept(id: number, concept: any): Observable<any> {
    return this.http.put<any>(`${environment.urlSmp}/api/TDConcepts/${id}`, concept, { headers: this.trackingService.getHeaders() });
  }

  // Delete TDConcept
  deleteTDConcept(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlSmp}/api/TDConcepts/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
