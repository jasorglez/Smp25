import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface ConsecutivoConfig {
  id: number;
  idRoot: number;
  consecutivoTexto: string;
  campoAuxiliar: number;
  __isNew?: boolean;
  __modified?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConsecutivosService {
  private http = inject(HttpClient);
  private tracking = inject(TrackingService);
  private readonly url = `${environment.urlAdministration}/Consecutivos`;

  getByRoot(idRoot: number): Observable<ConsecutivoConfig[]> {
    return this.http.get<ConsecutivoConfig[]>(`${this.url}/root/${idRoot}`, { headers: this.tracking.getHeaders() });
  }

  create(item: ConsecutivoConfig): Observable<ConsecutivoConfig> {
    return this.http.post<ConsecutivoConfig>(this.url, item, { headers: this.tracking.getHeaders() });
  }

  update(item: ConsecutivoConfig): Observable<void> {
    return this.http.put<void>(`${this.url}/${item.id}`, item, { headers: this.tracking.getHeaders() });
  }

  delete(id: number, idRoot: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/root/${idRoot}`, { headers: this.tracking.getHeaders() });
  }

  reserveNext(idRoot: number, prefix: string): Observable<{ folio: string; numero: number }> {
    return this.http.post<{ folio: string; numero: number }>(`${this.url}/siguiente/${idRoot}/${encodeURIComponent(prefix)}`, {}, { headers: this.tracking.getHeaders() });
  }
}
