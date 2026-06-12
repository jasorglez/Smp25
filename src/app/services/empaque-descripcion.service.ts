import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface EmpaqueDescripcion {
  id?: number;
  idProveedorTabla: number;
  idDescripcionEmpaque: number | null;
  piezaXPaquete: number | null;
  active?: boolean;
}

export interface EmpaqueDescripcionItem {
  idDescripcionEmpaque: number | null;
  piezaXPaquete: number | null;
}

export interface PresentacionItem {
  idEmpaque: number;
  idDescripcionEmpaque: number | null;
  descripcionEmpaque: string | null;
  piezaXPaquete: number | null;
  medida: number | null;        // unidad original
  unidadAbrev: string | null;
  tipo: string | null;          // PESO | VOLUMEN
  factorBase: number | null;
  medidaBase: number | null;    // medida × factor (kg o L)
}

export interface ProveedorPresentaciones {
  idProveedorTabla: number;
  idProvider: number;
  minCompra: number;
  presentaciones: PresentacionItem[];
}

@Injectable({ providedIn: 'root' })
export class EmpaqueDescripcionService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByProveedor(idProveedorTabla: number): Observable<EmpaqueDescripcion[]> {
    return this.http.get<EmpaqueDescripcion[]>(
      `${environment.urlWarehouse}/EmpaqueDescripcion/byProveedor/${idProveedorTabla}`,
      { headers: this.headers });
  }

  /** Reemplaza las presentaciones del proveedor. Devuelve las filas con sus ids (en orden). */
  saveByProveedor(idProveedorTabla: number, items: EmpaqueDescripcionItem[]): Observable<EmpaqueDescripcion[]> {
    return this.http.post<EmpaqueDescripcion[]>(
      `${environment.urlWarehouse}/EmpaqueDescripcion/save-by-proveedor`,
      { idProveedorTabla, items },
      { headers: this.headers });
  }

  /** Proveedores del material con su compra mínima + presentaciones (base kg/L) para el panel de requisiciones. */
  getPresentacionesByMaterial(idMaterial: number): Observable<ProveedorPresentaciones[]> {
    return this.http.get<ProveedorPresentaciones[]>(
      `${environment.urlWarehouse}/EmpaqueDescripcion/presentaciones-by-material/${idMaterial}`,
      { headers: this.headers });
  }
}
