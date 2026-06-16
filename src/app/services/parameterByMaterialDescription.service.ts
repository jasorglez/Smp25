import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';

import { environment } from '@env/environment';


import { HttpClient } from '@angular/common/http'
@Injectable({
  providedIn: 'root',
})
export class ParameterByMaterialDescriptionService {
  
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getParameterByMaterialDescription(idMaster: number ) {
    return this.http.get(`${environment.urlWarehouse}/ParameterByMaterialDescription/parameterByMaterialDescription/${idMaster}`, { headers: this.trackingService.getHeaders() });
  }

  addParameterByMaterialDescription(data: any) {
    return this.http.post(`${environment.urlWarehouse}/ParameterByMaterialDescription`, data, { headers: this.trackingService.getHeaders() });
  }

  updateParameterByMaterialDescription(id: number, data: any) {
    return this.http.put(`${environment.urlWarehouse}/ParameterByMaterialDescription?id=${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteParameterByMaterialDescription(id:number) {
    return this.http.delete(`${environment.urlWarehouse}/ParameterByMaterialDescription/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getParameter(idCompany: number, idMaterial: number ) {
    return this.http.get(`${environment.urlWarehouse}/ParameterByMaterialDescription/parameter/${idCompany}/${idMaterial} `, { headers: this.trackingService.getHeaders() });
  }
  getParameterVigente(idCompany: number) {
    return this.http.get(`${environment.urlWarehouse}/ParameterByMaterialDescription/parameter/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
}
