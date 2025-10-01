import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { catchError, Observable, throwError } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class DatosXFechasService {

  constructor() { }

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);

 

  // Obtener reportes diarios por OT
  getDailyReports(idCompany: number, startDate?: Date, endDate?: Date): Observable<any> {
    let url = `${environment.urlSmp}/DatosXFechas/DailyReports/${idCompany}`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    return this.http.get(url, { headers: this.trackingService.getHeaders() });
  }

  getOTs(idCompany: number, startDate?: Date, endDate?: Date): Observable<any> {
    console.log('getOTs called with:', { idCompany, startDate, endDate });
    let url = `${environment.urlSmp}/DatosXFechas/OTs/${idCompany}`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    return this.http.get(url, { headers: this.trackingService.getHeaders() });
  }

}