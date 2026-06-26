import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class WorkprogramApuFactorService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  /** GET /WorkprogramApuFactor?idContract=X&idCompany=Y */
  getByContract(idContract: number, idCompany?: number): Observable<any[]> {
    let url = `${environment.urlSmp}/WorkprogramApuFactor?idContract=${idContract}`;
    if (idCompany) url += `&idCompany=${idCompany}`;
    return this.http.get<any[]>(url, { headers: this.trackingService.getHeaders() });
  }

  add(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlSmp}/WorkprogramApuFactor`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlSmp}/WorkprogramApuFactor/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlSmp}/WorkprogramApuFactor/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /** POST /WorkprogramApuFactor/bulk?idContract=X&idCompany=Y */
  bulkSave(idContract: number, idCompany: number, factors: any[]): Observable<any[]> {
    return this.http.post<any[]>(
      `${environment.urlSmp}/WorkprogramApuFactor/bulk?idContract=${idContract}&idCompany=${idCompany}`,
      factors,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
