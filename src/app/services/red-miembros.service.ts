import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { IRedMiembro } from 'app/interface/ired-miembro';

@Injectable({ providedIn: 'root' })
export class RedMiembrosService {
  private http           = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private base           = `${environment.urlAdministration}/RedMiembros`;

  getByRoot(idRoot: number): Observable<IRedMiembro[]> {
    return this.http.get<IRedMiembro[]>(
      `${this.base}/root/${idRoot}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<IRedMiembro> {
    return this.http.get<IRedMiembro>(
      `${this.base}/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(miembro: Partial<IRedMiembro>): Observable<IRedMiembro> {
    return this.http.post<IRedMiembro>(
      this.base,
      miembro,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, miembro: Partial<IRedMiembro>): Observable<IRedMiembro> {
    return this.http.put<IRedMiembro>(
      `${this.base}/${id}`,
      miembro,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getAfiliados(idRoot: number): Observable<IRedMiembro[]> {
    return this.http.get<IRedMiembro[]>(
      `${this.base}/afiliados/${idRoot}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
