import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Icompany } from '../interface/icompany';

import { TrackingService } from './tracking.service';

import { catchError, map } from 'rxjs/operators';
import { EMPTY, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CompanysService {
  private _idEmpresa: number;

  private trackingService = inject(TrackingService);

  constructor(private http: HttpClient) {
    this._idEmpresa = 0;
  }

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }
 

  /*-------------------------------
 * aqui obtengo el email del login y lo fijo
 ------------------------------*/

  /*----------------------------------------------------------------------------------
 * Obtener la consulta por email para ver que empresas le corresponden al LookCombo
 ------------------------------------------------------------------------------------*/

  
  //Tomar la data de la colección Empresas en Azure
  getDataCompanysAzure() {
    return this.http.get(`${environment.urlLinux3}/Providers`, { headers: this.trackingService.getHeaders() });
  }
    

  getpermissionsxCprocess(branch: string, mail: string): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/permission?email=${mail}`;
      return this.http.get(apiUrl);
    } catch (error) {
      console.error('Error Managment files', error);
      return EMPTY;
    }
  }

  getPermissionsxPlatform(id: number): Observable<any> {
    const apiUrl = `${environment.urlAzure}api/permission/plat?id=${id}`;

    return this.http.get(apiUrl).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error get Platforms', error);
        // Retornamos un Observable vacío en lugar de null
        return of(null);
      })
    );
  }


  Companys(): Observable<any> {
    try {
      const apiUrl = `${environment.urlLinux3}/Providers/id`;
      //  alert(apiUrl)
      return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
    } catch (error) {
      console.error('Error Get LogBook', error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }

  getProjectxCompany(prio: number, idcomp: number): Observable<any> {
    try {
      const apiUrl = `${environment.urlLinux3}/Project/company?priority=${prio}&comp=${idcomp}`;
      //  alert(apiUrl)
      return this.http.get(apiUrl, { headers: this.trackingService.getHeaders() });
    } catch (error) {
      console.error('Error Get Project', error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }
}
