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


  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

//  return this.http.get(`${environment.urlAdministration}/Employee/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });


  getPayrolls(idBranch: number): Observable<PayrollData[]> {
    return this.http.get<PayrollData[]>(`${environment.urlAdministration}/payroll/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getEmployeesByPayroll(idPayroll: number): Observable<any> {
    return this.http.get<EmployeePayroll[]>(`${environment.urlAdministration}/payroll`, { headers: this.trackingService.getHeaders() });
    //`${environment.urlAdministration}/LoansAndCredits/employee/${idEmployee}?Type=${type}`, {headers: this.trackingService.getHeaders()}
  }

  uploadPayrollData(data: any): Observable<any> {
    console.log("------------ UPLOADPAYROLLDATA() entrando al servicio payroll, la data es: ", data);

    return this.http.post<any>(`${environment.urlAdministration}/payroll`, data);
  }

  upLoadExcelFile(PayrollId: number, data: any): Observable<any> {
    return this.http.post<any>(`${environment.urlAdministration}/payroll/ExcelFile/${PayrollId}`, data);
  }

  getDetailsForNormalPayrolls(idPayroll: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/NormalPayrolls/employees/${idPayroll}`, { headers: this.trackingService.getHeaders() });
  }

  downloadPayrollExcel(idBranch: number, startDate: Date, endDate: Date): Observable<Blob> {
    return this.http.get(`${environment.urlAdministration}/NormalPayrolls/download-excel/${idBranch}`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      headers: this.trackingService.getHeaders(),
      responseType: 'blob'
    });
  }

  deletePayroll(idPayroll: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/NormalPayrolls/${idPayroll}`, { headers: this.trackingService.getHeaders() });
  }

 

  getMasterClock(idBranch: number, startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts/branch/${idBranch}/incidents?start=${startDate}&end=${endDate}`, {
      headers: this.trackingService.getHeaders()
    });
  }

  getDetailClock(idEmployee: number, startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeeCheckInOutSummary?idEmployee=${idEmployee}&startDate=${startDate}&endDate=${endDate}`, {
      headers: this.trackingService.getHeaders()
    });
  }

}
