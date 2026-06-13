import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Nivel 5 "Datos externos" del Almacén de Molienda: lotes por entrada.
export interface DatosExternosMolienda {
  id?: number;
  idEntrada: number;
  lote?: string | null;
  caducidadMeses?: number | null;
  cantidadXLote?: number | null;
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class DatosExternosMoliendaService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private apiUrl = `${environment.urlWarehouse}/DatosExternosMolienda`;

  getByEntrada(idEntrada: number): Observable<DatosExternosMolienda[]> {
    return this.http.get<DatosExternosMolienda[]>(
      `${this.apiUrl}/byEntrada/${idEntrada}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(payload: DatosExternosMolienda): Observable<DatosExternosMolienda> {
    return this.http.post<DatosExternosMolienda>(
      `${this.apiUrl}`,
      payload,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, payload: DatosExternosMolienda): Observable<any> {
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
