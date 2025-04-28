import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ClockService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getEmployeeInfo(employeeCode: string, clockPassword: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/Employee/Clock?employeeCode=${employeeCode}&clockPassword=${clockPassword}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getCheckInfo(idBranch: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts?idBranch=${idBranch}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getCheckInfoByEmployee(idEmployee: number): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts/employee/${idEmployee}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  checkInOut(data: any){
    return this.http.post(`${environment.urlAdministration}/EmployeesxCheckInsOuts`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  checkInOutByEmployee(idEmployee: number, start: string, end: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts/employee/${idEmployee}?start=${start}&end=${end}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  checkIncidentsByEmployee(idEmployee: number, start: string, end: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts/employee/${idEmployee}/incidents?start=${start}&end=${end}`, {
      headers: this.trackingService.getHeaders(),
    });
  }
}
