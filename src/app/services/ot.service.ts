import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface OtSearchRequest {
  cdc?: string;
  otNumber?: string;
  area?: string;
  cuadrilla?: string;
  status?: string;
  closedWeb?: string;
  closedApp?: string;
  hasPhotos?: string;
  hasPersonal?: string;
  hasMaterial?: string;
  hasEquipment?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OtSearchResponse {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OtSearchOptionsResponse {
  areas: string[];
  cuadrillas: string[];
}

export interface OtCrewEfficiencyRow {
  crew: string;
  registered: number;
  closed: number;
}

export interface LogbookQueryResponse {
  success?: boolean;
  data?: any[];
  message?: string;
}

export interface LogbookPresentationResponse {
  success?: boolean;
  data?: Array<{
    id: number;
    idOt?: number | null;
    idProject?: number | null;
    typeNote?: string | null;
    date?: string | null;
    description?: string | null;
    resourceName?: string | null;
    imageUrl?: string | null;
    quantity?: number | null;
    supervisor?: string | null;
    cuadrilla?: string | null;
    validated?: string | null;
  }>;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OtService {

  constructor() { }

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);

  getOtList(): Observable<any> {
    return this.http.get(`${environment.urlSmp}/OT`, { headers: this.trackingService.getHeaders() });
  }

  searchOt(request: OtSearchRequest): Observable<OtSearchResponse | any[]> {
    const params: Record<string, string | number> = {};

    Object.entries(request).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = typeof value === 'string' ? value.trim() : value;
      }
    });

    return this.http.get<OtSearchResponse | any[]>(`${environment.urlSmp}/OT/search`, {
      headers: this.trackingService.getHeaders(),
      params
    });
  }

  getOtSearchOptions(): Observable<OtSearchOptionsResponse> {
    return this.http.get<OtSearchOptionsResponse>(`${environment.urlSmp}/OT/search-options`, {
      headers: this.trackingService.getHeaders()
    });
  }

  getCrewEfficiency(from: string, to: string, useWebClosure = false): Observable<OtCrewEfficiencyRow[]> {
    return this.http.get<OtCrewEfficiencyRow[]>(`${environment.urlSmp}/OT/crew-efficiency`, {
      headers: this.trackingService.getHeaders(),
      params: { from, to, useWebClosure }
    });
  }

  get2fieldsByPect(idProject: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/OT/2fields?idProject=${idProject}`, { headers: this.trackingService.getHeaders() });
  }

  getOtListByProject(idProject: number, close: boolean): Observable<any> {
    return this.http.get(`${environment.urlSmp}/OT/projects/${idProject}?close=${close}`, { headers: this.trackingService.getHeaders() });
  }

  getOtAllt(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/OT/reports/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  getOtDetails(idOt: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/OT/${idOt}`, { headers: this.trackingService.getHeaders() });
  }

  getLogbooksByOt(otId: number, typeNote?: string): Observable<LogbookQueryResponse> {
    const params: Record<string, string> = {};

    if (typeNote && typeNote.trim()) {
      params['typeNote'] = typeNote.trim();
    }

    return this.http.get<LogbookQueryResponse>(`${environment.urlSmp}/Logbook/ots/${otId}`, {
      headers: this.trackingService.getHeaders(),
      params
    });
  }

  getLogbooksPresentationByOt(otId: number, typeNote?: string): Observable<LogbookPresentationResponse> {
    const params: Record<string, string> = {};

    if (typeNote && typeNote.trim()) {
      params['typeNote'] = typeNote.trim();
    }

    return this.http.get<LogbookPresentationResponse>(`${environment.urlSmp}/Logbook/ots/${otId}/presentation`, {
      headers: this.trackingService.getHeaders(),
      params
    });
  }

  addOt(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/OT`, data, { headers: this.trackingService.getHeaders() });
  }

  updateOt(idOt: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/OT/${idOt}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteOt(idOt: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/OT/${idOt}`, { headers: this.trackingService.getHeaders() });
  }

  addOtViaPdf(idProject: number, pdfFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', pdfFile, pdfFile.name);

    // Crear headers simples que coincidan con el curl
    const baseHeaders = this.trackingService.getHeaders();
    console.log('Base headers from trackingService:', baseHeaders);

    // Crear un objeto headers limpio
    const headers: any = {
      'accept': '*/*'
    };

    // Extraer Authorization del HttpHeaders usando el método get()
    const authToken = baseHeaders.get('Authorization') || baseHeaders.get('authorization');
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    console.log('Authorization token found:', authToken);
    console.log('Final headers being sent:', headers);
    console.log('FormData being sent:', formData);
    console.log('Endpoint:', `${environment.urlSmp}/OT/upload?idProject=${idProject}`);

    return this.http.post(`${environment.urlSmp}/OT/upload?idProject=${idProject}`, formData, { headers });
  }

  addOtViaPdfCopy(idProject: number, pdfFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', pdfFile, pdfFile.name);

    // Crear headers simples que coincidan con el curl
    const baseHeaders = this.trackingService.getHeaders();
    console.log('Base headers from trackingService:', baseHeaders);

    // Crear un objeto headers limpio
    const headers: any = {
      'accept': '*/*'
    };

    // Extraer Authorization del HttpHeaders usando el método get()
    const authToken = baseHeaders.get('Authorization') || baseHeaders.get('authorization');
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    console.log('Authorization token found:', authToken);
    console.log('Final headers being sent:', headers);
    console.log('FormData being sent:', formData);
    console.log('Endpoint:', `${environment.urlSmp}/OT/uploadCopy?idProject=${idProject}`);

    return this.http.post(`${environment.urlSmp}/OT/uploadCopy?idProject=${idProject}`, formData, { headers });
  }
  addOtViaPdfMaster(idProject: number, pdfFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', pdfFile, pdfFile.name);

    // Crear headers simples que coincidan con el curl
    const baseHeaders = this.trackingService.getHeaders();
    console.log('Base headers from trackingService:', baseHeaders);

    // Crear un objeto headers limpio
    const headers: any = {
      'accept': '*/*'
    };

    // Extraer Authorization del HttpHeaders usando el método get()
    const authToken = baseHeaders.get('Authorization') || baseHeaders.get('authorization');
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    console.log('Authorization token found:', authToken);
    console.log('Final headers being sent:', headers);
    console.log('FormData being sent:', formData);
    console.log('Endpoint:', `${environment.urlSmp}/OT/uploadMaster?idProject=${idProject}`);

    return this.http.post(`${environment.urlSmp}/OT/uploadMaster?idProject=${idProject}`, formData, { headers });
  }
  addExcelExt(excelFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', excelFile, excelFile.name);

    // Crear headers simples que coincidan con el curl
    const baseHeaders = this.trackingService.getHeaders();
    console.log('Base headers from trackingService:', baseHeaders);

    // Crear un objeto headers limpio
    const headers: any = {
      'accept': '*/*'
    };

    // Extraer Authorization del HttpHeaders usando el método get()
    const authToken = baseHeaders.get('Authorization') || baseHeaders.get('authorization');
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    return this.http.post(`${environment.urlSmp}/ProcesadorExcel/procesar`, formData, { headers });
  }
  addExcelInt(excelFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', excelFile, excelFile.name);

    // Crear headers simples que coincidan con el curl
    const baseHeaders = this.trackingService.getHeaders();
    console.log('Base headers from trackingService:', baseHeaders);

    // Crear un objeto headers limpio
    const headers: any = {
      'accept': '*/*'
    };

    // Extraer Authorization del HttpHeaders usando el método get()
    const authToken = baseHeaders.get('Authorization') || baseHeaders.get('authorization');
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    return this.http.post(`${environment.urlSmp}/ProcesadorExcel/procesarInt`, formData, { headers });
  }

  reopenOt(idOt: number): Observable<any> {
    return this.http.put(`${environment.urlSmp}/OT/${idOt}/reopen`, null, { headers: this.trackingService.getHeaders() });
  }

}
