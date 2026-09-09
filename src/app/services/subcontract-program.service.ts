import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class SubcontractProgramService {
  private http = inject(HttpClient);
  private tracking = inject(TrackingService);
  private readonly url = `${environment.urlSmp}/Project/subcontract-programs`;

  get(idRoot: number, idProvider?: number, idProject?: number) {
    const params: any = { idRoot };
    if (idProvider) params.idProvider = idProvider;
    if (idProject) params.idProject = idProject;
    return this.http.get<any[]>(this.url, { params, headers: this.tracking.getHeaders() });
  }
  getById(id: number) { return this.http.get<any>(`${this.url}/${id}`, { headers: this.tracking.getHeaders() }); }
  save(program: any) {
    return program.id ? this.http.put<any>(`${this.url}/${program.id}`, program, { headers: this.tracking.getHeaders() })
      : this.http.post<any>(this.url, program, { headers: this.tracking.getHeaders() });
  }
  saveItems(id: number, items: any[]) { return this.http.put<any[]>(`${this.url}/${id}/items`, items, { headers: this.tracking.getHeaders() }); }
}
