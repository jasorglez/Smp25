import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface UnidadMedida {
  id?: number;
  idCompany: number;
  abreviatura: string;
  nombre: string;
  active: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class UnidadMedidaService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByCompany(idCompany: number): Observable<UnidadMedida[]> {
    return this.http.get<UnidadMedida[]>(
      `${environment.urlWarehouse}/UnidadMedida/${idCompany}`, { headers: this.headers });
  }

  create(data: UnidadMedida): Observable<UnidadMedida> {
    return this.http.post<UnidadMedida>(
      `${environment.urlWarehouse}/UnidadMedida`, data, { headers: this.headers });
  }

  update(id: number, data: UnidadMedida): Observable<UnidadMedida> {
    return this.http.put<UnidadMedida>(
      `${environment.urlWarehouse}/UnidadMedida/${id}`, data, { headers: this.headers });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/UnidadMedida/${id}`, { headers: this.headers });
  }
}
