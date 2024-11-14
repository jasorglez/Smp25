import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class MaterialsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getMaterials() {
    return this.http.get(`${environment.urlWarehouse}/Material/1`, { headers: this.trackingService.getHeaders() });
  }

  addMaterial(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Material`, data, { headers: this.trackingService.getHeaders() });
  }

  updateMaterial(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Material/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteMaterial(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Material/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
