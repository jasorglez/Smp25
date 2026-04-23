import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export type DocumentType = 'req' | 'cotiz' | 'oc';

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

  /**
   * Genera el siguiente folio SIN actualizar la BD (solo calcula)
   * @param type 'project' o 'branch'
   * @param idProjectOrBranch ID del proyecto o sucursal
   * @param documentType 'req' | 'cotiz' | 'oc'
   * @returns Promise con el folio generado o null si no hay configuración
   */
  async generateNextFolio(type: 'project' | 'branch', idProjectOrBranch: number, documentType: DocumentType): Promise<string | null> {
    try {
      const prefixSetup = await firstValueFrom(this.getPrefixSetup(type, idProjectOrBranch));

      if (!prefixSetup) {
        console.warn('No se encontró configuración de prefijos');
        return null;
      }

      let prefix: string = '';
      let consecutive: number = 0;

      switch (documentType) {
        case 'req':
          prefix = prefixSetup.prefixReq || '';
          consecutive = (prefixSetup.consecutiveReq || 0) + 1;
          break;
        case 'cotiz':
          prefix = prefixSetup.prefixCotiz || '';
          consecutive = (prefixSetup.consecutiveCotiz || 0) + 1;
          break;
        case 'oc':
          prefix = prefixSetup.prefixOc || '';
          consecutive = (prefixSetup.consecutiveOc || 0) + 1;
          break;
      }

      // Concatenar prefijo + guion + consecutivo formateado a 4 dígitos (ej: BOD-0001)
      const formattedConsecutive = consecutive.toString().padStart(4, '0');
      const folio = `${prefix}-${formattedConsecutive}`;

      return folio;
    } catch (error) {
      console.error('Error al generar folio:', error);
      return null;
    }
  }

  /**
   * Confirma y actualiza el consecutivo DESPUÉS de guardar
   * @param prefixSetupId ID del PrefixSetup
   * @param documentType 'req' | 'cotiz' | 'oc'
   * @returns Promise que se resuelve cuando se actualiza
   */
  async confirmFolio(prefixSetupId: number, documentType: DocumentType): Promise<void> {
    try {
      const prefixSetup = await firstValueFrom(this.getPrefixSetupById(prefixSetupId));

      if (!prefixSetup) {
        throw new Error('No se encontró la configuración de prefijos');
      }

      // Incrementar el consecutivo según el tipo de documento
      switch (documentType) {
        case 'req':
          prefixSetup.consecutiveReq = (prefixSetup.consecutiveReq || 0) + 1;
          break;
        case 'cotiz':
          prefixSetup.consecutiveCotiz = (prefixSetup.consecutiveCotiz || 0) + 1;
          break;
        case 'oc':
          prefixSetup.consecutiveOc = (prefixSetup.consecutiveOc || 0) + 1;
          break;
      }

      // Actualizar en la base de datos
      await firstValueFrom(this.updatePrefixSetup(prefixSetupId, prefixSetup));
    } catch (error) {
      console.error('Error al confirmar folio:', error);
      throw error;
    }
  }

  /**
   * Genera el siguiente folio para un tipo de documento y actualiza el consecutivo
   * @deprecated Usa generateNextFolio() + confirmFolio() en su lugar
   * @param type 'project' o 'branch'
   * @param idProjectOrBranch ID del proyecto o sucursal
   * @param documentType 'req' | 'cotiz' | 'oc'
   * @returns Promise con el folio generado o null si no hay configuración
   */
  async getNextFolio(type: 'project' | 'branch', idProjectOrBranch: number, documentType: DocumentType): Promise<string | null> {
    // Para compatibilidad, usa generateNextFolio
    return this.generateNextFolio(type, idProjectOrBranch, documentType);
  }
}
