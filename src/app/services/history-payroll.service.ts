import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import {
  HistoryPayroll,
  HistoryPayrollResponse,
} from 'app/interface/history-payroll.interface';
import { map, Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { HistoryPayrollMapper } from 'app/domains/ModReshumans/components/payroll/history-payroll/mapper/history-payroll.mapper';

@Injectable({
  providedIn: 'root',
})
export class HistoryPayrollService {
  private http = inject(HttpClient);

  private trackingService = inject(TrackingService);

  getALlHistoryPayroll(): Observable<HistoryPayroll[]> {
    return this.http
      .get<HistoryPayrollResponse[]>(
        `${environment.urlAdministration}/payroll`,
        { headers: this.trackingService.getHeaders() }
      )
      .pipe(
        map((history) =>
          HistoryPayrollMapper.mapRestHistoryItemToArray(history)
        )
      );
  }

  getHistoryPayrollsByBranch(idBranch: number): Observable<HistoryPayroll[]> {
    return this.http
      .get<HistoryPayrollResponse[]>(
        `${environment.urlAdministration}/payroll?idBranch=${idBranch}`,
        { headers: this.trackingService.getHeaders() }
      )
      .pipe(
        map((history) =>
          HistoryPayrollMapper.mapRestHistoryItemToArray(history)
        )
      );
  }
}
