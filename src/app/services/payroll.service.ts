import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private apiUrl = 'http://localhost:5047/api/payroll';

  constructor(private http: HttpClient) {}

  uploadPayrollData(data: any): Observable<any> {
    console.log("------------ UPLOADPAYROLLDATA() entrando al servicio payroll, la data es: ", data);
    var x = this.http.post<any>(this.apiUrl, data);
    console.log("------------ UPLOADPAYROLLDATA() saliendo del servicio payroll, la respuesta es: ", x);
    return this.http.post<any>(this.apiUrl, data);
  }
}

