import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceCatalogService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByCompanyAndType(idCompany: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlMantenimiento}/MaintenanceCatalog?idCompany=${idCompany}&type=${type}`, {
      headers: this.trackingService.getHeaders()
    });
  }

  getByCompany(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlMantenimiento}/MaintenanceCatalog?idCompany=${idCompany}`, {
      headers: this.trackingService.getHeaders()
    });
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlMantenimiento}/MaintenanceCatalog/${id}`, {
      headers: this.trackingService.getHeaders()
    });
  }

  getDistinctTypes(idCompany: number): Observable<string[]> {
    return this.http.get<string[]>(`${environment.urlMantenimiento}/MaintenanceCatalog/types?idCompany=${idCompany}`, {
      headers: this.trackingService.getHeaders()
    });
  }

  add(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/MaintenanceCatalog`, data, {
      headers: this.trackingService.getHeaders()
    });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlMantenimiento}/MaintenanceCatalog/${id}`, data, {
      headers: this.trackingService.getHeaders()
    });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/MaintenanceCatalog/${id}`, {
      headers: this.trackingService.getHeaders()
    });
  }
}
