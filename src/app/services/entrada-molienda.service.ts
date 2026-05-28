import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface EntradaMolienda {
  id?: number;
  idOc: number;
  idEntrega?: number | null;
  idMaterial?: number | null;
  fechaRecepcion?: string | null;
  cantidadEntrada?: number | null;
  bultos?: number | null;
  revisionConfigu?: number | null;
  pago?: number | null;
  usuario?: string | null;
  comentario?: string | null;
  liberacion?: boolean;
  close?: boolean;
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class EntradaMoliendaService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByOc(idOc: number): Observable<EntradaMolienda[]> {
    return this.http.get<EntradaMolienda[]>(
      `${environment.urlWarehouse}/EntradaMolienda/byOc/${idOc}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByOcAndMaterial(idOc: number, idMaterial: number): Observable<EntradaMolienda[]> {
    return this.http.get<EntradaMolienda[]>(
      `${environment.urlWarehouse}/EntradaMolienda/byOcAndMaterial/${idOc}/${idMaterial}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByEntregaAndMaterial(idEntrega: number, idMaterial: number): Observable<EntradaMolienda[]> {
    return this.http.get<EntradaMolienda[]>(
      `${environment.urlWarehouse}/EntradaMolienda/byEntregaAndMaterial/${idEntrega}/${idMaterial}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<EntradaMolienda> {
    return this.http.get<EntradaMolienda>(
      `${environment.urlWarehouse}/EntradaMolienda/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(data: EntradaMolienda): Observable<EntradaMolienda> {
    return this.http.post<EntradaMolienda>(
      `${environment.urlWarehouse}/EntradaMolienda`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: EntradaMolienda): Observable<EntradaMolienda> {
    return this.http.put<EntradaMolienda>(
      `${environment.urlWarehouse}/EntradaMolienda/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/EntradaMolienda/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
