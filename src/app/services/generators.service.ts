import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class GeneratorsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getGenerators(idEstimacion: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Generators?idEstimacion=${idEstimacion}`, { headers: this.trackingService.getHeaders() });
  }

  addGenerator(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Generators`, data, { headers: this.trackingService.getHeaders() });
  }

  updateGenerator(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Generators/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteGenerator(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Generators/${id}`, { headers: this.trackingService.getHeaders() });
  }

  // Métodos para Items del Generador (Detalle)
  getItemsGeneradores(idType: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/ItemsGeneradoresEstimates?idType=${idType}&Type=GENERADOR`, { headers: this.trackingService.getHeaders() });
  }

  getItemsEstimaciones(idType: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/ItemsGeneradoresEstimates?idType=${idType}&Type=ESTIMACION`, { headers: this.trackingService.getHeaders() });
  }


  addItemGenerador(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/ItemsGeneradoresEstimates`, data, { headers: this.trackingService.getHeaders() });
  }

  updateItemGenerador(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/ItemsGeneradoresEstimates/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteItemGenerador(id: number, type: 'GENERADOR' | 'ESTIMACION' = 'GENERADOR'): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/ItemsGeneradoresEstimates/${id}`, {
      headers: this.trackingService.getHeaders(),
      params: { Type: type },
    });
  }
}
