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


  getProviders() {
    return this.http.get(`${environment.urlSmp}/Providers`, { headers: this.trackingService.getHeaders() });
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
}
