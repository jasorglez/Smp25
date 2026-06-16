import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class WorkprogramApuService {
  private http           = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByWorkprogram(idWorkprogram: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/WorkprogramApu?idWorkprogram=${idWorkprogram}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getAppliedTotal(idWorkprogram: number): Observable<number> {
    return this.http.get<number>(
      `${environment.urlSmp}/WorkprogramApu/applied-total?idWorkprogram=${idWorkprogram}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  add(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlSmp}/WorkprogramApu`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlSmp}/WorkprogramApu/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlSmp}/WorkprogramApu/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
