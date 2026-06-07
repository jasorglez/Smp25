import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface EmpaquePesoVolumen {
  id?: number;
  idEmpaque: number;
  medida: number | null;
  idUnidad: number | null;
  active?: boolean;
}

export interface EmpaquePesoVolumenItem {
  medida: number | null;
  idUnidad: number | null;
}

@Injectable({ providedIn: 'root' })
export class EmpaquePesoVolumenService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByEmpaque(idEmpaque: number): Observable<EmpaquePesoVolumen[]> {
    return this.http.get<EmpaquePesoVolumen[]>(
      `${environment.urlWarehouse}/EmpaquePesoVolumen/byEmpaque/${idEmpaque}`,
      { headers: this.headers });
  }

  /** Reemplaza por completo el peso/volumen de la presentación (0 o 1 fila). */
  saveByEmpaque(idEmpaque: number, items: EmpaquePesoVolumenItem[]): Observable<EmpaquePesoVolumen[]> {
    return this.http.post<EmpaquePesoVolumen[]>(
      `${environment.urlWarehouse}/EmpaquePesoVolumen/save-by-empaque`,
      { idEmpaque, items },
      { headers: this.headers });
  }
}
