import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class AuxiliarItemsService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getDetalle(idAuxiliar: number): Observable<any> {
    return this.http.get<any>(
      `${environment.urlSmp}/AuxiliarItems/detalle?idAuxiliar=${idAuxiliar}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  saveItem(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSmp}/AuxiliarItems/item`, data, { headers: this.trackingService.getHeaders() });
  }
  updateItem(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlSmp}/AuxiliarItems/item/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteItem(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlSmp}/AuxiliarItems/item/${id}`, { headers: this.trackingService.getHeaders() });
  }

  saveCuadrilla(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSmp}/AuxiliarItems/cuadrilla`, data, { headers: this.trackingService.getHeaders() });
  }
  updateCuadrilla(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlSmp}/AuxiliarItems/cuadrilla/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteCuadrilla(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlSmp}/AuxiliarItems/cuadrilla/${id}`, { headers: this.trackingService.getHeaders() });
  }

  saveCuadrillaItem(data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlSmp}/AuxiliarItems/cuadrilla-item`, data, { headers: this.trackingService.getHeaders() });
  }
  updateCuadrillaItem(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlSmp}/AuxiliarItems/cuadrilla-item/${id}`, data, { headers: this.trackingService.getHeaders() });
  }
  deleteCuadrillaItem(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlSmp}/AuxiliarItems/cuadrilla-item/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
