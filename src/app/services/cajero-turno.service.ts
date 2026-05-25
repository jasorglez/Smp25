import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CajeroTurnoService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  createTurno(data: {
    idCompany: number;
    idCashRegister: number;
    idBranch: number;
    cajero?: string;
    fondoInicial: number;
  }): Observable<any> {
    return this.http.post(
      `${environment.urlAdministration}/CajeroTurno`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getTurno(id: number): Observable<any> {
    return this.http.get(
      `${environment.urlAdministration}/CajeroTurno/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  cerrarTurno(id: number, efectivoContado: number, notas?: string): Observable<any> {
    return this.http.put(
      `${environment.urlAdministration}/CajeroTurno/${id}/cerrar`,
      { efectivoContado, notas },
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByCompany(idCompany: number, dateFrom?: string, dateTo?: string): Observable<any[]> {
    let params = `idCompany=${idCompany}`;
    if (dateFrom) params += `&dateFrom=${encodeURIComponent(dateFrom)}`;
    if (dateTo) params += `&dateTo=${encodeURIComponent(dateTo)}`;
    return this.http.get<any[]>(
      `${environment.urlAdministration}/CajeroTurno/byCompany?${params}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
