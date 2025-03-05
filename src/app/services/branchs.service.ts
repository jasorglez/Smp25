import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class BranchsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getBranches(idroot : number): Observable<any> {
    //  const apiUrl = `${environment.urlSmp}/Branchs?idCompany=${idroot}`;      
     //alert(apiUrl) 
    return this.http.get(`${environment.urlSmp}/Branchs?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  getBranches2fields(idroot : number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Branchs/2fields?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

  addBranch(branch: any) {
    return this.http.post(`${environment.urlSmp}/Branchs`, branch, { headers: this.trackingService.getHeaders() });
  }

  updateBranch(id: number, branch: any) {
    return this.http.put(`${environment.urlSmp}/Branchs/${id}`, branch, { headers: this.trackingService.getHeaders() });
  }

  getBranchesByUserAndCompany(idUser: number, idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/SmpandSecurity/Branch?idUser=${idUser}&idRoot=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }
}