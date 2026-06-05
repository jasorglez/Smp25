import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Una columna dinámica de la matriz (sucursal en gerencial, departamento en por-sucursal).
export interface InventarioMpColumna {
  id: number;
  nombre: string;
}

// Una fila = una materia prima. `valores` mapea idColumna → cantidad.
export interface InventarioMpFila {
  idMaterial: number;
  articulo: string;
  total: number;
  valores: { [colId: number]: number };
}

export interface InventarioMpVista {
  columnas: InventarioMpColumna[];
  filas: InventarioMpFila[];
}

@Injectable({ providedIn: 'root' })
export class InventarioMpService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Vista gerencial (todas las sucursales): columnas = sucursales.
  getGerencial(idCompany: number): Observable<InventarioMpVista> {
    return this.http.get<InventarioMpVista>(
      `${environment.urlWarehouse}/InventarioMp/gerencial/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // Vista por sucursal: columnas = departamentos con datos.
  getPorSucursal(idCompany: number, idSucursal: number): Observable<InventarioMpVista> {
    return this.http.get<InventarioMpVista>(
      `${environment.urlWarehouse}/InventarioMp/porSucursal/${idCompany}/${idSucursal}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
