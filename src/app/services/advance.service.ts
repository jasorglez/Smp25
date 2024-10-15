import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdvanceService {
  private apiUrl = environment.urlSmp;
  private http = inject(HttpClient);
  constructor() { }

  getAdvancesByContract(contractId: number, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Advanced/${contractId}/${type}`);
  }

  getAdvancesByProject(projectId: number, type: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Advanced/${projectId}/${type}`);
  }

  addAdvance(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Advanced`, data);
  }

  updateAdvance(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/Advanced/${id}`, data);
  }

  deleteAdvance(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Advanced/${id}`);
  } 
}
