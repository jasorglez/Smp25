import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CaracteristicaEntrada {
  id?: number;
  idEntrada: number;
  idCategory: number;
  categoryName: string;
  familySelected: string;
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CaracteristicasEntradaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.urlProduction}/CaracteristicasEntrada`;

  create(payload: CaracteristicaEntrada): Observable<any> {
    return this.http.post(`${this.apiUrl}`, payload);
  }

  update(id: number, payload: CaracteristicaEntrada): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, payload);
  }

  getByEntrada(idEntrada: number): Observable<CaracteristicaEntrada[]> {
    return this.http.get<CaracteristicaEntrada[]>(`${this.apiUrl}/byEntrada/${idEntrada}`);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
