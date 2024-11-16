import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class RequisitionsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getOcAndReqs(idProject: number) {
    return this.http.get(`${environment.urlWarehouse}/Ocandreq?idProject=${idProject}`, { headers: this.trackingService.getHeaders() });
  }

  addOcAndReq(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Ocandreq`, data, { headers: this.trackingService.getHeaders() });
  }

  updateOcAndReq(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Ocandreq/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteOcAndReq(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Ocandreq/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
