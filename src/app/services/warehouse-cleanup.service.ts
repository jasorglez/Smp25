import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export type WarehouseCleanupGroup = 'materials' | 'providers' | 'requisitions' | 'purchaseOrders' | 'quotes' | 'entries' | 'exits' | 'otherMovements';

export interface WarehouseCleanupCount { label: string; count: number; }
export interface WarehouseCleanupPreview {
  companyId: number;
  companyName: string;
  items: WarehouseCleanupCount[];
  selectedGroups: WarehouseCleanupGroup[];
  protectedItems: WarehouseCleanupCount[];
  total: number;
  confirmationText: string;
  token: string;
  expiresAt: string;
}
export interface WarehouseCleanupResult {
  companyId: number;
  companyName: string;
  affectedRows: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class WarehouseCleanupService {
  private readonly http = inject(HttpClient);
  private readonly tracking = inject(TrackingService);

  preview(companyId: number, groups: WarehouseCleanupGroup[]) {
    return this.http.get<WarehouseCleanupPreview>(`${environment.urlSmp}/warehouse-cleanup/${companyId}/preview`,
      { headers: this.tracking.getHeaders(), params: { groups } });
  }

  execute(preview: WarehouseCleanupPreview, confirmationText: string) {
    return this.http.post<WarehouseCleanupResult>(`${environment.urlSmp}/warehouse-cleanup/${preview.companyId}/execute`,
      { token: preview.token, confirmationText }, { headers: this.tracking.getHeaders() });
  }
}
