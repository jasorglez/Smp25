import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class ChecklistTemplateService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getAll(idCompany: number | string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlMantenimiento}/ChecklistTemplate?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getItems(idTemplate: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlMantenimiento}/ChecklistTemplate/${idTemplate}/items`, { headers: this.trackingService.getHeaders() });
  }

  add(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/ChecklistTemplate`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlMantenimiento}/ChecklistTemplate/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/ChecklistTemplate/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addItem(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/ChecklistTemplate/items`, data, { headers: this.trackingService.getHeaders() });
  }

  updateItem(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlMantenimiento}/ChecklistTemplate/items/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteItem(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/ChecklistTemplate/items/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
