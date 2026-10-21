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

export interface ProductUpdatesPage {
  items: ProductUpdate[];
  totalCount: number;
  page: number;
  pageSize: number;
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

  getPublishedPage(idRoot: number, page = 1, pageSize = 20, search = ''): Observable<ProductUpdatesPage> {
    const params = new HttpParams()
      .set('idRoot', idRoot)
      .set('page', page)
      .set('pageSize', pageSize)
      .set('search', search.trim());
    return this.http.get<ProductUpdatesPage>(
      `${environment.urlAdministration}/ProductUpdates/publicity/page`,
      { params, headers: this.tracking.getHeaders() },
    );
  }
}
