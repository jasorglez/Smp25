import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class IntandoutDocumentsService {
  private apiUrl = environment.urlWarehouse;
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  constructor() { }

  getIntandoutDocuments(contractId: number, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/IntandoutDocuments/${contractId}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  getIntandoutDocumentsById(projectId: number, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/IntandoutDocuments?idDoc=${projectId}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  addIntandoutDocuments(data: any): Observable<any> {
    console.log(data);
    return this.http.post(`${this.apiUrl}/IntandoutDocuments`, data, { headers: this.trackingService.getHeaders() });
  }

  updateIntandoutDocuments(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/IntandoutDocuments/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteIntandoutDocuments(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/IntandoutDocuments/${id}`, { headers: this.trackingService.getHeaders() });
  } 
}
