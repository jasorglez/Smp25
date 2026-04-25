import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { catchError, Observable, throwError } from 'rxjs';

import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root',
})
export class RemisionesService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private shouldFallback(error: any): boolean {
    const status = Number(error?.status ?? 0);
    return status === 404 || status === 405;
  }

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

  updateDetalle(idRemisionDetalle: number, data: any): Observable<any> {
    const payload = {
      ...(data || {}),
      idRemisionDetalle,
      IdRemisionDetalle: idRemisionDetalle,
    };
    const baseUrl = `${environment.urlAdministration}/Remisiones`;
    const headers = this.trackingService.getHeaders();

    return this.http.put<any>(`${baseUrl}/detalle/${idRemisionDetalle}`, payload, { headers }).pipe(
      catchError((e1) => {
        if (!this.shouldFallback(e1)) return throwError(() => e1);
        return this.http.put<any>(`${baseUrl}/detalle`, payload, { headers }).pipe(
          catchError((e2) => {
            if (!this.shouldFallback(e2)) return throwError(() => e2);
            return this.http.post<any>(`${baseUrl}/detalle/update`, payload, { headers }).pipe(
              catchError((e3) => {
                if (!this.shouldFallback(e3)) return throwError(() => e3);
                return this.http.post<any>(`${baseUrl}/detalle/actualizar`, payload, { headers });
              })
            );
          })
        );
      })
    );
  }

  deleteDetalle(idRemisionDetalle: number, data?: any): Observable<any> {
    const payload = {
      ...(data || {}),
      idRemisionDetalle,
      IdRemisionDetalle: idRemisionDetalle,
    };
    const baseUrl = `${environment.urlAdministration}/Remisiones`;
    const headers = this.trackingService.getHeaders();

    return this.http.request<any>('DELETE', `${baseUrl}/detalle/${idRemisionDetalle}`, { headers, body: payload }).pipe(
      catchError((e1) => {
        if (!this.shouldFallback(e1)) return throwError(() => e1);
        return this.http.request<any>('DELETE', `${baseUrl}/detalle?idRemisionDetalle=${idRemisionDetalle}`, { headers, body: payload }).pipe(
          catchError((e2) => {
            if (!this.shouldFallback(e2)) return throwError(() => e2);
            return this.http.post<any>(`${baseUrl}/detalle/delete`, payload, { headers }).pipe(
              catchError((e3) => {
                if (!this.shouldFallback(e3)) return throwError(() => e3);
                return this.http.post<any>(`${baseUrl}/detalle/eliminar`, payload, { headers }).pipe(
                  catchError((e4) => {
                    if (!this.shouldFallback(e4)) return throwError(() => e4);
                    return this.http.post<any>(`${baseUrl}/detalle/remove`, payload, { headers });
                  })
                );
              })
            );
          })
        );
      })
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
