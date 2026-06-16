import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class ProdTerminadoService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }


  getProdTerminado(idRoot: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog/getProdterm?idCompany=${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

}
