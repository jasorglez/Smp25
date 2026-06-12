import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

/** Moneda = registro del catálogo genérico `catalog` con type='CURRENCY'. */
export interface Moneda {
  id?: number;
  idCompany?: number;
  description: string;       // Nombre (ej. "Peso Mexicano")
  valueAddition?: string;    // Abreviatura (ej. "MXN")
  vigente?: boolean;         // Activo
  type?: string;             // 'CURRENCY'
  active?: number;           // 1 = no borrado
}

@Injectable({ providedIn: 'root' })
export class MonedaService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private get headers() { return this.trackingService.getHeaders(); }
  private base = `${environment.urlWarehouse}/Catalog`;

  /** Lista las monedas (incluye inactivas para el catálogo). */
  getMonedas(idCompany: number): Observable<any> {
    return this.http.get(
      `${this.base}/getCatalogs?idCompany=${idCompany}&type=CURRENCY&includeInactive=true`,
      { headers: this.headers });
  }

  create(m: Moneda): Observable<any> {
    const dto = {
      idCompany: m.idCompany,
      description: m.description,
      valueAddition: m.valueAddition ?? '',
      type: 'CURRENCY',
      vigente: m.vigente ?? true,
      active: 1
    };
    return this.http.post(`${this.base}`, dto, { headers: this.headers });
  }

  update(id: number, m: Moneda): Observable<any> {
    const body = {
      id,
      idCompany: m.idCompany,
      description: m.description,
      valueAddition: m.valueAddition ?? '',
      type: 'CURRENCY',
      vigente: m.vigente ?? true,
      active: m.active ?? 1
    };
    return this.http.put(`${this.base}/${id}`, body, { headers: this.headers });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`, { headers: this.headers });
  }
}
