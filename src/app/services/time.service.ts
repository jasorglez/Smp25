import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TimeService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getTime(): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/Time`, {
      headers: this.trackingService.getHeaders(),
    });
  }
}
