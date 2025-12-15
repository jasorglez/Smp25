import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class CatalogadmonService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  getCatalogs(idRoot: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Catalog/getCatalogs?idCompany=${idRoot}&type=${type}`, { headers: this.trackingService.getHeaders() });
  }
 
  getCatalogsxNivel(idRoot: number, type: string, nivel: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Catalog/getCatalogsxNivel?idCompany=${idRoot}&type=${type}&nivel=${nivel}`, { headers: this.trackingService.getHeaders() });
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


}
