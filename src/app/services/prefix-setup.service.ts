import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface PrefixSetup {
  id?: number;
  idProjectOrBranch: number;
  type: 'project' | 'branch';
  prefixReq?: string;
  consecutiveReq?: number;
  prefixCotiz?: string;
  consecutiveCotiz?: number;
  prefixOc?: string;
  consecutiveOc?: number;
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PrefixSetupService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  /**
   * Obtiene la configuración de prefijos por tipo e ID de proyecto/sucursal
   * @param type 'project' o 'branch'
   * @param idProjectOrBranch ID del proyecto o sucursal
   * @returns Observable con los datos del PrefixSetup
   */
  getPrefixSetup(type: string, idProjectOrBranch: number): Observable<PrefixSetup> {
    return this.http.get<PrefixSetup>(
      `${environment.urlWarehouse}/PrefixSetup/type/${type}/project-or-branch/${idProjectOrBranch}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Obtiene la configuración de prefijos por ID
   * @param id ID del PrefixSetup
   * @returns Observable con los datos del PrefixSetup
   */
  getPrefixSetupById(id: number): Observable<PrefixSetup> {
    return this.http.get<PrefixSetup>(
      `${environment.urlWarehouse}/PrefixSetup/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Crea una nueva configuración de prefijos
   * @param data Objeto PrefixSetup a crear
   * @returns Observable con el PrefixSetup creado
   */
  createPrefixSetup(data: PrefixSetup): Observable<PrefixSetup> {
    return this.http.post<PrefixSetup>(
      `${environment.urlWarehouse}/PrefixSetup`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Actualiza una configuración de prefijos existente
   * @param id ID del PrefixSetup a actualizar
   * @param data Objeto PrefixSetup con los datos actualizados
   * @returns Observable con el resultado de la actualización
   */
  updatePrefixSetup(id: number, data: PrefixSetup): Observable<any> {
    return this.http.put(
      `${environment.urlWarehouse}/PrefixSetup/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Elimina (soft delete) una configuración de prefijos
   * @param id ID del PrefixSetup a eliminar
   * @returns Observable con el resultado de la eliminación
   */
  deletePrefixSetup(id: number): Observable<any> {
    return this.http.delete(
      `${environment.urlWarehouse}/PrefixSetup/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
