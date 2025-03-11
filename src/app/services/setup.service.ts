import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SetupService {

  constructor() { }

    private http = inject(HttpClient);
    private trackingService = inject(TrackingService);
  
    // Setup WareHouse
    getWarehouses(id : number) {
      return this.http.get(`${environment.urlAdministration}/Bank`, { headers: this.trackingService.getHeaders() });
    }
      
    addWarehouse(data: any): Observable<any> {
      return this.http.post(`${environment.urlAdministration}/Bank`, data, { headers: this.trackingService.getHeaders() });
    }
  
    updateWarehouse(id: string, data: any): Observable<any> {
      return this.http.put<any[]>(`${environment.urlAdministration}/Bank/${id}`, data, { headers: this.trackingService.getHeaders() });
    }
  
    

// Setup PV


// Setup Adminsitration


// Setup Production

}
