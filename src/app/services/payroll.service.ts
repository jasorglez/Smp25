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
  codigoEmpleado: string;
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

  private apiURL = `${environment.urlAdministration}/payroll`;
  private apiURLJG = `${environment.urlAdministrationJG}/payroll`;
  private apiUrlLocalJG = `${environment.urlLocalJG}/payroll`;
  private apiUrlLocalJGEmployeesByPayroll = `${environment.urlLocalJG}/payroll`

  //getEmployees(idBranch: number) {
  //  return this.http.get(`${environment.urlAdministration}/Employee/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  //}

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getPayrolls(): Observable<PayrollData[]> {
    return this.http.get<PayrollData[]>(this.apiUrlLocalJG);
  }

  getEmployeesByPayroll(idPayroll: number): Observable<any> {
    return this.http.get<EmployeePayroll[]>(this.apiURLJG);
    //`${environment.urlAdministration}/LoansAndCredits/employee/${idEmployee}?Type=${type}`, {headers: this.trackingService.getHeaders()}
  }

  //addEmployeeClock(data: any): Observable<any> {
  //  return this.http.post(`${environment.urlAdministration}/EmployeesXClock`, data, { headers: this.trackingService.getHeaders() });
  //}

  uploadPayrollData(data: any): Observable<any> {
    console.log("------------ UPLOADPAYROLLDATA() entrando al servicio payroll, la api original es: ", this.apiURLJG);
    console.log("------------ UPLOADPAYROLLDATA() entrando al servicio payroll, la API CORRECTA es: ", this.apiURL);
    console.log("------------ UPLOADPAYROLLDATA() entrando al servicio payroll, la data es: ", data);
    //var x = this.http.post<any>(this.apiUrl, data);
    //console.log("------------ UPLOADPAYROLLDATA() saliendo del servicio payroll, la respuesta ORIGINAL es: ", x);
    //var x = this.http.post<any>(this.apiURL, data);
    //console.log("------------ UPLOADPAYROLLDATA() saliendo del servicio payroll, la respuesta VERDADERA es: ", x);
    return this.http.post<any>(this.apiUrl, data);
  }
}
