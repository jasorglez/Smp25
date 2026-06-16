import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';

import { environment } from '@env/environment';


import { HttpClient } from '@angular/common/http'
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
    return this.http.get(`${environment.urlWarehouse}/ProveedorXTabla/by-material?idMaterial=${idMaterial}&type=${type} `, { headers: this.trackingService.getHeaders() });
  }

   getMaterXSubfamily(idMaterial, idFam: number, type: string ) {
    return this.http.get(`${environment.urlWarehouse}/ProveedorXTabla/by-subfam?idMaterial=${idMaterial}&idFam=${idFam}&l}&type=${type} `, { headers: this.trackingService.getHeaders() });
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

  patchProviderStatus(id: number, data: { active?: boolean; autorizacion?: boolean }) {
    return this.http.patch(`${environment.urlSmp}/Providers/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  getProviderByType(type: string) {
    return this.http.get(`${environment.urlSmp}/Providers/3fields?type=${type}`, { headers: this.trackingService.getHeaders() });
  }
  getCantidadProviderXTable(id: string) {
    return this.http.get(`${environment.urlWarehouse}/ProveedorXTabla/cantidad-by-proveedor/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addProviderXTable(data: any) {
    return this.http.post(`${environment.urlWarehouse}/ProveedorXTabla`, data, { headers: this.trackingService.getHeaders() });
  }

  updateProviderXTable(id: number, data: any) {
    return this.http.put(`${environment.urlWarehouse}/ProveedorXTabla/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  patchProviderXTablaCampo11(campo1: number, idTabla: number, valor: string) {
    return this.http.patch(`${environment.urlWarehouse}/ProveedorXTabla/campo11/by-material-provider/${campo1}/${idTabla}`, { valor }, { headers: this.trackingService.getHeaders() });
  }

  deleteProviderXTable(id: number) {
    return this.http.delete(`${environment.urlWarehouse}/ProveedorXTabla/${id}`, { headers: this.trackingService.getHeaders() });
  }

  updateAbonoProviderXTable(id: number, table: number) {
    return this.http.put(`${environment.urlWarehouse}/ProveedorXTabla/abonoTabla/${id}/${table}`, {}, { headers: this.trackingService.getHeaders() });
  }

  cascadeMaterialActive(materialId: number, activate: boolean) {
    return this.http.patch(`${environment.urlWarehouse}/ProveedorXTabla/cascade-material-active/${materialId}?activate=${activate}`, {}, { headers: this.trackingService.getHeaders() });
  }

  getProviderType(idProvider: number) {
    return this.http.get(`${environment.urlWarehouse}/ProviderType/provider/${idProvider}`, { headers: this.trackingService.getHeaders() });
  }

  // SubfamilyxProvider endpoints
  getSubfamilyxProviderByProvider(idProvider: number) {
    return this.http.get(`${environment.urlWarehouse}/SubfamilyxProvider/provider/${idProvider}`, { headers: this.trackingService.getHeaders() });
  }

  getSubfamilyxVigentes(idProvider: number) {
    return this.http.get(`${environment.urlWarehouse}/SubfamilyxProvider/subfamilyvig/${idProvider}`, { headers: this.trackingService.getHeaders() });
  }

  addSubfamilyxProvider(data: any) {
    return this.http.post(`${environment.urlWarehouse}/SubfamilyxProvider`, data, { headers: this.trackingService.getHeaders() });
  }

  updateSubfamilyxProvider(id: number, data: any) {
    return this.http.put(`${environment.urlWarehouse}/SubfamilyxProvider/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteSubfamilyxProvider(id: number) {
    return this.http.delete(`${environment.urlWarehouse}/SubfamilyxProvider/${id}`, { headers: this.trackingService.getHeaders() });
  }

}
