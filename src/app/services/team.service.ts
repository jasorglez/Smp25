import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class TeamService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getAll(idBranch: string): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/Team?idBranch=${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getById(id: number): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/Team/${id}`, { headers: this.trackingService.getHeaders() });
  }

  add(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/Team`, data, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlMantenimiento}/Team/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/Team/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getMembers(idTeam: number): Observable<any> {
    return this.http.get(`${environment.urlMantenimiento}/TeamMember?idTeam=${idTeam}`, { headers: this.trackingService.getHeaders() });
  }

  addMember(data: any): Observable<any> {
    return this.http.post(`${environment.urlMantenimiento}/TeamMember`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteMember(id: number): Observable<any> {
    return this.http.delete(`${environment.urlMantenimiento}/TeamMember/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
