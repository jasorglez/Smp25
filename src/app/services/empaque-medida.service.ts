import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface EmpaqueMedida {
  id?: number;
  idEmpaque: number;
  medida: number | null;
  idUnidad: number | null;
  idDimension: number | null;
  active?: boolean;
}

export interface EmpaqueMedidaItem {
  medida: number | null;
  idUnidad: number | null;
  idDimension: number | null;
}

@Injectable({ providedIn: 'root' })
export class EmpaqueMedidaService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByEmpaque(idEmpaque: number): Observable<EmpaqueMedida[]> {
    return this.http.get<EmpaqueMedida[]>(
      `${environment.urlWarehouse}/EmpaqueMedida/byEmpaque/${idEmpaque}`,
      { headers: this.headers });
  }

  /** Reemplaza por completo las medidas de la presentación (la fila vacía final no se envía). */
  saveByEmpaque(idEmpaque: number, items: EmpaqueMedidaItem[]): Observable<EmpaqueMedida[]> {
    return this.http.post<EmpaqueMedida[]>(
      `${environment.urlWarehouse}/EmpaqueMedida/save-by-empaque`,
      { idEmpaque, items },
      { headers: this.headers });
  }
}
