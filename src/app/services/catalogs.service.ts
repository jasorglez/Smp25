import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class CatalogsService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  getCatalogs(idRoot: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idRoot}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }
  getCatalogsVigente(idRoot: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/getCatalogsVigente?idCompany=${idRoot}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getCatalogsFromAdmon(idRoot: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Catalog/getCatalogs?idCompany=${idRoot}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getPermissionxprocess(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/process-permissions?idProcces=${id}`, { headers: this.trackingService.getHeaders() });
  }


  getCatalogsByType(type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  getMeasures(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Measure`, { headers: this.trackingService.getHeaders() });
  }
  getUnits(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${id}&type=Units`, { headers: this.trackingService.getHeaders() });
  }

  getPhases(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${id}&type=Fase`, { headers: this.trackingService.getHeaders() });
  }

  getFamilies(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Family`, { headers: this.trackingService.getHeaders() });
  }

  getFamilyById(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${id}&type=Family`, { headers: this.trackingService.getHeaders() });
  }

  getSubfamilies(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Subfamily`, { headers: this.trackingService.getHeaders() });
  }

  getSubfamiliesByParentId(family: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/subfamily?parentId=${family}`, { headers: this.trackingService.getHeaders() });
  }

  getLocations(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Ubication`, { headers: this.trackingService.getHeaders() });
  }

  getDataTypes(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Input`, { headers: this.trackingService.getHeaders() });
  }

  getDocumentTypes(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=TypeDocument`, { headers: this.trackingService.getHeaders() });
  }

  
  addCatalog(catalog: any): Observable<any> {
    console.log(catalog);
    return this.http.post<any>(`${environment.urlWarehouse}/Catalog`, catalog, { headers: this.trackingService.getHeaders() });
  }

  updateCatalog(id: number, catalog: any): Observable<any> {
    return this.http.put<any>(`${environment.urlWarehouse}/Catalog/update-catalog/${id}`, catalog, { headers: this.trackingService.getHeaders() });  
  }

  deleteCatalog(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlWarehouse}/Catalog/${id}`, { headers: this.trackingService.getHeaders() });
  }


  updatePermission(catalog: any): Observable<any> {
    return this.http.put<any>(`${environment.urlWarehouse}/Catalog/update-permission/${catalog.id}`, catalog, { headers: this.trackingService.getHeaders() });  
  }


}
