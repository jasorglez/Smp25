import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { catchError, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContractsService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getContracts(branch: number) {
    return this.http.get(`${environment.urlSmp}/Contract?idBranch=${branch}`, { headers: this.trackingService.getHeaders() });
  }

  getContractsByProvider(id: number) {
    return this.http.get(`${environment.urlSmp}/Contract/provider?provider=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getContractById(id: number) {
    return this.http.get(`${environment.urlSmp}/Contract/${id}`, { headers: this.trackingService.getHeaders() });
  }
  getExecutingBranches(idContract: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Contract/${idContract}/executing-branches`, { headers: this.trackingService.getHeaders() });
  }
      
    //return this.http.get(`${environment.urlSmp}/SmpandSecurity/contract?idUser=${idUser}&idBussines=${idBussines}`, { headers: this.trackingService.getHeaders() });    


  getContractsByBranch(idUser: number, idBranch: number) {
    return this.http.get(`${environment.urlSecurity}/UsersxContractsxProjectsView/contracts?idUser=${idUser}&idBranch=${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 404) {
      //alert('No projects found');
      return [];
    }
    console.error('An error occurred:', error);
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }

}
