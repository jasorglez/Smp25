import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class DepartmentsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getDepartments(idCompany: number) {
    return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idCompany}&type=departament`, { headers: this.trackingService.getHeaders() });
  }
}
