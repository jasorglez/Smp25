import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GrallogService {

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);

   

  get(project: number) {
      return this.http.get(`${environment.urlSmp}/Grallog?idProject=${project}`, { headers: this.trackingService.getHeaders() });
    }
  
    getLogbyId(id:number) {
      return this.http.get(`${environment.urlSmp}/Root/${id}`, { headers: this.trackingService.getHeaders() });
    }
  
    add(data: any) {
      return this.http.post(`${environment.urlSmp}/Root`, data, { headers: this.trackingService.getHeaders() });
    }
  
    update(id: number, data: any) {
      return this.http.put(`${environment.urlSmp}/Root/${id}`, data, { headers: this.trackingService.getHeaders() });
    }
  
    delete(id:number) {
      return this.http.delete(`${environment.urlSmp}/Root/${id}`, { headers: this.trackingService.getHeaders() });
    }
  
    get2(idUser : number) {
      return this.http.get(`${environment.urlSmp}/SmpandSecurity/root?idUser=${idUser}`, { headers: this.trackingService.getHeaders() });    
    }
  

}
