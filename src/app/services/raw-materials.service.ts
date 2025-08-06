import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class RawMaterialsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getParentRawMaterialsByCompany(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/RawMaterial/byIdCompany/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getParentRawMaterial(id: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/RawMaterial/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addParentRawMaterials(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/RawMaterial`, { headers: this.trackingService.getHeaders() });
  }

  updateParentRawMaterials(id: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/RawMaterial/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteParentRawMaterials(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/RawMaterial/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getRawMaterialDetailsByParent(idRawMaterial: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/RawMaterialDetails/byRawMaterial/${idRawMaterial}`, { headers: this.trackingService.getHeaders() });
  }

  getRawMaterialDetail(id: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/RawMaterialDetails/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addRawMaterialDetails(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/RawMaterialDetails`, { headers: this.trackingService.getHeaders() });
  }

  updateRawMaterialDetails(id: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/RawMaterialDetails/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteRawMaterialDetails(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/RawMaterialDetails/${id}`, { headers: this.trackingService.getHeaders() });
  }

}
