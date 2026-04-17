import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ICustomer } from 'app/interface/icustomer';

@Injectable({
  providedIn: 'root'
})
export class CustomersService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  // Clientes

  getCustomers(id: number, type: string) {
    //const apiUrl = `${environment.urlAdministration}/Customer/branch/${id}?type=${type}`;      
    //alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/Customer/branch/${id}?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getCustomersxPalace(idRoot: number) {
    //const apiUrl = `${environment.urlAdministration}/Customer/palacio?idCompany=${idRoot}`;
    //alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/Customer/palacio?idCompany=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  getProviders(id: number,type: string) {
    //const apiUrl = `${environment.urlAdministration}/Customer/branch/${id}?type=${type}`;      
    //alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/Customer/cusorprov?idCompany=${id}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  /** id (string en JSON) → por_autorizar; no filtra por type (evita cusorprov vacío por mismatch en BD). */
  getAutorizacionFlags(idCompany: number): Observable<Record<string, boolean>> {
    return this.http.get<Record<string, boolean>>(
      `${environment.urlAdministration}/Customer/autorizacion-flags?idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /**
   * Flags por id (matprov). Orden: POST body → GET ?ids= → GET por compañía → GET /Customer/{id:int} por fila.
   * POST primero evita que un GET pase por error a /Customer/{id} si el API aún no distingue rutas (400 en id).
   */
  getAutorizacionFlagsByIds(ids: number[], idCompany: number): Observable<Record<string, boolean>> {
    const uniq = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
    if (uniq.length === 0) {
      return of({});
    }
    const base = `${environment.urlAdministration}/Customer/autorizacion-flags-by-ids`;
    const headers = this.trackingService.getHeaders();

    let params = new HttpParams();
    uniq.forEach((id) => (params = params.append('ids', String(id))));

    return this.http.post<Record<string, boolean>>(base, uniq, { headers }).pipe(
      catchError(() =>
        this.http.get<Record<string, boolean>>(base, { params, headers })
      ),
      catchError(() =>
        this.getAutorizacionFlags(idCompany).pipe(
          map((full) => this.pickAutorizacionForIds(full, uniq))
        )
      ),
      catchError(() =>
        forkJoin(
          uniq.map((id) =>
            this.getCustomerById(id).pipe(
              map((c: any) => ({
                id,
                val: !!(c?.autorizacion ?? c?.porAutorizar ?? c?.PorAutorizar),
              })),
              catchError(() => of({ id, val: false }))
            )
          )
        ).pipe(
          map((rows) => {
            const out: Record<string, boolean> = {};
            rows.forEach((r) => {
              out[String(r.id)] = r.val;
            });
            return out;
          })
        )
      )
    );
  }

  private pickAutorizacionForIds(
    full: Record<string, boolean> | null | undefined,
    ids: number[]
  ): Record<string, boolean> {
    const want = new Set(ids.map(String));
    const src = full && typeof full === 'object' && !Array.isArray(full) ? full : {};
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(src)) {
      if (want.has(k)) {
        out[k] = !!(src as any)[k];
      }
    }
    return out;
  }

  getCustomersByCompany(root : number, type: string) {
    const apiUrl = `${environment.urlAdministration}/Customer/company?idCompany=${root}&Type=${type}`;
    return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
  }

  // Clientes configurados para facturación electrónica
  getCustomersBilling(idRoot: number): Observable<any> {
    //  const apiUrl = `${environment.urlAdministration}/CustomersBilling/by-root/${idRoot}`;      
    //  alert(apiUrl)  
    return this.http.get(`${environment.urlAdministration}/CustomersBilling/by-root/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  // Obtener datos de facturación por customer específico
  getCustomersBillingByCustomer(idCustomer: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/CustomersBilling/by-customer/${idCustomer}`, { headers: this.trackingService.getHeaders() });
  }

  addCustomerBilling(data: any): Observable<any> {
     // const apiUrl = `${environment.urlAdministration}/CustomersBilling/` + data;      
     // console.log('log apiUrl', data);
     // alert(apiUrl)  

    return this.http.post(`${environment.urlAdministration}/CustomersBilling`, data, { headers: this.trackingService.getHeaders() });
  }

  updateCustomerBilling(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/CustomersBilling/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteCustomerBilling(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/CustomersBilling/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addCustomer(data: any): Observable<ICustomer> {
    return this.http.post<ICustomer>(`${environment.urlAdministration}/Customer`, data, { headers: this.trackingService.getHeaders() });
  }

  getCustomerById(id: number): Observable<ICustomer> {
    return this.http.get<ICustomer>(`${environment.urlAdministration}/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }
  

  updateCustomer(id: number, data: any): Observable<ICustomer> {
    return this.http.put<ICustomer>(`${environment.urlAdministration}/Customer/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteCustomer(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  updateFiel(id: number, type: string, operacion: string): Observable<ICustomer> {
  return this.http.put<ICustomer>(
    `${environment.urlAdministration}/Customer/Increment/${id}/${type}?operacion=${operacion}`,
    {},
    { headers: this.trackingService.getHeaders() }
  );
}

  //Customer/Increment/1114/CONTACT?operacion=RESTA
  // Clientes Créditos

  getClientCredits(id: number) {
    return this.http.get(`${environment.urlAdministration}/CustomerCredits/Customer/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addClientCredit(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/CustomerCredits`, data, { headers: this.trackingService.getHeaders() });
  }

  updateClientCredit(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/CustomerCredits/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteClientCredit(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/CustomerCredits/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Detalles créditos
  getDetailsCredits(id: number) {
    return this.http.get(`${environment.urlAdministration}/PaymentsCreditsxCustomers/credit/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addDetailCredit(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/PaymentsCreditsxCustomers`, data, { headers: this.trackingService.getHeaders() });
  }

  updateDetailCredit(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/PaymentsCreditsxCustomers/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteDetailCredit(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/PaymentsCreditsxCustomers/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addProveedorCredit(data: any): Observable<ICustomer> {
    return this.http.post<ICustomer>(`${environment.urlAdministration}/CustomerCreditsDelison`, data, { headers: this.trackingService.getHeaders() });
  }
  getProveedorCredit(id: number, table: number) {
    return this.http.get(`${environment.urlAdministration}/CustomerCreditsDelison/customer/${id}/${table}`, { headers: this.trackingService.getHeaders() });
  }

  addAbonoCustomer(id: number): Observable<ICustomer> {
    return this.http.put<ICustomer>(`${environment.urlAdministration}/CustomerCreditsDelison/abonoCuentas/${id}`, {}, { headers: this.trackingService.getHeaders() });
  }

  updateAbonoCustomer(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/CustomerCreditsDelison/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteAbonoCustomer(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/CustomerCreditsDelison/${id}`, { headers: this.trackingService.getHeaders() });
  }

  /**
   * Listado de proveedores para AG Grid. Si el API desplegado no tiene `providers-for-grid` (404),
   * usa `cusorprov` (mismos datos base) y adapta vigente/autorización.
   */
  getProvidersForGrid(idRoot: number): Observable<any> {
    const headers = this.trackingService.getHeaders();
    const primary = `${environment.urlAdministration}/Customer/providers-for-grid/${idRoot}`;
    return this.http.get(primary, { headers }).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          const fallback = `${environment.urlAdministration}/Customer/cusorprov?idCompany=${idRoot}&type=PROVIDERS`;
          return this.http.get(fallback, { headers }).pipe(
            map((rows: any) => this.mapCusorprovToProvidersGrid(rows))
          );
        }
        return throwError(() => err);
      })
    );
  }

  private mapCusorprovToProvidersGrid(rows: any): any[] {
    const arr = Array.isArray(rows) ? rows : [];
    return arr.map((c: any) => ({
      ...c,
      Vigente: c.vigente === true || c.active === true,
      autorizacion: c.porAutorizar === true || c.autorizacion === true
    }));
  }
}
