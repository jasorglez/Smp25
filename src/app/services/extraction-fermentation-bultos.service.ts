import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

export interface ExtractionFermentationBultosItem {
  id?: number;
  idCompany: number;
  idBranch: number;
  cantidadBultos: number;
  cantidadARevisar?: number | null;
  proporcionRevision?: number | null;
  active?: boolean;
  dateModified?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExtractionFermentationBultosService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByBranch(idCompany: number, idBranch: number): Observable<ExtractionFermentationBultosItem | null> {
    return this.http.get<ExtractionFermentationBultosItem | null>(
      `${environment.urlProduction}/ExtractionFermentationBultos?idCompany=${idCompany}&idBranch=${idBranch}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<ExtractionFermentationBultosItem> {
    return this.http.get<ExtractionFermentationBultosItem>(
      `${environment.urlProduction}/ExtractionFermentationBultos/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(data: ExtractionFermentationBultosItem): Observable<ExtractionFermentationBultosItem> {
    return this.http.post<ExtractionFermentationBultosItem>(
      `${environment.urlProduction}/ExtractionFermentationBultos`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, data: Partial<ExtractionFermentationBultosItem>): Observable<ExtractionFermentationBultosItem> {
    return this.http.put<ExtractionFermentationBultosItem>(
      `${environment.urlProduction}/ExtractionFermentationBultos/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.urlProduction}/ExtractionFermentationBultos/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
