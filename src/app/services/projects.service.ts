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
    return this.http.get(`${environment.urlLinux3}/Project`, { headers: this.trackingService.getHeaders() });
  }

  addProject(data: any) {
    return EMPTY;
  }

  updateProject(id: number, data: any) {
    return EMPTY;
  }

  deleteProject(id:number) {
    return EMPTY;
  }

}



