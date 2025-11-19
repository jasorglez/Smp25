import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class PermitionsService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);



  addPermitions(data: any): Observable<any> {
      return this.http.post(`${environment.urlSecurity}/CrudPremissionsDelison`, data, { headers: this.trackingService.getHeaders() });
    }

  addPermitionsDetail(data: any): Observable<any> {
      return this.http.post(`${environment.urlSecurity}/CrudPremissionsDelison`, data, { headers: this.trackingService.getHeaders() });
    }

  addPermitionsDetailBydescription(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/CrudPremissionsDelison/bydescription`, data, { headers: this.trackingService.getHeaders() });
  }

  getPermisionswarehousexEmail(email: string): Observable<any> {
      return this.http.get(`${environment.urlSecurity}/WarehousePermissions/email/${email}`, { headers: this.trackingService.getHeaders() });
    }

  getRolYPosicion(idUser: number, idBranch: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/CrudPremissionsDelison/${idUser}/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }
  getInfoByUser(idUser: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/CrudPremissionsDelison/cantidad-por-usuario/${idUser}`, { headers: this.trackingService.getHeaders() });
  }
  updatePermitionsDetail(idUser: number, idBranch: number, idRole:number, idPosicion:number, idDetailedPermission: number,data: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/CrudPremissionsDelison?idUser=${idUser}&idBranch=${idBranch}&idRole=${idRole}&idPosicion=${idPosicion}&idDetailedPermission=${idDetailedPermission}`,data, { headers: this.trackingService.getHeaders() });
  }
   updatePermitionsByPosicion(idUser: number, idBranch: number, idRole:number, idPosicion:number, newPosicion: number): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/CrudPremissionsDelison/posicion?idUser=${idUser}&idBranch=${idBranch}&idRole=${idRole}&idPosicion=${idPosicion}&newPosicion=${newPosicion}`,{}, { headers: this.trackingService.getHeaders() });
  }
  getPermitionsSencillo(idEmpresa: number,idUser: number, idBranch: number, idRole:number, idPosicion:number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/CrudPremissionsDelison/sensillo/${idEmpresa}/${idUser}/${idBranch}/${idRole}/${idPosicion}`, { headers: this.trackingService.getHeaders() });
  }
  getPermitionsDetail(idEmpresa: number,idUser: number, idBranch: number, idRole:number, idPosicion:number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/CrudPremissionsDelison/${idEmpresa}/${idUser}/${idBranch}/${idRole}/${idPosicion}`, { headers: this.trackingService.getHeaders() });
  }
  getPermitionsByDetailedPermission(idUser: number, idBranch: number, idRole:number, idPosicion:number , idDetailedPermission: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/CrudPremissionsDelison/details-by-permission/${idUser}/${idBranch}/${idRole}/${idPosicion}/${idDetailedPermission}`, { headers: this.trackingService.getHeaders() });
  }
  deleteRoles(idUser: number, idBranch: number, idRole:number, idPosicion:number): Observable<any> {
    return this.http.delete(`${environment.urlSecurity}/CrudPremissionsDelison/${idUser}/${idBranch}/${idRole}/${idPosicion}`, { headers: this.trackingService.getHeaders() });
 }
}