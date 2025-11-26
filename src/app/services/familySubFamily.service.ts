import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class FamilySubFamily {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  getCatalogsFamilySubFamily(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/Get?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
  getDetailMaster(idCompany: number, select): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/GetDetailByMaster?idCompany=${idCompany}&idMasterFamily=${select}`, { headers: this.trackingService.getHeaders() });
  }

  getMasterFamily(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/GetMasterFamily?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  addMasterFamily(data: any): Observable<any[]>{
    return this.http.post<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/MasterFamily`, data, { headers: this.trackingService.getHeaders() });
  }
  updateMasterFamily(id:number, data: any): Observable<any[]>{
    return this.http.put<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/MasterFamily?id=${id}`, data ,{ headers: this.trackingService.getHeaders() });
  }
  updateDetailMasterFamily(data: any): Observable<any[]>{
    return this.http.put<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/DetailMasterFamily`, data ,{ headers: this.trackingService.getHeaders() });
  }

  deleteMasterFamily(id: number): Observable<any[]> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/MasterFamily/${id}`, { headers: this.trackingService.getHeaders() });
  }
  getCatalogsFamily(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/GetCatalog?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
  getCatalogsMasterByFamily(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/GetSubFamilyByMaster/${id}`, { headers: this.trackingService.getHeaders() });
  }
  getCatalogsMasterByFamilyVigentes(idCompany: number, idMasterFamily: number, idFamilia: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/GetSubFamilyByMasterVigentes/${idCompany}/${idMasterFamily}/${idFamilia}`, { headers: this.trackingService.getHeaders() });
  }
}
