import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class WarehousesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getWarehouses(idRoot: number) {
    return this.http.get(`${environment.urlWarehouse}/Warehouse?idBussines=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  addWarehouse(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Warehouse`, data, { headers: this.trackingService.getHeaders() });
  }

  updateWarehouse(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Warehouse/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteWarehouse(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Warehouse/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getSimpleWarehouses(idRoot: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Warehouse/2fields?idBussines=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }



}
