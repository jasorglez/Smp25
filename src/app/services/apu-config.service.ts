import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface ApuConfig {
  id?: number;
  idCompany: number;
  idContract: number;
  companyName: string;
  subdirection: string;
  anexoLabel: string;
  analysisTitle: string;
  licitacionNo: string;
  projectTitle: string;
  active?: boolean;
}

export const APU_CONFIG_DEFAULTS: ApuConfig = {
  idCompany:     0,
  idContract:    0,
  companyName:   'PEMEX EXPLORACION Y PRODUCCION',
  subdirection:  'SUBDIRECCION DE LA COORDINACION DE SERVICIOS MARINOS',
  anexoLabel:    'ANEXO "H"',
  analysisTitle: 'ANALISIS DE PRECIOS UNITARIOS',
  licitacionNo:  '',
  projectTitle:  '',
};

@Injectable({ providedIn: 'root' })
export class ApuConfigService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  get(idContract: number, idCompany: number): Observable<ApuConfig> {
    return this.http.get<ApuConfig>(
      `${environment.urlSmp}/ApuConfig?idContract=${idContract}&idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  save(config: ApuConfig): Observable<ApuConfig> {
    return this.http.post<ApuConfig>(
      `${environment.urlSmp}/ApuConfig`,
      config,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
