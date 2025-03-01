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

  getEmployeeInfo(branchId: number, employeeCode: string, clockPassword: string): Observable<any> {
    return this.http.get(`${environment.urlAdministration}/Employee/Clock?branchId=${branchId}&employeeCode=${employeeCode}&clockPassword=${clockPassword}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  checkInOut(data: any){
    return this.http.post(`${environment.urlAdministration}/EmployeesxCheckInsOuts`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }
}
