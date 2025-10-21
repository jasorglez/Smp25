import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';

import { environment } from '@env/environment';


import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ProvidersService {
  
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);


    getProvidersXTable(idProvider: number, type: string ) {
    return this.http.get(`${environment.urlWarehouse}/ProveedorXTabla?idProveedor=${idProvider}&Type=${type}`, { headers: this.trackingService.getHeaders() });
  }
  
    getMaterXTable(idMaterial: number, type: string ) {
    return this.http.get(`${environment.urlWarehouse}/ProveedorXTabla?idProveedor=${idMaterial}&Type=${type}`, { headers: this.trackingService.getHeaders() });
  }
  

  getProviders(idRoot: number) {
    return this.http.get(`${environment.urlSmp}/Providers?idRoot=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  getProviderById(id: number) {
    return this.http.get(`${environment.urlSmp}/Providers/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addProvider(data: any) {
    return this.http.post(`${environment.urlSmp}/Providers`, data, { headers: this.trackingService.getHeaders() });
  }

  updateProvider(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Providers/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteProvider(id:number) {
    return this.http.delete(`${environment.urlSmp}/Providers/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getProviderByType(type: string) {
    return this.http.get(`${environment.urlSmp}/Providers/3fields?type=${type}`, { headers: this.trackingService.getHeaders() });
  }

  addProviderXTable(data: any) {
    return this.http.post(`${environment.urlWarehouse}/ProveedorXTabla`, data, { headers: this.trackingService.getHeaders() });
  }

  updateProviderXTable(id: number, data: any) {
    return this.http.put(`${environment.urlWarehouse}/ProveedorXTabla/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteProviderXTable(id: number) {
    return this.http.delete(`${environment.urlWarehouse}/ProveedorXTabla/${id}`, { headers: this.trackingService.getHeaders() });
  }

  updateAbonoProviderXTable(id: number, table: number) {
    return this.http.put(`${environment.urlWarehouse}/ProveedorXTabla/abonoTabla/${id}/${table}`, {}, { headers: this.trackingService.getHeaders() });
  }
  
}
