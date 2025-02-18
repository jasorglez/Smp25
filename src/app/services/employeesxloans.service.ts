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

  getLoansByEmployee(idEmployee: number, type: string): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/LoansAndCredits/employee/${idEmployee}?Type=${type}`, {headers: this.trackingService.getHeaders()});
  }

  getConceptsxLoansCredit(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/ConceptsxLoansCredits/loanandcredit/${id}`, {headers: this.trackingService.getHeaders()});
  }                                                               

  updateLoanCredit(idLoan: number, loan: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/LoansAndCredits/${idLoan}`, loan, {headers: this.trackingService.getHeaders()});
  }

  updateConcept(id: number, loan: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/ConceptsxLoansCredits/${id}`, loan, {headers: this.trackingService.getHeaders()});
  }

  addLoanData(loan: any): Observable<any> {
    return this.http.post<any>(`${environment.urlAdministration}/EmployeesxLoans`, loan, {headers: this.trackingService.getHeaders()});
  }

  deleteLoanData(idLoan: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/EmployeesxLoans/${idLoan}`, {headers: this.trackingService.getHeaders()});
  }
  
}
