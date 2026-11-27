import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface CompanyPublicityImage {
  id: number;
  fileName: string;
  altText: string;
  createdAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class CompanyPublicityService {
  private readonly http = inject(HttpClient);
  private readonly tracking = inject(TrackingService);
  private readonly baseUrl = `${environment.urlAdministration}/company-publicity`;

  list(companyId: number) {
    return this.http.get<{ canManage: boolean; images: CompanyPublicityImage[] }>(
      `${this.baseUrl}/${companyId}`, { headers: this.tracking.getHeaders() });
  }

  image(companyId: number, id: number) {
    return this.http.get(`${this.baseUrl}/${companyId}/${id}/image`,
      { headers: this.tracking.getHeaders(), responseType: 'blob' });
  }

  upload(companyId: number, image: File) {
    const form = new FormData();
    form.append('image', image);
    return this.http.post(`${this.baseUrl}/${companyId}`, form,
      { headers: this.tracking.getHeaders() });
  }

  delete(companyId: number, id: number) {
    return this.http.delete(`${this.baseUrl}/${companyId}/${id}`,
      { headers: this.tracking.getHeaders() });
  }
}
