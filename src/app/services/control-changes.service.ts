import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class ControlChangesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getControlChanges(id: number, date: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Changescontrol?idProject=${id}&date=${date}`, { headers: this.trackingService.getHeaders() });
  }

  addControlChange(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Changescontrol`, data, { headers: this.trackingService.getHeaders() });
  }

  updateControlChange(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Changescontrol/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteControlChange(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Changescontrol/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
