import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})

export class ReceivedataService {

  constructor(private httpClient: HttpClient, private trackingService: TrackingService) { }

  recibirDatos(urlAzure: string, dater: string, id: number): Observable<any[]> {
    var apiUrl = `${urlAzure}?lb=${dater}&id=${id}`;
    //alert(apiUrl)  ;
    return this.httpClient.get<any[]>(apiUrl);
  }

  recibirDatos2(urlAzure: string, dater: string, id: number): Observable<any[]> {
    var apiUrl = `${urlAzure}?lb=${dater}&id=${id}`;
    return this.httpClient.get<any[]>(apiUrl);
  }

  recibirDatosForOt(dater: string, id: number): Observable<any[]> {
    var apiUrl = `${environment.urlBpi}/Logbook?lb=${dater}&id=${id}`;
    //alert(apiUrl)  ;
    return this.httpClient.get<any[]>(apiUrl, {
      headers: this.trackingService.getHeaders(),
    });
  }

  receiveUsers(urlApi: string, moduleName: string): Observable<any[]> {
    var apiUrl = `${urlApi}/${moduleName}.json`;
    return this.httpClient.get<any[]>(apiUrl);
  }

  recibirFotos(dater: string, id: number): Observable<any[]> {
    var apiUrl = `${environment.urlBpi}/Logbook/showphotos?lb=${dater}&id=${id}`;
    return this.httpClient.get<any[]>(apiUrl, {
      headers: this.trackingService.getHeaders(),
    });
  }

  recibirNombreObra(id: number): Observable<any> {
    var apiUrl = `${environment.urlBpi}/Project/find/${id}`;
    return this.httpClient.get<any>(apiUrl, {
      headers: this.trackingService.getHeaders(),
    });
  }

}
