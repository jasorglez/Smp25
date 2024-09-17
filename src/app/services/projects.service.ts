import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {

  private http = inject(HttpClient);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  private getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  getProjectxOil(prio: number, idoil: number): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Project/oil?priority=${prio}&oil=${idoil}`;      
       // alert(apiUrl)
      return this.http.get(apiUrl);
    } catch(error) {
      console.error("Error Get Project", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }


  getProjects() {
    const headers = this.getHeaders();
    return this.http.get(`${environment.urlLinux3}/Project`, { headers });
  }


}



