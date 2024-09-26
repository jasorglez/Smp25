import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {

  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }



  getProjectxOil(prio: number, idoil: number): Observable<any> {
    try {
      const apiUrl = `${environment.urlLinux3}/Project/oil?priority=${prio}&oil=${idoil}`;      
       // alert(apiUrl)
      return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
    } catch(error) {
      console.error("Error Get Project", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }


  getProjects() {
    return this.http.get(`${environment.urlLinux4}/Project`, { headers: this.trackingService.getHeaders() });
  }

  addProject(data: any) {
    return this.http.post(`${environment.urlLinux4}/Project`, data, { headers: this.trackingService.getHeaders() });
  }

  updateProject(id: number, data: any) {
    return this.http.put(`${environment.urlLinux4}/Project/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteProject(id: number) {
    return this.http.delete(`${environment.urlLinux4}/Project/${id}`, { headers: this.trackingService.getHeaders() });
  }

}



