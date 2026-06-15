import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface WorkOrderPhoto {
  id?: number;
  idWorkorder: number;
  imageUrl?: string;
  description?: string;
  uploadedAt?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkOrderPhotoService {
  private http = inject(HttpClient);
  private base = `${environment.urlMantenimiento}/WorkOrderPhoto`;

  getByWorkOrder(idWorkorder: number): Observable<WorkOrderPhoto[]> {
    return this.http.get<WorkOrderPhoto[]>(`${this.base}/workorder/${idWorkorder}`);
  }

  add(photo: WorkOrderPhoto): Observable<WorkOrderPhoto> {
    return this.http.post<WorkOrderPhoto>(this.base, photo);
  }

  update(id: number, photo: Partial<WorkOrderPhoto>): Observable<WorkOrderPhoto> {
    return this.http.put<WorkOrderPhoto>(`${this.base}/${id}`, photo);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
