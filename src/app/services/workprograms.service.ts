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

  getWorkprograms(id: number, type: string) {
    return this.http.get(`${environment.urlSmp}/Workprogram/${id}/${type}`, { headers: this.trackingService.getHeaders() });
  }
}
