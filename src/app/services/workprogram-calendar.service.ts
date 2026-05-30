import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

export interface WorkprogramCalendar {
  id?:          number;
  idProject:    number;
  idContract?:  number | null;
  idConvention?: number | null;
  lunes:    boolean;
  martes:   boolean;
  miercoles: boolean;
  jueves:   boolean;
  viernes:  boolean;
  sabado:   boolean;
  domingo:  boolean;
  active?:  number;
}

@Injectable({ providedIn: 'root' })
export class WorkprogramCalendarService {
  private api = environment.urlSmp;
  private http = inject(HttpClient);
  private track = inject(TrackingService);

  get(idProject: number, idContract?: number | null, idConvention?: number | null): Observable<WorkprogramCalendar> {
    let url = `${this.api}/WorkprogramCalendar?idProject=${idProject}`;
    if (idContract)   url += `&idContract=${idContract}`;
    if (idConvention) url += `&idConvention=${idConvention}`;
    return this.http.get<WorkprogramCalendar>(url, { headers: this.track.getHeaders() });
  }

  save(data: WorkprogramCalendar): Observable<any> {
    return this.http.post(`${this.api}/WorkprogramCalendar`, data, { headers: this.track.getHeaders() });
  }

  update(id: number, data: WorkprogramCalendar): Observable<any> {
    return this.http.put(`${this.api}/WorkprogramCalendar/${id}`, data, { headers: this.track.getHeaders() });
  }
}
