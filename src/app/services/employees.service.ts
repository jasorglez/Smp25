import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmployeesService {

  constructor() { }


  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getEmployees(idBranch: number) {
    return this.http.get(`${environment.urlAdministration}/Employee/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }
  getEmployeesVigente(idBranch: number) {
    return this.http.get(`${environment.urlAdministration}/Employee/branchVigente/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }
  
  getEmployeeById(id: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Employee/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addEmployee(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Employee`, data, { headers: this.trackingService.getHeaders() });
  }

  updateEmployee(id: number, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/Employee/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteEmployee(id: number): Observable<any> {
    return this.http.delete<any[]>(`${environment.urlAdministration}/Employee/${id}`, { headers: this.trackingService.getHeaders() });
  }
  
  getEmployeeClock(idEmployee: number): Observable<any> {
    return this.http.get<any[]>(`${environment.urlAdministration}/EmployeesXClock/employee/${idEmployee}`, { headers: this.trackingService.getHeaders() });
  }

  getEmployeeClockByDay(idEmployee: number, day: string): Observable<any> {
    return this.http.get<any[]>(`${environment.urlAdministration}/EmployeesXClock/employee/${idEmployee}/${day}`, { headers: this.trackingService.getHeaders() });
  }

  getEmployeeClockByBranch(idBranch: number, day: string): Observable<any> {
    return this.http.get<any[]>(`${environment.urlAdministration}/EmployeesXClock/branch/${idBranch}/${day}`, { headers: this.trackingService.getHeaders() });
  }

  updateEmployeeClock(idEmployee: number, day: string, data: any): Observable<any> {
    return this.http.put<any[]>(`${environment.urlAdministration}/EmployeesXClock/${idEmployee}/${day}`, data, { headers: this.trackingService.getHeaders() });
  } 

  addEmployeeClock(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/EmployeesXClock`, data, { headers: this.trackingService.getHeaders() });
  } 

}
