import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WorkprogramsService {

  constructor(private http: HttpClient) { }

  private trackingService = inject(TrackingService);

  getWorkPrograms(id: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/${id}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  getWorkPrograms2Fields(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/Workprogram/2fields?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }

  addWorkProgram(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Workprogram`, data, { headers: this.trackingService.getHeaders() });
  }

  updateWorkProgram(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Workprogram/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteWorkProgram(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Workprogram/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
