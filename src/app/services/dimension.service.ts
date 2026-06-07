import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface Dimension {
  id?: number;
  idCompany: number;
  nombre: string;
  active: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class DimensionService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByCompany(idCompany: number): Observable<Dimension[]> {
    return this.http.get<Dimension[]>(
      `${environment.urlWarehouse}/Dimension/${idCompany}`, { headers: this.headers });
  }

  create(data: Dimension): Observable<Dimension> {
    return this.http.post<Dimension>(
      `${environment.urlWarehouse}/Dimension`, data, { headers: this.headers });
  }

  update(id: number, data: Dimension): Observable<Dimension> {
    return this.http.put<Dimension>(
      `${environment.urlWarehouse}/Dimension/${id}`, data, { headers: this.headers });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/Dimension/${id}`, { headers: this.headers });
  }
}
