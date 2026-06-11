import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Características definidas por material (hoja de Materia Prima).
export interface CaracteristicaMateriaPrima {
  id?: number;
  idMaterial: number;
  activo?: boolean;
  caracteristica?: string | null;
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class CaracteristicasMateriaPrimaService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private apiUrl = `${environment.urlWarehouse}/CaracteristicasMateriaPrima`;

  getByMaterial(idMaterial: number): Observable<CaracteristicaMateriaPrima[]> {
    return this.http.get<CaracteristicaMateriaPrima[]>(
      `${this.apiUrl}/byMaterial/${idMaterial}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(payload: CaracteristicaMateriaPrima): Observable<CaracteristicaMateriaPrima> {
    return this.http.post<CaracteristicaMateriaPrima>(
      `${this.apiUrl}`,
      payload,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, payload: CaracteristicaMateriaPrima): Observable<any> {
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
