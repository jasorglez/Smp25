import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface EntregaOc {
  id?: number;
  idDetailsreqoc: number;
  fechaEntrega?: string | null;
  cantidadRecibir?: number | null;
  notaFactura?: string | null;
  totalEntrega?: number | null;
  fechaEntradaAlmacen?: string | null;
  close?: boolean;
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class EntregaOcService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByDetail(idDetailsreqoc: number): Observable<EntregaOc[]> {
    return this.http.get<EntregaOc[]>(
      `${environment.urlWarehouse}/EntregaOc/byDetail/${idDetailsreqoc}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<EntregaOc> {
    return this.http.get<EntregaOc>(
      `${environment.urlWarehouse}/EntregaOc/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(data: EntregaOc): Observable<EntregaOc> {
    return this.http.post<EntregaOc>(
      `${environment.urlWarehouse}/EntregaOc`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: EntregaOc): Observable<EntregaOc> {
    return this.http.put<EntregaOc>(
      `${environment.urlWarehouse}/EntregaOc/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/EntregaOc/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
