import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root',
})
export class RemisionesService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getResumenByCompany(idCompany: number, estado?: string): Observable<any> {
    const estadoParam = estado ? `&estado=${encodeURIComponent(estado)}` : '';
    return this.http.get<any>(
      `${environment.urlAdministration}/Remisiones/resumen?idCompany=${idCompany}${estadoParam}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByCliente(idCompany: number, idCliente: number, estado?: string): Observable<any> {
    const estadoParam = estado ? `&estado=${encodeURIComponent(estado)}` : '';
    return this.http.get<any>(
      `${environment.urlAdministration}/Remisiones/cliente?idCompany=${idCompany}&idCliente=${idCliente}${estadoParam}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getDetalle(idRemision: number): Observable<any> {
    return this.http.get<any>(
      `${environment.urlAdministration}/Remisiones/${idRemision}/detalle`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  createOrReuseOpen(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlAdministration}/Remisiones/open`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  addDetalle(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlAdministration}/Remisiones/detalle`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  closeRemision(idRemision: number, data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlAdministration}/Remisiones/${idRemision}/close`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
