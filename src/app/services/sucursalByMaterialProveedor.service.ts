import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, EMPTY, map, Observable, Subject, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SucursalByMaterialProveedorService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Evento global: cuando se guardan sucursales, emite el idProveedor
  private sucursalSaved = new Subject<number>();
  sucursalSaved$ = this.sucursalSaved.asObservable();

  notifySucursalSaved(idProveedor: number) {
    this.sucursalSaved.next(idProveedor);
  }

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  getSucursalByMaterial(idMaster: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/SucursalByMaterialProveedor/GetAll?idMaster=${idMaster}`, { headers: this.trackingService.getHeaders() });
  }

  getCantidadPersonal(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/TDPersonalByProyects/personalByProyect`, { headers: this.trackingService.getHeaders() });
  }

  addSucursalByMaterial(data: any) {
    return this.http.post(`${environment.urlWarehouse}/SucursalByMaterialProveedor`, data, { headers: this.trackingService.getHeaders() });
  }

  updateSucursalByMaterial(id: number, data: any) {
    return this.http.put(`${environment.urlWarehouse}/SucursalByMaterialProveedor?id=${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteSucursalByMaterial(id: number) {
    return this.http.delete(`${environment.urlWarehouse}/SucursalByMaterialProveedor/${id}`, { headers: this.trackingService.getHeaders() });
  }

  patchTiempoDeEntrega(idMaterial: number, idProveedor: number, idSucursal: number, valor: number) {
    return this.http.patch(
      `${environment.urlWarehouse}/SucursalByMaterialProveedor/tiempo-entrega/by-material-proveedor-sucursal/${idMaterial}/${idProveedor}/${idSucursal}`,
      { valor },
      { headers: this.trackingService.getHeaders() }
    );
  }

}



