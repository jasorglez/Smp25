import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class IdBlockPeriodsService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getIdBlockPeriods(idRoot: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlAdministration}/IdBlockPeriod/branch/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }
}