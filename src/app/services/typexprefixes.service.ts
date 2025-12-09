import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class TypexPrefixesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  /**
   * Obtiene el prefijo y consecutivo para un tipo de requisición específico
   * @param reqType Tipo de requisición ('branch' o 'project')
   * @param idReqType ID de la sucursal o proyecto
   * @returns Observable con los datos del prefijo
   */
  getPrefix(reqType: string, idReqType: number): Observable<any> {
    return this.http.get(
      `${environment.urlWarehouse}/TypexPrefixes/${reqType}/${idReqType}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Crea un nuevo prefijo y consecutivo
   * @param data Objeto con los datos del prefijo (reqType, idReqType, prefix, consecutive)
   * @returns Observable con el resultado de la creación
   */
  addPrefix(data: any): Observable<any> {
    return this.http.post(
      `${environment.urlWarehouse}/TypexPrefixes`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Actualiza un prefijo y consecutivo existente
   * @param reqType Tipo de requisición ('branch' o 'project')
   * @param idReqType ID de la sucursal o proyecto
   * @param data Objeto con los datos a actualizar (prefix, consecutive)
   * @returns Observable con el resultado de la actualización
   */
  updatePrefix(reqType: string, idReqType: number, data: any): Observable<any> {
    return this.http.put(
      `${environment.urlWarehouse}/TypexPrefixes/${reqType}/${idReqType}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
