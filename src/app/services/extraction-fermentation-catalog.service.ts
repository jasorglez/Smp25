import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface ExtractionFermentationCatalogItem {
  id: number;
  idCompany: number;
  idBranch?: number | null;
  description: string;
  active: boolean;
  molienda: boolean;
  // Categoría "Características de {material}": id del material ligado. NULL = categoría general.
  idMaterial?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class ExtractionFermentationCatalogService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private refreshTrigger = signal(0);

  getRefreshTrigger() {
    return this.refreshTrigger.asReadonly();
  }

  bumpRefreshTrigger() {
    this.refreshTrigger.update((n) => n + 1);
  }

  getAll(idCompany: number): Observable<ExtractionFermentationCatalogItem[]> {
    return this.http.get<ExtractionFermentationCatalogItem[]>(
      `${environment.urlWarehouse}/ExtractionFermentationCatalog?idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getAllByBranch(idCompany: number, idBranch: number): Observable<ExtractionFermentationCatalogItem[]> {
    return this.http.get<ExtractionFermentationCatalogItem[]>(
      `${environment.urlWarehouse}/ExtractionFermentationCatalog?idCompany=${idCompany}&idBranch=${idBranch}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(data: Partial<ExtractionFermentationCatalogItem>): Observable<ExtractionFermentationCatalogItem> {
    return this.http.post<ExtractionFermentationCatalogItem>(
      `${environment.urlWarehouse}/ExtractionFermentationCatalog`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: Partial<ExtractionFermentationCatalogItem>): Observable<ExtractionFermentationCatalogItem> {
    return this.http.put<ExtractionFermentationCatalogItem>(
      `${environment.urlWarehouse}/ExtractionFermentationCatalog/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlWarehouse}/ExtractionFermentationCatalog/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
