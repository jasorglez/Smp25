import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class DistributionService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByReference(type: string, idReference: number, idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/Distribution/${type}/${idReference}/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  save(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSmp}/Distribution`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlSmp}/Distribution/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlSmp}/Distribution/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
