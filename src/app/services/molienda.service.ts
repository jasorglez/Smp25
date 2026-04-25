import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface Molienda {
  id?: number;
  idCompany: number;
  idSucursal?: number | null;
  idMaterial?: number | null;
  entradas?: number;
  salidas?: number;
  totalInventarios?: number | null;
  ajustesInventarios?: number | null;
  comentarios?: string | null;
  dateModified?: string;
  active?: boolean;
}

export interface DetailsMolienda {
  id?: number;
  idMolienda: number;
  type: 'ENTRADA' | 'SALIDA';
  fecha?: string | null;
  cantidad: number;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MoliendaService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // ── Molienda maestro ─────────────────────────────────────────────

  getAll(idCompany: number): Observable<Molienda[]> {
    return this.http.get<Molienda[]>(
      `${environment.urlWarehouse}/Molienda/byCompany/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<Molienda> {
    return this.http.get<Molienda>(
      `${environment.urlWarehouse}/Molienda/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(molienda: Molienda): Observable<Molienda> {
    return this.http.post<Molienda>(
      `${environment.urlWarehouse}/Molienda`,
      molienda,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, molienda: Molienda): Observable<Molienda> {
    return this.http.put<Molienda>(
      `${environment.urlWarehouse}/Molienda/${id}`,
      molienda,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/Molienda/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // ── Detalles (entradas / salidas) ────────────────────────────────

  getDetails(idMolienda: number, type: 'ENTRADA' | 'SALIDA'): Observable<DetailsMolienda[]> {
    return this.http.get<DetailsMolienda[]>(
      `${environment.urlWarehouse}/DetailsMolienda/byMolienda/${idMolienda}?type=${type}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getDetailById(id: number): Observable<DetailsMolienda> {
    return this.http.get<DetailsMolienda>(
      `${environment.urlWarehouse}/DetailsMolienda/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  createDetail(detail: DetailsMolienda): Observable<DetailsMolienda> {
    return this.http.post<DetailsMolienda>(
      `${environment.urlWarehouse}/DetailsMolienda`,
      detail,
      { headers: this.trackingService.getHeaders() }
    );
  }

  updateDetail(id: number, detail: DetailsMolienda): Observable<DetailsMolienda> {
    return this.http.put<DetailsMolienda>(
      `${environment.urlWarehouse}/DetailsMolienda/${id}`,
      detail,
      { headers: this.trackingService.getHeaders() }
    );
  }

  deleteDetail(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/DetailsMolienda/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
