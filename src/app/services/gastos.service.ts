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
  cantidadOc: number;
  cantidadReq: number;
  precioUnitario: number;
  valorPago: number;
  masIva: boolean;
  notaFactura: string | null;
  numNotaFactura: string | null;
  fechaRecepcion: string | null;
  fechaPago: string | null;

  // Condición de pago (catálogo) + estado de crédito/anticipo
  calculoAnticipo: boolean;       // true = bloque ANTICIPO; false = bloque CRÉDITO
  condicionCantidad: number;      // crédito → N días; anticipo → % del total
  credito: boolean;               // entrada ya ingresada a crédito (pendiente de pago)
  fechaVencimiento?: string | null; // fecha de vencimiento manual (YYYY-MM-DD); null = calculada en runtime
  anticipoPagado: boolean;        // el dinero del anticipo de la OC ya se entregó
  anticipoMonto: number;          // monto total del anticipo registrado
  anticipoSaldo: number;          // anticipo_monto − Σ aplicado
  metodoAnticipo: string | null;  // 'FIFO' | 'PRORRATEO' (null hasta la 1ª aplicación)
  numProrrateo: number | null;    // entregas para prorrateo (si ya se eligió)
  numEntregasPlan: number;        // entregas creadas (default de prorrateo)
  numEntradasAlmacen: number;     // entradas reales en entradas_molienda para esta OC+material

  // Gasto general no-material (anticipo, servicio, nómina…). Si viene, la fila es de
  // Delison.gastos_generales (no de entradas_molienda); docType = tipo_gasto ('ANTICIPO').
  idGastoGeneral?: number | null;

  // Desglose de artículos de la OC detrás del anticipo (para el tooltip de la columna Artículo).
  anticipoItems?: AnticipoItem[] | null;

  // Consumo del anticipo por entrega (tooltip de la columna Valor en la fila de anticipo).
  anticipoConsumo?: AnticipoConsumo[] | null;
  // Monto del anticipo aplicado a ESTA entrada (para el neto en el histórico).
  anticipoAplicado?: number;
  // Porcentaje ORIGINAL del anticipo (condiciones_pago.cantidad), sin recalcular con IVA.
  anticipoPorcentaje?: number;

  // ── Fase 4: moneda y conversión a MXN ──
  // En PENDIENTES: moneda del ítem a convertir (USD/EUR/MXN). En HISTÓRICO: la moneda con que se pagó.
  moneda?: string | null;
  // En HISTÓRICO: TC aplicado y fuente; valorPago ya viene en MXN.
  tipoCambio?: number | null;
  fuenteTc?: string | null;
  // TC con que se pagó el anticipo de la OC. El anticipo aplicado/desglose viene en moneda original;
  // se multiplica por este TC para mostrarlo en MXN. 1 si MXN o sin anticipo.
  tcAnticipo?: number | null;
}

export interface AnticipoItem {
  articulo: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export interface AnticipoConsumo {
  folioEntrega: string;
  descuento: number;
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
  numNotaFactura?: string | null;
  cantidad: number;
  fechaVencimiento?: string | null; // fecha de vencimiento manual (YYYY-MM-DD); null = no cambiar
  // Aplicación de anticipo (bloque ANTICIPO)
  anticipoAplicado?: number | null;
  metodoAnticipo?: string | null;   // 'FIFO' | 'PRORRATEO'
  numProrrateo?: number | null;
  // Fase 4: conversión a MXN (moneda extranjera). El backend persiste monto_mxn = valorPago × tipoCambio.
  tipoCambio?: number | null;
  moneda?: string | null;
  fuenteTc?: string | null;
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

  /** Ingresa una entrada "a crédito": material disponible + pago pendiente a N días. */
  activarCredito(idEntrada: number, fechaVencimiento?: string | null, notaFactura?: string | null, numNotaFactura?: string | null): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Gastos/activar-credito`, { idEntrada, fechaVencimiento, notaFactura, numNotaFactura }, {
      headers: this.trackingService.getHeaders()
    });
  }

  /** Marca el anticipo de una OC como pagado (desde el grid de Órdenes de Compra). */
  marcarAnticipo(idOc: number, monto: number, fecha?: string | null): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Gastos/marcar-anticipo`, { idOc, monto, fecha }, {
      headers: this.trackingService.getHeaders()
    });
  }

  /** Paga un anticipo EN TRÁMITE desde la Captura de Gastos (lo marca PAGADO con su fecha). */
  confirmAnticipo(idGastoGeneral: number, fechaPago?: string | null, notaFactura?: string | null,
                  tipoCambio?: number | null, moneda?: string | null, fuenteTc?: string | null): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Gastos/confirm-anticipo`,
      { idGastoGeneral, fechaPago, notaFactura, tipoCambio, moneda, fuenteTc }, {
      headers: this.trackingService.getHeaders()
    });
  }
}
