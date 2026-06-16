import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Revisión de características por entrada (almacén molienda).
export interface RevisionCaracteristicaEntrada {
  id?: number;
  idEntrada: number;
  idCaracteristica: number;
  reviso?: boolean;
  comentarios?: string | null;
  idTrabajador?: number | null;
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class RevisionCaracteristicasEntradaService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private apiUrl = `${environment.urlWarehouse}/RevisionCaracteristicasEntrada`;

  getByEntrada(idEntrada: number): Observable<RevisionCaracteristicaEntrada[]> {
    return this.http.get<RevisionCaracteristicaEntrada[]>(
      `${this.apiUrl}/byEntrada/${idEntrada}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(payload: RevisionCaracteristicaEntrada): Observable<RevisionCaracteristicaEntrada> {
    return this.http.post<RevisionCaracteristicaEntrada>(
      `${this.apiUrl}`,
      payload,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, payload: RevisionCaracteristicaEntrada): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/${id}`,
      payload,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
