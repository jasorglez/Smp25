import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, EMPTY, map, Observable, throwError } from 'rxjs';

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
      const apiUrl = `${environment.urlSmp}/Project/oil?priority=${prio}&oil=${idoil}`;      
       // alert(apiUrl)
      return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
    } catch(error) {
      console.error("Error Get Project", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }

  getProjects():Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Project`, { headers: this.trackingService.getHeaders() });
  }

  getProjectsByContract(idContract: number, idUser: number): Observable<any[]> {
    const url = `${environment.urlSmp}/SmpandSecurity/project`;
    const params = new HttpParams()
      .set('idUser', idUser.toString())
      .set('idContract', idContract.toString());

    console.log('Requesting URL:', url, 'with params:', params.toString());

    return this.http.get<any>(url, {
      params: params,
      headers: this.trackingService.getHeaders()
    }).pipe(
      map(response => {
        if (response && response.project) {
          return response.project;
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 404) {
      alert('No projects found');
      return [];
    }
    console.error('An error occurred:', error);
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }


  addProject(data: any) {
    return this.http.post(`${environment.urlSmp}/Project`, data, { headers: this.trackingService.getHeaders() });
  }

  updateProject(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Project/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteProject(id: number) {
    return this.http.delete(`${environment.urlSmp}/Project/${id}`, { headers: this.trackingService.getHeaders() });
  }

}



