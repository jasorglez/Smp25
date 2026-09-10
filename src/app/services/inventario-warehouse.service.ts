import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface AjusteDto {
  idMaterial:     number;
  idWarehouse:    number;
  cantidadFisica: number;
  comentario:     string;
  idCompany:      number;
}

@Injectable({ providedIn: 'root' })
export class InventarioWarehouseService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getInventario(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/inventario/filtrado/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getMovements(idProject: number, idWarehouse: number, type: 'IN' | 'OUT'): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/Inandout?idProject=${idProject}&idWarehouse=${idWarehouse}&type=${type}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getWarehouseMovements(idWarehouse: number, type: 'IN' | 'OUT'): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/Inandout?idWarehouse=${idWarehouse}&type=${type}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getMovementItems(idMovement: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/Detailsinandout/${idMovement}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  ajustar(data: AjusteDto): Observable<any> {
    return this.http.post<any>(
      `${environment.urlWarehouse}/inventario/ajuste`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
