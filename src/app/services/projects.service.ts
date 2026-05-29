import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, EMPTY, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }



  getProjectxOil(prio: number, idoil: number): Observable<any> {
    try {
      const apiUrl = `${environment.urlSmp}/Project/oil?priority=${prio}&oil=${idoil}`;
      // alert(apiUrl)
      return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
    } catch (error) {
      console.error("Error Get Project", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }

  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Project`, { headers: this.trackingService.getHeaders() });
  }


  getProjectsById(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Project/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getProjectsByContract(idUser: number, idBranch?: number) {
    let url = `${environment.urlSecurity}/UsersxContractsxProjectsView/projects?idUser=${idUser}`;
    if (idBranch !== undefined) {
      url += `&idContract=${idBranch}`;
    }
    return this.http.get(url, { headers: this.trackingService.getHeaders() });
  }

  getProjectListByContract(idContract: number) {
    return this.http.get(`${environment.urlSmp}/Project/contract?contrato=${idContract}`, { headers: this.trackingService.getHeaders() })
  }

  getProjectListByCompany(idCompany: number) {
    return this.http.get(`${environment.urlSmp}/Project/company?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() })
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 404) {
      console.log('No projects found');
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

  // ── PMO Recursos ──────────────────────────────────────────────────────────
  getPmoRecursosByProject(idProject: number) {
    return this.http.get(`${environment.urlSmp}/PmoRecurso/project/${idProject}`, { headers: this.trackingService.getHeaders() });
  }

  getPmoRecursosByActivity(idActivity: number) {
    return this.http.get(`${environment.urlSmp}/PmoRecurso/activity/${idActivity}`, { headers: this.trackingService.getHeaders() });
  }

  savePmoRecursosBatch(recursos: any[]) {
    return this.http.post(`${environment.urlSmp}/PmoRecurso/batch`, recursos, { headers: this.trackingService.getHeaders() });
  }

  deletePmoRecurso(id: number) {
    return this.http.delete(`${environment.urlSmp}/PmoRecurso/${id}`, { headers: this.trackingService.getHeaders() });
  }

}



