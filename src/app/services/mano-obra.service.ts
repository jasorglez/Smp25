import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class ManoObraService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByCompany(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/ManoObra/company/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  add(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlSmp}/ManoObra`,
      data, { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlSmp}/ManoObra/${id}`,
      data, { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlSmp}/ManoObra/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
