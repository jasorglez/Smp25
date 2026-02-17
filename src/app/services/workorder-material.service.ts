import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class WorkorderMaterialService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByWorkOrder(idWorkOrder: number): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/WorkOrderMaterial?idWorkOrder=${idWorkOrder}`, { headers: this.trackingService.getHeaders() });
  }

  add(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/WorkOrderMaterial`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlMantenimiento}/WorkOrderMaterial/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/WorkOrderMaterial/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
