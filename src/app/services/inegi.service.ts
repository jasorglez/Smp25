import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InegiService {

  private baseUrl = 'https://gaia.inegi.org.mx/wscatgeo';

private http = inject(HttpClient) ;

  getEstados(): Observable<any> {
    return this.http.get(`${this.baseUrl}/mgee`);
  }

  getMunicipios(estadoId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/mgem/${estadoId}`);
  }


  constructor() { }
}
