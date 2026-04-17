import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class OcAndReqsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getOcAndReqs(typeReference: string, idReference: number, type: string) {
    return this.http.get(`${environment.urlWarehouse}/Ocandreq?typeReference=${typeReference}&idReference=${idReference}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getDetailedReq(id: number) {
    return this.http.get(`${environment.urlWarehouse}/Ocandreq/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addOcAndReq(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Ocandreq`, data, { headers: this.trackingService.getHeaders() });
  }

  updateOcAndReq(id: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Ocandreq/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteOcAndReq(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Ocandreq/${id}`, { headers: this.trackingService.getHeaders() });
  }

  /**
   * Detalle de líneas (requisición / COTIZ / OC). El API a veces devuelve array plano y a veces objeto envuelto.
   */
  private normalizeDetailsreqocList(raw: unknown): any[] {
    if (raw == null) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw;
    }
    if (typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      for (const key of ['data', 'project', 'items', 'result', 'records', 'value']) {
        const v = o[key];
        if (Array.isArray(v)) {
          return v;
        }
      }
    }
    return [];
  }

  getReqItems(idRequisition: number): Observable<any[]> {
    return this.http
      .get(`${environment.urlWarehouse}/Detailsreqoc/${idRequisition}`, { headers: this.trackingService.getHeaders() })
      .pipe(map((raw) => this.normalizeDetailsreqocList(raw)));
  }

  addReqItem(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Detailsreqoc`, data, { headers: this.trackingService.getHeaders() });
  }

  addReqItemsBulk(items: any[]): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Detailsreqoc/bulk`, items, { headers: this.trackingService.getHeaders() });
  }

  updateReqItem(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Detailsreqoc/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteReqItem(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Detailsreqoc/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getProviders(id: number, type?: string): Observable<any> {
    const url = type
      ? `${environment.urlWarehouse}/Material/providers-by-material?idMaterial=${id}&typeIntOrExt=${type}`
      : `${environment.urlWarehouse}/Material/providers-by-material?idMaterial=${id}`;
    return this.http.get<any[]>(url, { headers: this.trackingService.getHeaders() });
  }

  getTypeOcFlags(reqIds: number[]): Observable<{ reqId: number; hasNoAuth: boolean; hasChangeSpec: boolean }[]> {
    return this.http.post<any[]>(`${environment.urlWarehouse}/Ocandreq/typeoc-flags`, reqIds, { headers: this.trackingService.getHeaders() });
  }

  getCotizByReq(idReq: number, typeReference: string, idReference: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Ocandreq?typeReference=${typeReference}&idReference=${idReference}&type=COTIZ`, { headers: this.trackingService.getHeaders() });
  }

  lockRequisition(id: number, locked: boolean): Observable<any> {
    return this.http.patch(`${environment.urlWarehouse}/Ocandreq/${id}/lock`, { locked }, { headers: this.trackingService.getHeaders() });
  }

  setCountItem(id: number, countItem: number): Observable<any> {
    return this.http.patch(`${environment.urlWarehouse}/Ocandreq/${id}/countitem`, { countItem }, { headers: this.trackingService.getHeaders() });
  }

  setTotal(id: number, total: number): Observable<any> {
    return this.http.patch(`${environment.urlWarehouse}/Ocandreq/${id}/total`, { total }, { headers: this.trackingService.getHeaders() });
  }

  getFrequentArticles(solicit: string, idDepartment: number, idBranch: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/Detailsreqoc/frequent?solicit=${solicit}&idDepartment=${idDepartment}&idBranch=${idBranch}`,
      { headers: this.trackingService.getHeaders() });
  }

}
