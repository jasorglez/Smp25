import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class SteakholderService {

  constructor() { }

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);

   

  get(project: number, fecha: string ) {
      return this.http.get(`${environment.urlSmp}/Stakeholder?idProject=${project}&date=${fecha}`, { headers: this.trackingService.getHeaders() });
    }
  
    getbyDate(fecha: Date) {
      return this.http.get(`${environment.urlSmp}/Stakeholder/${fecha}`, { headers: this.trackingService.getHeaders() });
    }
  
    add(data: any) {
      return this.http.post(`${environment.urlSmp}/Stakeholder`, data, { headers: this.trackingService.getHeaders() });
    }
  
    update(id: number, data: any) {
      return this.http.put(`${environment.urlSmp}/Stakeholder/${id}`, data, { headers: this.trackingService.getHeaders() });
    }
  
    delete(id:number) {
      return this.http.delete(`${environment.urlSmp}/Stakeholder/${id}`, { headers: this.trackingService.getHeaders() });
    }  
    
}
