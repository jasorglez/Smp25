import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class WorkprogramApuCuadrillaService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByWorkprogram(idWorkprogram: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla?idWorkprogram=${idWorkprogram}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  saveCuadrilla(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla/cuadrilla`,
      data, { headers: this.trackingService.getHeaders() }
    );
  }

  updateCuadrilla(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla/cuadrilla/${id}`,
      data, { headers: this.trackingService.getHeaders() }
    );
  }

  deleteCuadrilla(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla/cuadrilla/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  saveItem(data: any): Observable<any> {
    return this.http.post<any>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla/item`,
      data, { headers: this.trackingService.getHeaders() }
    );
  }

  updateItem(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla/item/${id}`,
      data, { headers: this.trackingService.getHeaders() }
    );
  }

  deleteItem(id: number): Observable<any> {
    return this.http.delete<any>(
      `${environment.urlSmp}/WorkprogramApuCuadrilla/item/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
