import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HistoryPayrollResponse } from 'app/interface/history-payroll.interface';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root',
})
export class HistoryPayrollService {
  private http = inject(HttpClient);

  private trackingService = inject(TrackingService);

  getHistoryPayrollsByBranch(
    idBranch: number
  ): Observable<HistoryPayrollResponse[]> {
    return this.http.get<HistoryPayrollResponse[]>(
      `${environment.urlAdministration}/payroll/branch/${idBranch}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
