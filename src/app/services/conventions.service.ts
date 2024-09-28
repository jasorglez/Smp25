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
    return this.http.get(`${environment.urlLinux4}/Convention`, { headers: this.trackingService.getHeaders() });
  }

  addConvention(data: any) {
    return this.http.post(`${environment.urlLinux4}/Convention`, data, { headers: this.trackingService.getHeaders() });
  }

  updateConvention(id: number, data: any) {
    return this.http.put(`${environment.urlLinux4}/Convention/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteConvention(id:number) {
    return this.http.delete(`${environment.urlLinux4}/Convention/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
