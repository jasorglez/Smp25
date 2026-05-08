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


  getIncomesAndExpenses(idRoot: number, startDate?: string, endDate?: string): Observable<any> {
    let url = environment.urlAdministration + '/Incomeandexpense/Bussines/' + idRoot;
    const params: string[] = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<any>(url, { headers: this.tracking.getHeaders() });
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

  getBatchConceptsFromIncomesAndExpenses(ids: number[]): Observable<{ [id: number]: any[] }> {
    return this.http.post<{ [id: number]: any[] }>(environment.urlAdministration + '/ConceptsxIncorExp/batch', ids, { headers: this.tracking.getHeaders() });
  }

  // Obtener TODOS los conceptos (incluyendo active=0) para reportes
  getAllConceptsFromIncomesAndExpenses(idIncorexp: number): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/ConceptsxIncorExp/incorexp/' + idIncorexp + '/all', { headers: this.tracking.getHeaders() });
  }

  getConceptsUuid(uuid: string): Observable<any> {
    return this.http.get<any>(environment.urlAdministration + '/ConceptsxIncorExp/search?uuid=' + uuid, { headers: this.tracking.getHeaders() });
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
  getExcel(FechaIncio: string, FechaFin: string, Type: string): Observable<any> {
    return this.http.post<any>(
      environment.urlAdministration +
      `/Incomeandexpense/ProcesadorExcel?FechaIncio=${FechaIncio}&FechaFin=${FechaFin}&Type=${Type}`,
      {}, // body vacío como en -d ''
      { headers: this.tracking.getHeaders() }
    );
  }

  getExcelEgresos(Mes: string, idCompany: number, Type: string): Observable<any> {
    console.log("---",Mes, idCompany, Type)
    return this.http.post<any>(
      environment.urlAdministration +
      `/Incomeandexpense/ProcesadorExcelEgresos?Mes=${Mes}&idCompany=${idCompany}&Type=${Type}`,
      {}, // body vacío
      { headers: this.tracking.getHeaders() }
    );
  }

  getIncomesByAccount(idBusiness: number, type: string, startDate: string, endDate: string): Observable<any> {
    return this.http.get<any[]>(`${environment.urlAdministration}/Incomeandexpense/income-by-account?idBusiness=${idBusiness}&type=${type}&startDate=${startDate}&endDate=${endDate}`, { headers: this.tracking.getHeaders() });
  }

  getDetailFromIncomesAndExpenses(idBusiness: number, type: string, nameAccount: string, startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/Incomeandexpense/income-detail?idBusiness=${idBusiness}&type=${type}&nameAccount=${nameAccount}&startDate=${startDate}&endDate=${endDate}`, { headers: this.tracking.getHeaders() });
  }

}
