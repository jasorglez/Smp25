import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class CatalogsService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  getMeasures(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Measure`, { headers: this.trackingService.getHeaders() });
  }

  getPhases(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Fase`, { headers: this.trackingService.getHeaders() });
  }

  getFamilies(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Family`, { headers: this.trackingService.getHeaders() });
  }

  getLocations(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/Catalog?type=Ubication`, { headers: this.trackingService.getHeaders() });
  }
}
