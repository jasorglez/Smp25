import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface ExpenseReportCell {
  idBranch: number;
  branchName: string;
  idDepartament: number;
  departmentName: string;
  total: number;
  numTransacciones: number;
}

export interface ExpenseReport {
  lens: string;
  startDate: string;
  endDate: string;
  grandTotal: number;
  totalTransacciones: number;
  cells: ExpenseReportCell[];
}

export interface PendingPayment {
  idEntrada: number;
  idOc: number;
  folio: string;
  docType: string;            // 'OC' | 'CR'
  tipoOc: string | null;
  closeSource: string;        // 'ENTREGA' | 'SIN_LIMITE' | 'OC'
  idReference: number;
  branchName: string;
  idDepartament: number;
  departmentName: string;
  idMaterial: number | null;
  articulo: string;
  numArticulo: string | null;
  idDetail: number | null;
  idEntrega: number | null;
  proveedor: string | null;
  cantidad: number;
  precioUnitario: number;
  valorPago: number;
  masIva: boolean;
  notaFactura: string | null;
  fechaRecepcion: string | null;
  fechaPago: string | null;
}

export interface ConfirmPaymentPayload {
  idEntrada: number;
  idDetail?: number | null;
  idEntrega?: number | null;
  docType: string;
  closeSource: string;
  valorPago: number;
  fechaPago?: string | null;
  proveedor?: string | null;
  precioUnitario?: number | null;
  masIva: boolean;
  notaFactura?: string | null;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class GastosService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  /**
   * Reporte gerencial de gastos agregado por Sucursal × Departamento.
   * @param lens 'PAGADO' (cash out por fecha_recepcion) o 'COMPROMETIDO' (por datecreate de OC).
   * Fechas en formato yyyy-MM-dd.
   */
  getExpenseReport(idCompany: number, startDate: string, endDate: string, lens: 'PAGADO' | 'COMPROMETIDO' = 'PAGADO'): Observable<ExpenseReport> {
    const params = new HttpParams()
      .set('idCompany', idCompany)
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('lens', lens);

    return this.http.get<ExpenseReport>(`${environment.urlWarehouse}/Gastos/report`, {
      params,
      headers: this.trackingService.getHeaders()
    });
  }

  /** Captura de Gastos: entradas pendientes de pago (cerradas en molienda, sin liberar). */
  getPendingPayments(idCompany: number): Observable<PendingPayment[]> {
    const params = new HttpParams().set('idCompany', idCompany);
    return this.http.get<PendingPayment[]>(`${environment.urlWarehouse}/Gastos/pending`, {
      params,
      headers: this.trackingService.getHeaders()
    });
  }

  /** Histórico de Pagos: entradas ya pagadas/liberadas (liberacion=1). */
  getPaidPayments(idCompany: number): Observable<PendingPayment[]> {
    const params = new HttpParams().set('idCompany', idCompany);
    return this.http.get<PendingPayment[]>(`${environment.urlWarehouse}/Gastos/paid`, {
      params,
      headers: this.trackingService.getHeaders()
    });
  }

  /** Confirma el pago de una entrada (genera pago + libera + writeback). */
  confirmPayment(payload: ConfirmPaymentPayload): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Gastos/confirm-payment`, payload, {
      headers: this.trackingService.getHeaders()
    });
  }

  /** Guarda los campos editables de una entrada SIN concluir el pago (no libera). */
  savePending(payload: ConfirmPaymentPayload): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Gastos/save`, payload, {
      headers: this.trackingService.getHeaders()
    });
  }
}
