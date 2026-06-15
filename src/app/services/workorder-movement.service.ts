import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface WorkOrderMovement {
  id?: number;
  folio?: string;
  idWorkorder?: number;
  idBranch?: string;
  idWarehouse?: number;
  type?: 'IN' | 'OUT';
  date?: string;
  notes?: string;
  active?: boolean;
}

export interface WorkOrderMovementItem {
  id?: number;
  idMovement?: number;
  idMaterial?: number;
  materialName?: string;
  quantity?: number;
  unitCost?: number;
  totalCost?: number;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkOrderMovementService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  private base = `${environment.urlMantenimiento}/WorkOrderMovement`;

  getByBranch(idBranch: string): Observable<WorkOrderMovement[]> {
    return this.http.get<WorkOrderMovement[]>(`${this.base}/branch/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  getByWorkOrder(idWorkorder: number): Observable<WorkOrderMovement[]> {
    return this.http.get<WorkOrderMovement[]>(`${this.base}/workorder/${idWorkorder}`, { headers: this.trackingService.getHeaders() });
  }

  add(movement: WorkOrderMovement): Observable<WorkOrderMovement> {
    return this.http.post<WorkOrderMovement>(this.base, movement, { headers: this.trackingService.getHeaders() });
  }

  update(id: number, movement: WorkOrderMovement): Observable<WorkOrderMovement> {
    return this.http.put<WorkOrderMovement>(`${this.base}/${id}`, movement, { headers: this.trackingService.getHeaders() });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getItems(idMovement: number): Observable<WorkOrderMovementItem[]> {
    return this.http.get<WorkOrderMovementItem[]>(`${this.base}/${idMovement}/items`, { headers: this.trackingService.getHeaders() });
  }

  addItem(item: WorkOrderMovementItem): Observable<WorkOrderMovementItem> {
    return this.http.post<WorkOrderMovementItem>(`${this.base}/item`, item, { headers: this.trackingService.getHeaders() });
  }

  updateItem(id: number, item: WorkOrderMovementItem): Observable<WorkOrderMovementItem> {
    return this.http.put<WorkOrderMovementItem>(`${this.base}/item/${id}`, item, { headers: this.trackingService.getHeaders() });
  }

  deleteItem(id: number): Observable<any> {
    return this.http.delete(`${this.base}/item/${id}`, { headers: this.trackingService.getHeaders() });
  }
}
