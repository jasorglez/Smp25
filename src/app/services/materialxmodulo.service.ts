import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class MaterialXModuloService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getAll(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/MaterialXModulo?idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByType(idCompany: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/MaterialXModulo/ByType?idCompany=${idCompany}&type=${type}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByCatalog(idCompany: number, idCatalog: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/MaterialXModulo/ByCatalog?idCompany=${idCompany}&idCatalog=${idCatalog}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlWarehouse}/MaterialXModulo`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlWarehouse}/MaterialXModulo/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlWarehouse}/MaterialXModulo/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
