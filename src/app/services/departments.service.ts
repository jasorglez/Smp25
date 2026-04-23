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

  getDepartments(idCompany?: number) {
    // Si idCompany es 0 o undefined, cargar de TODOS los idCompany
    if (idCompany && idCompany > 0) {
      return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idCompany}&type=DEPARTAMENT`, { headers: this.trackingService.getHeaders() });
    } else {
      // Cargar de múltiples idCompany (0 significa todos)
      return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=0&type=DEPARTAMENT`, { headers: this.trackingService.getHeaders() });
    }
  }
}
