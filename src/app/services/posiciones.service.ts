import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class PosicionesService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);


    getPositionsByRole(company: number, role: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/PosicionDelison/posiciones/${company}/${role}`, { headers: this.trackingService.getHeaders() });
    }

    getPositionsByCompany(company: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/PosicionDelison/posiciones/company/${company}`, { headers: this.trackingService.getHeaders() });
    }


    addPosition(data: any): Observable<any> {
      return this.http.post(`${environment.urlSecurity}/PosicionDelison/posiciones/`, data, { headers: this.trackingService.getHeaders() });
    }


    updatePosition(id: string, data: any): Observable<any> {
      return this.http.put(`${environment.urlSecurity}/PosicionDelison/posiciones/${id}`, data, { headers: this.trackingService.getHeaders() });
    }


    deletePosition(id: number): Observable<any> {
      return this.http.delete(`${environment.urlSecurity}/PosicionDelison/posiciones/${id}`, { headers: this.trackingService.getHeaders() });
    }

}
