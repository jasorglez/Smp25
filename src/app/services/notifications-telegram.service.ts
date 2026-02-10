import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface SendNotificationRequest {
  documentType: string;   // OC, REQUIS, INCOME, EXPENSE
  documentId: number;
  folio: string;
  description?: string;
  idSolicit: number;
  idAuthorize: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsTelegramService {

  private baseUrl = environment.urlNotifications;
  private trackingService = inject(TrackingService);

  constructor(private http: HttpClient) {}

  sendNotification(request: SendNotificationRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/Notification/send`, request, { headers: this.trackingService.getHeaders() });
  }

  getNotificationStatus(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/Notification/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getPendingNotifications(userId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/Notification/pending/${userId}`, { headers: this.trackingService.getHeaders() });
  }

  /** Public endpoint - no JWT required */
  getPublicDocument(token: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/public/view/${token}`);
  }
}
