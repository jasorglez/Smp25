import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, throttleTime } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class LogbookService {

  private http = inject(HttpClient);
  private authService = inject(TrackingService)

  getLB(dater: string, id: Number): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Logbook?lb=${dater}&id=${id}`;
      // alert(apiUrl)
      return this.http.get(apiUrl);
    } catch (error) {
      console.error("Error Get LogBook", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }

  //llamo al servicio...

  fetchImages(dater: Date, id: Number): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Logbook/showphotos?lb=${dater}&id=&${id}`;
      return this.http.get(apiUrl);
    } catch (error) {
      console.error('Error fetching images:', error);
      return EMPTY;
    }
  }

  getInfoByOt(idOt: number, typeNote: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Logbook/ots/${idOt}?typeNote=${typeNote}`, { headers: this.authService.getHeaders() });
  }

  getInfoByReporte(idReporte: number, typeNote: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Logbook/reporte/${idReporte}?typeNote=${typeNote}`, { headers: this.authService.getHeaders() });
  }

  addDataForOt(data: any): Observable<any> {
    console.log('Adding data for OT:', data);
    return this.http.post(`${environment.urlSmp}/Logbook`, data, { headers: this.authService.getHeaders() });
  }

  updateDataForOt(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Logbook/${id}`, data, { headers: this.authService.getHeaders() });
  }

  deleteDataForOt(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Logbook/${id}`, { headers: this.authService.getHeaders() });
  }

  getNotesFromReport(idReport: number, typeNote: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/Logbook/reporte/${idReport}?typeNote=${typeNote}`, { headers: this.authService.getHeaders() })
  }

}
