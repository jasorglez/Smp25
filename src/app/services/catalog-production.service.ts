import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface CatalogProductionItem {
  id?: number;
  idCompany?: number | null;
  description: string;
  type?: string | null;                     // 'CATEGORY' | 'FAM-CAT' | 'SUB-FAM'
  parentId?: number | null;                 // Para jerarquía
  subParentId?: number | null;              // Para subfamilias
  valueAddition?: string | null;
  valueAddition2?: string | null;
  valueAdditionBit?: boolean | null;        // Material Maestro
  valueAdditionBit2?: boolean | null;       // Requisiciones
  vigente?: boolean | null;
  price?: number | null;
  active?: number;
  dateModified?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogProductionService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getAll(idCompany: number): Observable<CatalogProductionItem[]> {
    return this.http.get<CatalogProductionItem[]>(
      `${environment.urlProduction}/CatalogJerarquico?idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getByType(type: string, idCompany: number): Observable<CatalogProductionItem[]> {
    return this.http.get<CatalogProductionItem[]>(
      `${environment.urlProduction}/CatalogJerarquico/bytype?type=${type}&idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getCategories(idCompany: number): Observable<CatalogProductionItem[]> {
    return this.http.get<CatalogProductionItem[]>(
      `${environment.urlProduction}/CatalogJerarquico/categories?idCompany=${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getFamilies(parentId: number): Observable<CatalogProductionItem[]> {
    return this.http.get<CatalogProductionItem[]>(
      `${environment.urlProduction}/CatalogJerarquico/families?parentId=${parentId}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getSubfamilies(parentId: number): Observable<CatalogProductionItem[]> {
    return this.http.get<CatalogProductionItem[]>(
      `${environment.urlProduction}/CatalogJerarquico/subfamilies?parentId=${parentId}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<CatalogProductionItem> {
    return this.http.get<CatalogProductionItem>(
      `${environment.urlProduction}/CatalogJerarquico/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(data: CatalogProductionItem): Observable<CatalogProductionItem> {
    return this.http.post<CatalogProductionItem>(
      `${environment.urlProduction}/CatalogJerarquico`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: CatalogProductionItem): Observable<CatalogProductionItem> {
    return this.http.put<CatalogProductionItem>(
      `${environment.urlProduction}/CatalogJerarquico/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlProduction}/CatalogJerarquico/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
