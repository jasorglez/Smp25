import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

export interface DailySummary {
  date:        string;
  ponderadoDia: number;   // avance PROGRAMADO del día
  numConceptos: number;
}

export interface GenerateResult {
  success:              boolean;
  conceptosProcesados:  number;
  filasGeneradas:       number;
  filasBorradas:        number;
  mensaje:              string;
}

@Injectable({ providedIn: 'root' })
export class WorkprogramDailyService {
  private api = environment.urlSmp;
  private http = inject(HttpClient);
  private track = inject(TrackingService);

  /** Resumen agrupado por día — para las barras del frontend */
  getSummary(
    idProject: number,
    idContract?: number | null,
    idConvention?: number | null,
    from?: string,
    to?: string
  ): Observable<DailySummary[]> {
    let url = `${this.api}/WorkprogramDaily/summary?idProject=${idProject}`;
    if (idContract)   url += `&idContract=${idContract}`;
    if (idConvention) url += `&idConvention=${idConvention}`;
    if (from)         url += `&from=${from}`;
    if (to)           url += `&to=${to}`;
    return this.http.get<DailySummary[]>(url, { headers: this.track.getHeaders() });
  }

  /** GENERA toda la distribución diaria en el servidor */
  generate(idProject: number, idContract?: number | null, idConvention?: number | null): Observable<GenerateResult> {
    return this.http.post<GenerateResult>(
      `${this.api}/WorkprogramDaily/generate`,
      { idProject, idContract: idContract ?? null, idConvention: idConvention ?? null },
      { headers: this.track.getHeaders() }
    );
  }

  /** Borra distribución para regenerar */
  deleteByProject(idProject: number, idContract?: number | null, idConvention?: number | null): Observable<any> {
    let url = `${this.api}/WorkprogramDaily?idProject=${idProject}`;
    if (idContract)   url += `&idContract=${idContract}`;
    if (idConvention) url += `&idConvention=${idConvention}`;
    return this.http.delete(url, { headers: this.track.getHeaders() });
  }
}
