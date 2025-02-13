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

  getIncomesAndExpenses(idRoot: number): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/Incomeandexpense/Bussines/' + idRoot, { headers: this.tracking.getHeaders() });
  }

  addIncomesAndExpenses(incomesAndExpenses: any): Observable<any> {
    return this.http.post<any>(environment.urlAdministration + '/Incomeandexpense/', incomesAndExpenses, { headers: this.tracking.getHeaders() });
  }

  updateIncomesAndExpenses(id: number, incomesAndExpenses: any): Observable<any> {
    return this.http.put<any>(environment.urlAdministration + '/Incomeandexpense/' + id, incomesAndExpenses, { headers: this.tracking.getHeaders() });
  }

  deleteIncomesAndExpenses(id: number): Observable<any> {
    return this.http.delete<any>(environment.urlAdministration + '/Incomeandexpense/' + id, { headers: this.tracking.getHeaders() });
    }
}