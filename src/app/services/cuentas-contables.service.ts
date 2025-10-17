import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ICuentaContable,
  ICuentaContableHierarchy,
  ICuentaContableTree,
  ICuentaContableForm
} from 'app/interface/icuentas-contables';

@Injectable({
  providedIn: 'root'
})
export class CuentasContablesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.urlAdministration}/CuentasContables`;

  /**
   * Obtiene todas las cuentas contables de una compañía
   */
  getAll(idCompany: number): Observable<ICuentaContable[]> {
    return this.http.get<ICuentaContable[]>(`${this.apiUrl}/getAll/${idCompany}`);
  }

  /**
   * Obtiene cuentas por nivel (1, 2 o 3)
   */
  getByNivel(idCompany: number, nivel: number): Observable<ICuentaContable[]> {
    return this.http.get<ICuentaContable[]>(`${this.apiUrl}/getByNivel/${idCompany}/${nivel}`);
  }

  /**
   * Obtiene solo las cuentas hoja (nivel 3) que pueden recibir movimientos
   */
  getHojas(idCompany: number): Observable<ICuentaContable[]> {
    return this.http.get<ICuentaContable[]>(`${this.apiUrl}/getHojas/${idCompany}`);
  }

  /**
   * Obtiene la jerarquía completa en formato plano ordenado
   */
  getHierarchy(idCompany: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/getHierarchy/${idCompany}`);
  }

  /**
   * Obtiene la jerarquía en formato de árbol anidado
   */
  getTree(idCompany: number): Observable<ICuentaContableTree[]> {
    return this.http.get<ICuentaContableTree[]>(`${this.apiUrl}/getTree/${idCompany}`);
  }

  /**
   * Obtiene la jerarquía con montos acumulados
   */
  getHierarchyWithAmounts(
    idCompany: number,
    fechaInicio?: string,
    fechaFin?: string
  ): Observable<any> {
    let url = `${this.apiUrl}/getHierarchyWithAmounts/${idCompany}`;
    const params: string[] = [];

    if (fechaInicio) {
      params.push(`fechaInicio=${fechaInicio}`);
    }
    if (fechaFin) {
      params.push(`fechaFin=${fechaFin}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this.http.get<any>(url);
  }

  /**
   * Obtiene una cuenta por ID
   */
  getById(id: number): Observable<ICuentaContable> {
    return this.http.get<ICuentaContable>(`${this.apiUrl}/getById/${id}`);
  }

  /**
   * Crea una nueva cuenta contable
   */
  create(cuenta: ICuentaContableForm): Observable<ICuentaContable> {
    return this.http.post<ICuentaContable>(this.apiUrl, cuenta);
  }

  /**
   * Actualiza una cuenta contable existente
   */
  update(id: number, cuenta: ICuentaContableForm): Observable<any> {
    return this.http.put(`${this.apiUrl}/update/${id}`, cuenta);
  }

  /**
   * Elimina (desactiva) una cuenta contable
   */
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${id}`);
  }
}
