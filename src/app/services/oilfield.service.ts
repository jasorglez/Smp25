import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';

import { environment } from '@env/environment';


import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class OilfieldService {
  
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);


  getOilfields() {
    return this.http.get(`${environment.urlSmp}/Oilfield`, { headers: this.trackingService.getHeaders() });
  }

  addOilfield(data: any) {
    return this.http.post(`${environment.urlSmp}/Oilfield`, data, { headers: this.trackingService.getHeaders() });
  }

  updateOilfield(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Oilfield/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteOilfield(id:number) {
    return this.http.delete(`${environment.urlSmp}/Oilfield/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
