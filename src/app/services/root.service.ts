import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class RootService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }


  getRoot() {
    return this.http.get(`${environment.urlLinux3}/Root`, { headers: this.trackingService.getHeaders() });
  }

  getRootbyId(id:number) {
    return this.http.get(`${environment.urlLinux3}/Root/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
