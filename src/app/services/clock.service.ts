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

  updateCheckInOut(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/EmployeesxCheckInsOuts/${id}`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }


  updateCheckInOutForDiscrepancies(id: number, data: any): Observable<any> {
    return this.http.patch(`${environment.urlAdministration}/EmployeesxCheckInsOuts/${id}/discrepance`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  checkIncidentsByEmployee(idEmployee: number, start: string, end: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts/employee/${idEmployee}/incidents?start=${start}&end=${end}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getSpecialHoursByEmployee(idEmployee: number, start: string, end: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/SpecialExtraHours/employee/${idEmployee}?startDate=${start}&endDate=${end}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  addSpecialHours(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/SpecialExtraHours`, data, { headers: this.trackingService.getHeaders() });
  }

  updateSpecialHours(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlAdministration}/SpecialExtraHours?id=${id}`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  deleteSpecialHours(id: number): Observable<any> {
    return this.http.delete(`${environment.urlAdministration}/SpecialExtraHours?id=${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getHourDiscrepancies(idBranch: number, start: string, end: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/EmployeesxCheckInsOuts/branch/${idBranch}/discrepances?start=${start}&end=${end}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getCatalogsAbsences(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idCompany}&type=REASON`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getCatalogsDiscrepancies(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlWarehouse}/Catalog/getCatalogs?idCompany=${idCompany}&type=ABSENCES`, {
      headers: this.trackingService.getHeaders(),
    });
  }
}
