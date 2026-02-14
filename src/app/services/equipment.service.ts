import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { MaterialsResponse } from 'app/interface/materials.interface';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class EquipmentService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getEquipment(id: number): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(
      `${environment.urlSmp}/Equipment/company/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getEquipmentByBranch(idBranch: number): Observable<MaterialsResponse[]> {
    const headers = this.trackingService.getHeaders();
    return this.http.get<MaterialsResponse[]>(
      `${environment.urlSmp}/Equipment/branch/${idBranch}`,
      { headers }
    ).pipe(
      catchError(() =>
        this.http.get<MaterialsResponse[]>(
          `${environment.urlSmp}/Equipment/company/${idBranch}`,
          { headers }
        )
      )
    );
  }

  addEquipment(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Equipment`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  addEquipmentFromAssets(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Equipment/assets`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  updateEquipment(id: string, data: any): Observable<any> {
    console.log('Updating equipment with ID:', id, 'and data:', data);
    return this.http.put<any[]>(
      `${environment.urlSmp}/Equipment/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  updateEquipmentFromAssets(id: string, data: any): Observable<any> {
    return this.http.put<any[]>(
      `${environment.urlSmp}/Equipment/assets/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  deleteEquipment(id: number): Observable<any> {
    return this.http.delete<any[]>(
      `${environment.urlSmp}/Equipment/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  /*getMaterials2Fields(id: number) {
    return this.http.get(
      `${environment.urlSmp}/Material/2fields?idCompany=${id}`,
      {
        headers: this.trackingService.getHeaders(),
      }
    );
  }

  getMaterialsByNameOrBarcode(
    idCompany: number,
    nameOrBarcode: string
  ): Observable<any> {
    return this.http.get<any[]>(
      `${environment.urlSmp}/Material/byNameOrBarCode?idCompany=${idCompany}&nameOrBarCode=${nameOrBarcode}`,
      { headers: this.trackingService.getHeaders() }
    );
  }*/
}
