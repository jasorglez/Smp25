import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class WorkprogramsService {

  constructor(private http: HttpClient) { }

  private trackingService = inject(TrackingService);

  getWorkPrograms(id: number, type: string) {
    return this.http.get(`${environment.urlSmp}/Workprogram/${id}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  addWorkProgram(data: any) {
    return this.http.post(`${environment.urlSmp}/Workprogram`, data, { headers: this.trackingService.getHeaders() });
  }

  updateWorkProgram(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Workprogram/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteWorkProgram(id: number) {
    return this.http.delete(`${environment.urlSmp}/Workprogram/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
