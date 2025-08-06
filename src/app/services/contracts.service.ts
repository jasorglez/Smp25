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

      
    //return this.http.get(`${environment.urlSmp}/SmpandSecurity/contract?idUser=${idUser}&idBussines=${idBussines}`, { headers: this.trackingService.getHeaders() });    
 
/*   
  getContractsBy2fields(idUser: number, idBussines: number) : Observable<any[]> {
    const url = `${environment.urlSmp}/SmpandSecurity/contract`;
    const params = new HttpParams()
      .set('idUser', idUser.toString())
      .set('idBussines', idBussines.toString());

    console.log('Requesting URL:', url, 'with params:', params.toString());

    return this.http.get<any>(url, {
      params: params,
      headers: this.trackingService.getHeaders()
    }).pipe(
      map(response => {
        if (response && response.contract) {
          return response.contract;
        }
        return [];
      }),
      catchError(this.handleError)
    );
  } */

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
