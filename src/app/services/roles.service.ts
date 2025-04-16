import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class RolesService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);
  
      
    getRoles(): Observable<any> {
      const apiUrl = `${environment.urlSecurity}/Roles`;
    //  alert(apiUrl)
      return this.http.get(`${environment.urlSecurity}/Roles`, { headers: this.trackingService.getHeaders() });
    }
  
      
    getRolesById(id: number): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/Roles/${id}`, { headers: this.trackingService.getHeaders() });
    }
  
    
    addRoles(data: any): Observable<any> {
      return this.http.post(`${environment.urlSecurity}/Roles`, data, { headers: this.trackingService.getHeaders() });
    }
  

    updateRoles(id: string, data: any): Observable<any> {
      console.log('DATA EN EL UPDATE', data)
      return this.http.put(`${environment.urlSecurity}/Roles/${id}`, data, { headers: this.trackingService.getHeaders() });
    }
  

    deleteRoles(id: number, data: any): Observable<any> {
      return this.http.put(`${environment.urlSecurity}/Roles/${id}`, data, { headers: this.trackingService.getHeaders() });
    }
  

}
