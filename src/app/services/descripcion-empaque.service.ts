import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface DescripcionEmpaque {
  id?: number;
  idCompany: number;
  descripcion: string;
  active: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class DescripcionEmpaqueService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get headers() { return this.trackingService.getHeaders(); }

  getByCompany(idCompany: number): Observable<DescripcionEmpaque[]> {
    return this.http.get<DescripcionEmpaque[]>(
      `${environment.urlWarehouse}/DescripcionEmpaque/${idCompany}`,
      { headers: this.headers }
    );
  }

  create(data: DescripcionEmpaque): Observable<DescripcionEmpaque> {
    return this.http.post<DescripcionEmpaque>(
      `${environment.urlWarehouse}/DescripcionEmpaque`,
      data,
      { headers: this.headers }
    );
  }

  update(id: number, data: DescripcionEmpaque): Observable<DescripcionEmpaque> {
    return this.http.put<DescripcionEmpaque>(
      `${environment.urlWarehouse}/DescripcionEmpaque/${id}`,
      data,
      { headers: this.headers }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/DescripcionEmpaque/${id}`,
      { headers: this.headers }
    );
  }
}
