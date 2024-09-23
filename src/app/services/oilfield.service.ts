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

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }



  getOilfields() {
    return this.http.get(`${environment.urlLinux3}/Oilfield`, { headers: this.trackingService.getHeaders() });
  }
}
