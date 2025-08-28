import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

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

    getOtListByProject(idProject: number, close: boolean): Observable<any> {
      return this.http.get(`${environment.urlSmp}/OT/projects/${idProject}?close=${close}`, { headers: this.trackingService.getHeaders() });
    }

    getOtDetails(idOt: number): Observable<any> {
      return this.http.get(`${environment.urlSmp}/OT/${idOt}`, { headers: this.trackingService.getHeaders() });
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

  }