import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReturnsService {

  private http           = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  /** Buscar ticket original por número (ej. CAJA001-0001) */
  getSaleByTicketNumber(numberNote: string, idCompany: number): Observable<any> {
    return this.http.get(
      `${environment.urlAdministration}/Returns/ticket/${encodeURIComponent(numberNote)}?idCompany=${idCompany}`,
      { headers: this.headers }
    );
  }

  /** Obtener devoluciones de una venta */
  getReturnsBySale(idSale: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlAdministration}/Returns/bySale/${idSale}`,
      { headers: this.headers }
    );
  }

  /** Obtener devoluciones de una empresa en un rango */
  getByCompany(idCompany: number, dateFrom: string, dateTo: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlAdministration}/Returns/byCompany?idCompany=${idCompany}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      { headers: this.headers }
    );
  }

  /** Crear una devolución */
  createReturn(data: {
    idCompany: number;
    idSale: number;
    idCashRegister?: number;
    returnType: 'total' | 'parcial' | 'cambio' | 'reimpresion';
    reason?: string;
    amount: number;
    approvedBy?: string;
    numberNote?: string;
    concepts?: Array<{
      idConcept: number;
      quantity: number;
      pu: number;
      total: number;
      description?: string;
    }>;
  }): Observable<{ id: number; numberNote: string }> {
    return this.http.post<{ id: number; numberNote: string }>(
      `${environment.urlAdministration}/Returns`,
      data,
      { headers: this.headers }
    );
  }
}
