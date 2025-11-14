import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class FamilySubFamily {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  constructor() { }

  getCatalogsFamilySubFamily(idCompany: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlWarehouse}/FamilySubFamilyDelison/Get?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

}
