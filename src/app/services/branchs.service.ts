import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';
import { Ibranch } from 'app/interface/ibranch';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class BranchsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  assignPermissionAfterCreation(userId: number, newEntityId: number, type: string): Observable<any> {
    const permissionData = {
      idUser: userId,
      idPermission: newEntityId,
      type: type,
      active: 1
    };

   // alert('Permission assigned successfully!');
    return this.http.post(`${environment.urlSecurity}/Usersxpermission`, permissionData, { headers: this.trackingService.getHeaders() });
  }


  getAllBranches(): Observable<any> {
    //  const apiUrl = `${environment.urlSmp}/Branchs?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlSmp}/Branchs/all`, { headers: this.trackingService.getHeaders() });
  }


  getBranches(idroot : number): Observable<any> {
    //  const apiUrl = `${environment.urlSmp}/Branchs?idCompany=${idroot}`;
     //alert(apiUrl)
    return this.http.get(`${environment.urlSmp}/Branchs?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  getBranches2fields(idroot : number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Branchs/2fields?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  addBranch(branch: any) : Observable<Ibranch> {
    return this.http.post<Ibranch>(`${environment.urlSmp}/Branchs`, branch, { headers: this.trackingService.getHeaders() });
  }

  updateBranch(id: number, branch: any) :Observable<Ibranch>{
    return this.http.put<Ibranch>(`${environment.urlSmp}/Branchs/${id}`, branch, { headers: this.trackingService.getHeaders() });
  }

  getBranchesByUserAndCompany(idUser: number, idCompany: number): Observable<any> {
     //const apiUrl = `${environment.urlSmp}/SmpandSecurity/Branch?idUser=${idUser}&idRoot=${idCompany}`;
    // alert(apiUrl)
     return this.http.get(`${environment.urlSmp}/SmpandSecurity/Branch?idUser=${idUser}&idRoot=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getBrancheswoa(idroot : number): Observable<any> {
      //const apiUrl = `${environment.urlSmp}/Branchs/2fieldswoad?idCompany=${idroot}`;
      //alert(apiUrl)
    return this.http.get(`${environment.urlSmp}/Branchs/2fields?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  deleteBranch(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Branchs/${id}`, { headers: this.trackingService.getHeaders()});
  }

}
