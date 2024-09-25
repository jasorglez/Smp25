import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class RootService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getRoot() {
    return this.http.get(`${environment.urlLinux3}/Root`, { headers: this.trackingService.getHeaders() });
  }

  getRootbyId(id:number) {
    return this.http.get(`${environment.urlLinux3}/Root/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addRoot(data: any) {
    return this.http.post(`${environment.urlLinux3}/Root`, data, { headers: this.trackingService.getHeaders() });
  }

  updateRoot(id: number, data: any) {
    return this.http.put(`${environment.urlLinux3}/Root/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteRoot(id:number) {
    return this.http.delete(`${environment.urlLinux3}/Root/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
