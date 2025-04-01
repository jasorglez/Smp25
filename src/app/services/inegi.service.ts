import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class InegiService {

  private baseUrl = 'https://gaia.inegi.org.mx/wscatgeo';

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getEstados(): Observable<any> {
    return this.http.get(`${this.baseUrl}/mgee`);
  }

  getMunicipios(estadoId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/mgem/${estadoId}`);
  }

  getZipCodeData(zipCode: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/ZipCodes/${zipCode}`, { headers: this.trackingService.getHeaders()});
  }
}
