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
    return this.http.get(`${environment.urlSmp}/Branchs?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }


  getBranches2fields(idroot : number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Branchs/2fields?idCompany=${idroot}`, { headers: this.trackingService.getHeaders() });
  }

}