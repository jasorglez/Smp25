import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface CondicionPagoDto {
  id?: number;
  descripcion: string;
  cantidad: number;
  active: boolean;
  idCompany: number;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class CondicionesPagoService {
  private http           = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByCompany(idCompany: number): Observable<CondicionPagoDto[]> {
    return this.http.get<CondicionPagoDto[]>(
      `${environment.urlWarehouse}/CondicionPago/${idCompany}`,
      { headers: this.headers }
    );
  }

  create(data: CondicionPagoDto): Observable<CondicionPagoDto> {
    return this.http.post<CondicionPagoDto>(
      `${environment.urlWarehouse}/CondicionPago`,
      data,
      { headers: this.headers }
    );
  }

  update(id: number, data: CondicionPagoDto): Observable<CondicionPagoDto> {
    return this.http.put<CondicionPagoDto>(
      `${environment.urlWarehouse}/CondicionPago/${id}`,
      data,
      { headers: this.headers }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/CondicionPago/${id}`,
      { headers: this.headers }
    );
  }
}
