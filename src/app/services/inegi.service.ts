import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { CobranzaOfflineService } from './cobranza-offline.service';

@Injectable({
  providedIn: 'root'
})
export class InegiService {

  private baseUrl = 'https://gaia.inegi.org.mx/wscatgeo';

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private cobranzaOffline = inject(CobranzaOfflineService);

  getEstados(): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.cobranzaOffline.cachedRequest(this.cobranzaOffline.snapshotKey('mexico-states', companyId), 'estados', companyId,
      this.http.get(`${this.baseUrl}/mgee`));
  }

  getMunicipios(estadoId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/mgem/${estadoId}`);
  }

  getZipCodeData(zipCode: string): Observable<any> {
    const companyId = Number(localStorage.getItem('company') || 0);
    return this.cobranzaOffline.cachedRequest(this.cobranzaOffline.snapshotKey('zip-code', companyId, zipCode), 'código postal', companyId,
      this.http.get(`${environment.urlAdministration}/ZipCodes/${zipCode}`, { headers: this.trackingService.getHeaders()}));
  }
}
