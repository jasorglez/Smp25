import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { TrackingService } from './tracking.service';
import { CreatorPermissionService } from './creator-permission.service';

@Injectable({
  providedIn: 'root'
})
export class WarehousesService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private creatorPermissionService = inject(CreatorPermissionService);

  getWarehouses(idRoot: number) {
    return this.http.get(`${environment.urlWarehouse}/Warehouse?idBranch=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  addWarehouse(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Warehouse`, data, { headers: this.trackingService.getHeaders() }).pipe(
      switchMap(created => this.creatorPermissionService.grantToCreator('warehouse', created))
    );
  }

  updateWarehouse(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlWarehouse}/Warehouse/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteWarehouse(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlWarehouse}/Warehouse/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getSimpleWarehouses(idBranch: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Warehouse/2fields?idBranch=${idBranch}`, { headers: this.trackingService.getHeaders() });
  }


}
