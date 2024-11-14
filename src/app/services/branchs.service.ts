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

  getBranches(): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Branchs/2fields?idCompany=1`, { headers: this.trackingService.getHeaders() });
  }

}