import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private apiUrl = 'https://localhost:7065/api/Payroll';

  constructor(private http: HttpClient) {}

  uploadPayrollData(data: any): Observable<any> {
    console.log("entrando al servicio payroll, la data es: ", data);
    return this.http.post<any>(this.apiUrl, data);
  }
}

