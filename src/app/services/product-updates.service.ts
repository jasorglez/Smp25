import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface ProductUpdate {
  id: number;
  version?: string | null;
  module: string;
  changeType: string;
  title: string;
  description: string;
  userBenefit?: string | null;
  promoText?: string | null;
  occurredAtUtc: string;
  displayTimeZone?: string | null;
  mediaUrl?: string | null;
  tutorialUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProductUpdatesService {
  private readonly http = inject(HttpClient);
  private readonly tracking = inject(TrackingService);

  getPublished(idRoot: number, limit = 100): Observable<ProductUpdate[]> {
    const params = new HttpParams()
      .set('idRoot', idRoot)
      .set('limit', limit);
    return this.http.get<ProductUpdate[]>(
      `${environment.urlAdministration}/ProductUpdates/publicity`,
      { params, headers: this.tracking.getHeaders() },
    );
  }
}
