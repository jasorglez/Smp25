import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface SetupOcDto {
  id?: number;
  idCompany: number;
  idBranch?: number;
  entregaMin: number;
  entregaMax: number | null;
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class SetupOcService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByCompany(idCompany: number): Observable<SetupOcDto> {
    return this.http.get<SetupOcDto>(`${environment.urlWarehouse}/SetupOc/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getByBranch(idBranch: number): Observable<SetupOcDto> {
    return this.http.get<SetupOcDto>(`${environment.urlWarehouse}/SetupOc/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  save(idCompany: number, data: SetupOcDto): Observable<SetupOcDto> {
    return this.http.post<SetupOcDto>(`${environment.urlWarehouse}/SetupOc/${idCompany}`, data, { headers: this.trackingService.getHeaders() });
  }

  saveByBranch(idBranch: number, data: SetupOcDto): Observable<SetupOcDto> {
    return this.http.post<SetupOcDto>(`${environment.urlWarehouse}/SetupOc/branch/${idBranch}`, data, { headers: this.trackingService.getHeaders() });
  }
}
