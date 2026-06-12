import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';

import { environment } from '@env/environment';


import { HttpClient } from '@angular/common/http'
@Injectable({
  providedIn: 'root',
})
export class MateriaByCatalogService {
  
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getMateriaByCatalog(idCompany: number, idMaterial: number ) {
    return this.http.get(`${environment.urlWarehouse}/MateriaByCatalog/byIdCompany/${idCompany}/${idMaterial} `, { headers: this.trackingService.getHeaders() });
  }

  addMateriaByCatalog(data: any) {
    return this.http.post(`${environment.urlWarehouse}/MateriaByCatalog`, data, { headers: this.trackingService.getHeaders() });
  }

  updateMateriaByCatalog(id: number, data: any) {
    return this.http.put(`${environment.urlWarehouse}/MateriaByCatalog?id=${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteMateriaByCatalog(id:number) {
    return this.http.delete(`${environment.urlWarehouse}/MateriaByCatalog/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
