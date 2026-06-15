import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class WorkorderService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getAll(idBranch: string): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/WorkOrder?idBranch=${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getById(id: number): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/WorkOrder/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getByStatus(idBranch: string, status: string): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/WorkOrder/status?idBranch=${idBranch}&status=${status}`, { headers: this.trackingService.getHeaders() });
  }

  add(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/WorkOrder`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlMantenimiento}/WorkOrder/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  updateStatus(id: number, status: string): Observable<any> {
    return this.http.patch(`${environment.urlMantenimiento}/WorkOrder/${id}/status`, JSON.stringify(status), { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/WorkOrder/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getByAsset(assetId: string | number): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/WorkOrder/asset/${assetId}`, { headers: this.trackingService.getHeaders() });
  }
}
