import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

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

    getOtDetails(idOt: number): Observable<any> {
      return this.http.get(`${environment.urlSmp}/OT/${idOt}`, { headers: this.trackingService.getHeaders() });
    }

    addOt(data: any): Observable<any> {
      return this.http.post(`${environment.urlSmp}/OT`, data, { headers: this.trackingService.getHeaders() });
    }

    addOtViaPdf(idProject: number, pdfFile: File): Observable<any> {
      const formData = new FormData();
      formData.append('file', pdfFile);
      
      // Para subir archivos, no incluimos Content-Type en los headers
      // para que el navegador lo establezca automáticamente con el boundary correcto
      const headers = this.trackingService.getHeaders();
      delete headers['Content-Type']; // Removemos Content-Type para que se establezca automáticamente
      
      return this.http.post(`${environment.urlSmp}/OT/upload?idProject=${idProject}`, formData, { headers });
    }

  }