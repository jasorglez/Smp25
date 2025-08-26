import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { MaterialsResponse } from 'app/interface/materials.interface';

@Injectable({
  providedIn: 'root',
})
export class MaterialsService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getMaterials(id: number, typemat: string): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(`${environment.urlWarehouse}/Material/${id}?typematerial=${typemat}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  addMaterial(data: any): Observable<any> {
    return this.http.post(`${environment.urlWarehouse}/Material`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  updateMaterial(id: string, data: any): Observable<any> {
    console.log('Updating material with ID:', id, 'and data:', data);
    return this.http.put<any[]>(
      `${environment.urlWarehouse}/Material/${id}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  deleteMaterial(id: number): Observable<any> {
    return this.http.delete<any[]>(
      `${environment.urlWarehouse}/Material/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getMaterials2Fields(id: number) {
    return this.http.get(
      `${environment.urlWarehouse}/Material/2fields?idCompany=${id}`,
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
      `${environment.urlWarehouse}/Material/byNameOrBarCode?idCompany=${idCompany}&nameOrBarCode=${nameOrBarcode}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
