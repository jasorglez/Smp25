import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class TimeInactiveService {
  private http           = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByReporte(idReporte: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/Timeinactives/byReporte/${idReporte}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  add(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlSmp}/Timeinactives`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlSmp}/Timeinactives/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlSmp}/Timeinactives/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
