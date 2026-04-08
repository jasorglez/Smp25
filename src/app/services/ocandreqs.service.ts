import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
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

  getReqItems(idRequisition: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Detailsreqoc/${idRequisition}`, { headers: this.trackingService.getHeaders() });
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

  getProviders(id: number, type: string): Observable<any> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Material/providers-by-material?idMaterial=${id}&typeIntOrExt=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getTypeOcFlags(idRoot: number): Observable<{ reqId: number; hasNoAuth: boolean; hasChangeSpec: boolean }[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Ocandreq/${idRoot}/typeoc-flags`, { headers: this.trackingService.getHeaders() });
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

}
