import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface CorteResumen {
  paymentType: string;
  numVentas: number;
  total: number;
}

export interface MovimientoCaja {
  id?: number;
  idCashRegister: number;
  tipo: 'APERTURA' | 'RETIRO' | 'DEPOSITO';
  monto: number;
  fecha?: string;
  descripcion?: string;
  cajero?: string;
  active?: boolean;
}

export interface CorteDeCaja {
  id?: number;
  idCashRegister: number;
  idStore: number;
  fechaApertura: string;
  fechaCorte?: string;
  apertura: number;
  totalEfectivo: number;
  totalCheque: number;
  totalVales: number;
  totalTarjeta: number;
  totalRetiros: number;
  totalVentas: number;
  saldoFinal: number;
  numVentas: number;
  cajero?: string;
  observaciones?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CashClosingService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getResumen(idCashRegister: number, since: string): Observable<CorteResumen[]> {
    return this.http.get<CorteResumen[]>(
      `${environment.urlAdministration}/CorteDeCaja/resumen/${idCashRegister}?since=${encodeURIComponent(since)}`,
      { headers: this.headers }
    );
  }

  getMovimientos(idCashRegister: number): Observable<MovimientoCaja[]> {
    return this.http.get<MovimientoCaja[]>(
      `${environment.urlAdministration}/CorteDeCaja/movimientos/${idCashRegister}`,
      { headers: this.headers }
    );
  }

  saveMovimiento(data: MovimientoCaja): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(
      `${environment.urlAdministration}/CorteDeCaja/movimiento`,
      data,
      { headers: this.headers }
    );
  }

  saveCorte(data: CorteDeCaja): Observable<CorteDeCaja> {
    return this.http.post<CorteDeCaja>(
      `${environment.urlAdministration}/CorteDeCaja`,
      data,
      { headers: this.headers }
    );
  }

  getHistorial(idCashRegister: number): Observable<CorteDeCaja[]> {
    return this.http.get<CorteDeCaja[]>(
      `${environment.urlAdministration}/CorteDeCaja/historial/${idCashRegister}`,
      { headers: this.headers }
    );
  }
}
