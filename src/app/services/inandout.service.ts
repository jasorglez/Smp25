import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class InandoutService {

  
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getInAndOuts(idProject: number, idWarehouse: number, type: string) {
    return this.http.get(`${environment.urlWarehouse}/Inandout?idProject=${idProject}&idWarehouse=${idWarehouse}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getDetailedInOut(id: number) {
    return this.http.get(`${environment.urlWarehouse}/Inandout/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addInAndOut(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Inandout`, data, { headers: this.trackingService.getHeaders() });
  }

  updateInAndOut(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Inandout/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteInAndOut(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Inandout/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getInAndOutItems(idRequisition: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Detailsinandout/${idRequisition}`, { headers: this.trackingService.getHeaders() });
  }

  addInAndOutItem(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Detailsinandout`, data, { headers: this.trackingService.getHeaders() });
  }

  updateInAndOutItem(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Detailsinandout/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteInAndOutItem(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Detailsinandout/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
