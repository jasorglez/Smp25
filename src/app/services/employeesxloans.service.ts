import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class EmployeesxloansService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getLoansByEmployee(idEmployee: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/EmployeesxLoans/employee/${idEmployee}`, {headers: this.trackingService.getHeaders()});
  }

  updateLoanData(idLoan: number, loan: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/EmployeesxLoans/${idLoan}`, loan, {headers: this.trackingService.getHeaders()});
  }

  addLoanData(loan: any): Observable<any> {
    return this.http.post<any>(`${environment.urlAdministration}/EmployeesxLoans`, loan, {headers: this.trackingService.getHeaders()});
  }

  deleteLoanData(idLoan: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/EmployeesxLoans/${idLoan}`, {headers: this.trackingService.getHeaders()});
  }
  
}
