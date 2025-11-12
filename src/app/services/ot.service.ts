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

    getOtAllt(idRoot: number): Observable<any> {
        return this.http.get(`${environment.urlSmp}/OT/reports/${idRoot}`, { headers: this.trackingService.getHeaders() });
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
      return this.http.put(`${environment.urlSmp}/OT/${idOt}/reopen`, { headers: this.trackingService.getHeaders() });
    }

  }