import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IssuesService {


  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);

  getIdentifications(idProject: number): Observable<any[]>  {
    return this.http.get<any[]>(`${environment.urlSmp}/Identification?idProject=${idProject}`, { headers: this.trackingService.getHeaders() });
  }

  addIdentification(data: any): Observable<any> {
    return this.http.post<any[]>(`${environment.urlSmp}/Identification`, data, { headers: this.trackingService.getHeaders() });
  }
  
  updateIdentification(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlSmp}/Identification/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteIdentification(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlSmp}/Identification/${id}`, { headers: this.trackingService.getHeaders() });
  }


}
