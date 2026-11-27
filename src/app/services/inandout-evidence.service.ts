import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class InandoutEvidenceService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByInandout(idInandout: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/InandoutEvidence/${idInandout}`, { headers: this.trackingService.getHeaders() });
  }

  getCounts(idInandoutList: number[]): Observable<any> {
    if (!idInandoutList.length) return new Observable(subscriber => { subscriber.next({}); subscriber.complete(); });
    const query = idInandoutList.map(id => `idInandoutList=${id}`).join('&');
    return this.http.get(`${environment.urlWarehouse}/InandoutEvidence/counts?${query}`, { headers: this.trackingService.getHeaders() });
  }

  add(data: { idInandout: number; image: string; comment?: string }): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/InandoutEvidence`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${environment.urlWarehouse}/InandoutEvidence/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
