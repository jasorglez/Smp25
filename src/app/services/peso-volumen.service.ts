import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface PesoVolumen {
  id?: number;
  idCompany: number;
  abreviatura: string;
  nombre: string;
  tipo?: string | null;          // 'PESO' | 'VOLUMEN'
  factorBase?: number | null;    // cuánto vale en kg o L
  active: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class PesoVolumenService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByCompany(idCompany: number): Observable<PesoVolumen[]> {
    return this.http.get<PesoVolumen[]>(
      `${environment.urlWarehouse}/PesoVolumen/${idCompany}`, { headers: this.headers });
  }

  create(data: PesoVolumen): Observable<PesoVolumen> {
    return this.http.post<PesoVolumen>(
      `${environment.urlWarehouse}/PesoVolumen`, data, { headers: this.headers });
  }

  update(id: number, data: PesoVolumen): Observable<PesoVolumen> {
    return this.http.put<PesoVolumen>(
      `${environment.urlWarehouse}/PesoVolumen/${id}`, data, { headers: this.headers });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/PesoVolumen/${id}`, { headers: this.headers });
  }
}
