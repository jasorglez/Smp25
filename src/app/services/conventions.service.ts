import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class ConventionsService {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);


  getConventions() {
    return this.http.get(`${environment.urlSmp}/Convention`, { headers: this.trackingService.getHeaders() });
  }

  getConventionsByContractOrProject(type: string, id: number) {
    return this.http.get(`${environment.urlSmp}/Convention/${id}/${type}`, { headers: this.trackingService.getHeaders() });
  }

  addConvention(data: any) {
    return this.http.post(`${environment.urlSmp}/Convention`, data, { headers: this.trackingService.getHeaders() });
  }

  updateConvention(id: number, data: any) {
    return this.http.put(`${environment.urlSmp}/Convention/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteConvention(id: number) {
    return this.http.delete(`${environment.urlSmp}/Convention/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getImages(idConvention: number) {
    return this.http.get(`${environment.urlSmp}/Attach?idTabla=${idConvention}&typeDocto=IMG`,
      { headers: this.trackingService.getHeaders() });
  }

  getDocuments(idConvention: number) {
    return this.http.get(`${environment.urlSmp}/Attach?idTabla=${idConvention}&typeDocto=PDF`,
      { headers: this.trackingService.getHeaders() });
  }

  uploadImage(idTabla: number, docto: string) {
    return this.http.post(`${environment.urlSmp}/Attach`,
      { idTabla: idTabla, docto: docto, typeDocto: 'IMG', type: 'CONVENIOS', active: 1 },
      { headers: this.trackingService.getHeaders() });
  }

  uploadDocument(idTabla: number, docto: string) {
    return this.http.post(`${environment.urlSmp}/Attach`,
      { idTabla: idTabla, docto: docto, typeDocto: 'PDF', type: 'CONVENIOS', active: 1 },
      { headers: this.trackingService.getHeaders() });
  }

  deleteAttachment(idAttach: number) {
    return this.http.delete(`${environment.urlSmp}/Attach/${idAttach}`, { headers: this.trackingService.getHeaders() });
  }
}
