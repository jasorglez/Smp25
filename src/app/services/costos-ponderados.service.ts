import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Desglose de compras por proveedor (auditoria del promedio ponderado).
export interface ProveedorCosto {
  proveedor: string;
  cantidad: number;
  totalPagado: number;
  precioUnitario: number;
}

// Costos calculados de un material basico sobre la ventana movil.
export interface CostoPonderado {
  idMaterial: number;
  promedioPonderado: number;   // Sigma costo / Sigma cantidad
  ultimaCompra: number;        // precio unitario de la recepcion mas reciente
  maximo: number;              // precio unitario mas caro del periodo
  cantidadTotal: number;
  costoTotal: number;
  ventanaMeses: number;
  periodoInicio: string;       // yyyy-MM-dd
  periodoFin: string;
  parcial: boolean;            // historial menor que la ventana
  sinDatos: boolean;           // no hay compras pagadas en la ventana
  desglose: ProveedorCosto[];
}

// Modo de costeo de un basico en el BOM.
export type ModoCosto = 'PONDERADO' | 'ULTIMA' | 'MAXIMO';

@Injectable({ providedIn: 'root' })
export class CostosPonderadosService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private base = `${environment.urlWarehouse}/CostosPonderados`;

  // KPIs + desglose por proveedor de un material (solo basicos devuelven datos).
  getByMaterial(idCompany: number, idMaterial: number, ventana?: number): Observable<CostoPonderado> {
    const q = ventana != null ? `?ventana=${ventana}` : '';
    return this.http.get<CostoPonderado>(
      `${this.base}/byMaterial/${idCompany}/${idMaterial}${q}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // Costos de varios materiales a la vez (basicos de un producto del BOM).
  getBatch(idCompany: number, idMaterials: number[], ventana?: number): Observable<CostoPonderado[]> {
    const q = ventana != null ? `?ventana=${ventana}` : '';
    return this.http.post<CostoPonderado[]>(
      `${this.base}/batch/${idCompany}${q}`, idMaterials,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // Ventana movil (meses) configurable por empresa.
  getVentana(idCompany: number): Observable<{ ventanaMeses: number }> {
    return this.http.get<{ ventanaMeses: number }>(
      `${this.base}/ventana/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  setVentana(idCompany: number, meses: number): Observable<{ ventanaMeses: number }> {
    return this.http.put<{ ventanaMeses: number }>(
      `${this.base}/ventana/${idCompany}/${meses}`, {},
      { headers: this.trackingService.getHeaders() }
    );
  }

  // Devuelve el valor unitario segun el modo elegido.
  static valorPorModo(c: CostoPonderado | null | undefined, modo: ModoCosto): number {
    if (!c) return 0;
    switch (modo) {
      case 'ULTIMA': return c.ultimaCompra ?? 0;
      case 'MAXIMO': return c.maximo ?? 0;
      default:       return c.promedioPonderado ?? 0;
    }
  }
}
