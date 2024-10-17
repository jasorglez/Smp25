import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class TimeinactivesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getInactiveTimes(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Timeinactives/byProject/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addInactiveTime(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Timeinactives`, data, { headers: this.trackingService.getHeaders() });
  }

  updateInactiveTime(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Timeinactives/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteInactiveTime(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Timeinactives/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getArea(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=AREA`, { headers: this.trackingService.getHeaders() });
  }

  getCause(): Observable<any[]> {    
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=CAUSE`, { headers: this.trackingService.getHeaders() });
  }
}
