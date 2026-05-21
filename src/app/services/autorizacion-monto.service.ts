import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class AutorizacionMontoService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByCompany(idCompany: number): Observable<AutorizacionMonto[]> {
    return this.http.get<AutorizacionMonto[]>(
      `${environment.urlWarehouse}/AutorizacionMonto/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}

export interface AutorizacionMonto {
  id?: number;
  idCompany: number;
  nivel: number;
  montoMin: number;
  montoMax: number | null;
  descripcion: string;
  active: boolean;
}
