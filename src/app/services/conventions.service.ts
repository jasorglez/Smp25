import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class ConventionsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);


  getConventions() {
    return this.http.get(`${environment.urlSmp}/Convention`, { headers: this.trackingService.getHeaders() });
  }

  getConventionsByContract(idContract: number) {
    return this.http.get(`${environment.urlSmp}/Convention/idContract?id=${idContract}`, { headers: this.trackingService.getHeaders() });
  }

  addConvention(data: any) {
    return this.http.post(`${environment.urlSmp}/Convention`, data, { headers: this.trackingService.getHeaders() });
  }

  updateConvention(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Convention/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteConvention(id:number) {
    return this.http.delete(`${environment.urlSmp}/Convention/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
