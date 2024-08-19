import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class ReceivedataService {

  constructor(private httpClient: HttpClient) { }

  recibirDatos(urlAzure: string, dater: string, id: number): Observable<any[]> {
    var apiUrl = `${urlAzure}?lb=${dater}&id=${id}`;
    //alert(apiUrl)  ;
    return this.httpClient.get<any[]>(apiUrl);
  }

  recibirDatos2(urlAzure: string, dater: string, id: number): Observable<any[]> {
    var apiUrl = `${urlAzure}?lb=${dater}&id=${id}`;
    return this.httpClient.get<any[]>(apiUrl);
  }
}
