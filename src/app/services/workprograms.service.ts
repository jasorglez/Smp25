import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WorkprogramsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getWorkPrograms(id: number, type: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/${id}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  getWorkProgramsWithoutType(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getWorkPrograms2Fields(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/Workprogram/2fields?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }

  addWorkProgram(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Workprogram`, data, { headers: this.trackingService.getHeaders() });
  }

  updateWorkProgram(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Workprogram/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  /** PATCH — actualiza SOLO el campo progress (0-1). Usado por Captura Diaria (Punto 6). */
  patchWorkProgramProgress(id: number, progress: number): Observable<any> {
    return this.http.patch(`${environment.urlSmp}/Workprogram/${id}/progress`, { progress }, { headers: this.trackingService.getHeaders() });
  }

  /** PATCH — actualiza SOLO el campo ponderado. Usado por Calcular Ponderado PMO. */
  patchWorkProgramPonderado(id: number, ponderado: number | null): Observable<any> {
    return this.http.patch(`${environment.urlSmp}/Workprogram/${id}/ponderado`, { ponderado }, { headers: this.trackingService.getHeaders() });
  }

  /** POST /Workprogram/batch — inserta N workprograms en 1 transacción (max 2000). */
  addWorkProgramBatch(items: any[]): Observable<{ inserted: number; message: string }> {
    return this.http.post<{ inserted: number; message: string }>(
      `${environment.urlSmp}/Workprogram/batch`, items, { headers: this.trackingService.getHeaders() });
  }

  /** PATCH /Workprogram/batch-ponderado — actualiza ponderado de N tareas en 1 transacción (max 2000). */
  patchWorkProgramPonderadoBatch(items: { id: number; ponderado: number | null }[]): Observable<{ updated: number; message: string }> {
    return this.http.patch<{ updated: number; message: string }>(
      `${environment.urlSmp}/Workprogram/batch-ponderado`, items, { headers: this.trackingService.getHeaders() });
  }

  deleteWorkProgram(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Workprogram/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getActivities(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/onlyactivities?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getFathers(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/onlyfathers?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }


  getActivitiesTMDB(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/onlyactivitiesTMDB?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getFathersTMDB(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/onlyfathersTMDB?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }


  getConceptsHierarchy(id: number, idConvention?: number | null): Observable<any[]> {
    const conventionParam = idConvention != null ? `&idConvention=${idConvention}` : '';
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/concepts-hierarchy?idProject=${id}${conventionParam}`, { headers: this.trackingService.getHeaders() });
  }

  getConceptsBySubpartida(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/concepts-subpartidas?idProject=${id}`, { headers: this.trackingService.getHeaders() });
  }

  getByConvention(idConvention: number, idProject?: number): Observable<any[]> {
    const projectParam = idProject ? `&idProject=${idProject}` : '';
    return this.http.get<any[]>(`${environment.urlSmp}/Workprogram/byconvention?idConvention=${idConvention}${projectParam}`, { headers: this.trackingService.getHeaders() });
  }

  copyFromConvention(sourceConventionId: number, targetConventionId: number, idProject?: number): Observable<{ copied: number; message: string }> {
    return this.http.post<{ copied: number; message: string }>(
      `${environment.urlSmp}/Workprogram/copy-convention`,
      { sourceConventionId, targetConventionId, idProject: idProject ?? null },
      { headers: this.trackingService.getHeaders() }
    );
  }

  copyContractActivitiesToProject(
    idContract: number,
    idProject: number,
    sourceWorkprogramIds: number[],
    idConvention?: number | null,
    items?: { sourceWorkprogramId: number; quantity: number }[],
    resourceTypes?: string[]
  ): Observable<{ copied: number; message: string }> {
    return this.http.post<{ copied: number; message: string }>(
      `${environment.urlSmp}/Workprogram/copy-contract-to-project`,
      { idContract, idProject, idConvention: idConvention ?? null, sourceWorkprogramIds, items: items ?? [], resourceTypes: resourceTypes ?? null },
      { headers: this.trackingService.getHeaders() }
    );
  }

  getContractAllocation(idContract: number, idConvention: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/Workprogram/contract-allocation?idContract=${idContract}&idConvention=${idConvention}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getDelayedActivities(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Workprogram/delayed?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getAvanceProyectos(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Workprogram/avance?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

}
