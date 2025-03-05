import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PayrollData {
  id?: number;
  empresa?: string;
  periodo?: string;
  ejercicio?: string;
  empleados?: EmployeePayroll[];
  // Otros campos que pueda tener la respuesta
}

export interface EmployeePayroll {
  id?: number;
  nombre: string;
  diasTrabajados: number;
  salarioDiario: number;
  salarioDiarioIntegrado: number;
  sueldos: number;
  totalPercepciones: number;
  otrosIngresos: number;
  percepcionesGravadas: number;
  impuestoArt96: number;
  subsidioPEmpleo: number;
  ISPT: number;
  IMSS: number;
  IMSSEnfermedad: number;
  IMSSCesantiaVejez: number;
  neto: number;
  // Otros campos específicos de la nómina
}

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private apiUrl = 'http://localhost:5047/api/payroll';

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getPayrolls(): Observable<PayrollData[]> {
    return this.http.get<PayrollData[]>(this.apiUrl);
  }

  uploadPayrollData(data: any): Observable<any> {
    console.log("------------ UPLOADPAYROLLDATA() entrando al servicio payroll, la data es: ", data);
    var x = this.http.post<any>(this.apiUrl, data);
    console.log("------------ UPLOADPAYROLLDATA() saliendo del servicio payroll, la respuesta es: ", x);
    return this.http.post<any>(this.apiUrl, data);
  }
}