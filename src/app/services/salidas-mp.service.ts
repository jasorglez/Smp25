import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Un lote disponible para consumir (modal FEFO de Molienda).
export interface LoteDisponible {
  idDatoExterno: number;
  idEntrada: number;
  lote: string;
  folioEntrada: string;
  cantidadDisponible: number;
  fechaEntrada?: string | null;
  caducidadMeses?: number | null;
  caducidadRestanteMeses?: number | null;
  fechaCaducidad?: string | null;
  proveedor: string;
}

// Resumen de salida para el Nivel 2 "Salidas" del Almacén Molienda.
export interface SalidaResumen {
  folioEntrada: string;
  lote: string;
  fecha?: string | null;
  cantidad: number;
  usuario?: string | null;
}

// Una salida (consumo) de materia prima por lote.
export interface SalidaMp {
  id?: number;
  idDatoExterno: number;
  idMaterial: number;
  cantidad: number;
  fecha?: string | null;
  usuario?: string | null;
  idOrigen?: number | null;
  tipoOrigen?: string | null;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SalidasMpService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private apiUrl = `${environment.urlWarehouse}/SalidasMp`;

  // Lotes disponibles (FEFO) de un material en sucursal+departamento.
  getDisponibles(idMaterial: number, idDepartamento: number, idSucursal: number): Observable<LoteDisponible[]> {
    return this.http.get<LoteDisponible[]>(
      `${this.apiUrl}/disponibles/${idMaterial}/${idDepartamento}/${idSucursal}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getResumen(idMaterial: number, idSucursal: number): Observable<SalidaResumen[]> {
    return this.http.get<SalidaResumen[]>(
      `${this.apiUrl}/resumen/${idMaterial}/${idSucursal}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByOrigen(tipoOrigen: string, idOrigen: number): Observable<SalidaMp[]> {
    return this.http.get<SalidaMp[]>(
      `${this.apiUrl}/byOrigen/${tipoOrigen}/${idOrigen}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(payload: SalidaMp): Observable<SalidaMp> {
    return this.http.post<SalidaMp>(`${this.apiUrl}`, payload, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, payload: SalidaMp): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, payload, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
