import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class IncomesAndExpensesService {

  private http = inject(HttpClient);
  private tracking = inject(TrackingService);



  getIncomesAll(): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/Incomeandexpense/all/', { headers: this.tracking.getHeaders() });
  }

  getIncomesxroot(idRoot: number): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/Incomeandexpense/incomexroot?idroot=' + idRoot, { headers: this.tracking.getHeaders() });
  }

  getExpensesxroot(idRoot: number): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/Incomeandexpense/expensexroot?idroot=' + idRoot, { headers: this.tracking.getHeaders() });
  }


  getIncomesAndExpenses(idRoot: number): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/Incomeandexpense/Bussines/' + idRoot, { headers: this.tracking.getHeaders() });
  }

  getIncomeAndExpenseById(id: number): Observable<any> {
    return this.http.get(environment.urlAdministration + '/Incomeandexpense/' + id, { headers: this.tracking.getHeaders() });
    }

  addIncomesAndExpenses(incomesAndExpenses: any): Observable<any> {
    return this.http.post<any>(environment.urlAdministration + '/Incomeandexpense/', incomesAndExpenses, { headers: this.tracking.getHeaders() });
  }

  updateIncomesAndExpenses(id: number, incomesAndExpenses: any): Observable<any> {
    return this.http.put<any>(environment.urlAdministration + '/Incomeandexpense/' + id, incomesAndExpenses, { headers: this.tracking.getHeaders() });
  }

  updateTotal(id: number, incomesAndExpenses: any): Observable<any> {
   // const apiUrl = `${environment.urlAdministration + '/Incomeandexpense/totals/' + id }`;
   // alert(apiUrl)
    return this.http.patch<any>(environment.urlAdministration + '/Incomeandexpense/totals/' + id, incomesAndExpenses, { headers: this.tracking.getHeaders() });
  }
  

  deleteIncomesAndExpenses(id: number): Observable<any> {
    return this.http.delete<any>(environment.urlAdministration + '/Incomeandexpense/' + id, { headers: this.tracking.getHeaders() });
    }

    getConceptsFromIncomesAndExpenses(idIncorexp: number): Observable<any> {
      return this.http.get<any>(environment.urlAdministration + '/ConceptsxIncorExp/incorexp/' + idIncorexp, { headers: this.tracking.getHeaders() });
    }

    addConceptFromIncomesAndExpenses(data: any): Observable<any> {
      return this.http.post<any>(environment.urlAdministration + '/ConceptsxIncorExp/', data, { headers: this.tracking.getHeaders() });
    }

    updateConceptFromIncomesAndExpenses(id: number, data: any): Observable<any> {
      return this.http.put<any>(environment.urlAdministration + '/ConceptsxIncorExp/' + id, data, { headers: this.tracking.getHeaders() });
    }

    deleteConceptFromIncomesAndExpenses(id: number): Observable<any> {
      return this.http.delete<any>(environment.urlAdministration + '/ConceptsxIncorExp/' + id, { headers: this.tracking.getHeaders() });
    }

}