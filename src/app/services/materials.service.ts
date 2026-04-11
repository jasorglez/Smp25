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

  getProvidersxmaterials(idRoot: number): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(`${environment.urlWarehouse}/Material/matprov/${idRoot}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getMaterials(id: number, typemat: string): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(`${environment.urlWarehouse}/Material/${id}?typematerial=${typemat}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getMaterialsxview(idRoot: number): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(`${environment.urlWarehouse}/Material/with-counts/${idRoot}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getAllMaterialsxview(id: number): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(`${environment.urlWarehouse}/Material/materialsview/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getAllMaterialsxFamilyview(id: number): Observable<MaterialsResponse[]> {
    return this.http.get<MaterialsResponse[]>(`${environment.urlWarehouse}/Material/with-families/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
  

  addMaterial(data: any): Observable<any> {
    console.log('Adding new material:', data);
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

  updateMaterialCosto(id: number, costo: number): Observable<any> {
    return this.http.put(
      `${environment.urlWarehouse}/Material/costo/${id}`,
      { costo },
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

  getMaterialsForApu(id: number) {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/Material/for-apu?idCompany=${id}`,
      { headers: this.trackingService.getHeaders() }
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

  getFinalProduct(idCompany: number): Observable<any> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/FinalProduct/company/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  checkMaterialExistsInFinalProduct(idMaterial: number, idPresentation: number): Observable<boolean> {
    return this.http.get<boolean>(
      `${environment.urlWarehouse}/MaterialxFinalProduct/exists?idMaterial=${idMaterial}&idPresentation=${idPresentation}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  addMaterialToFinalProduct(idMaterial: number, idPresentation: number, data: any = {}): Observable<any> {
    return this.http.post(
      `${environment.urlWarehouse}/MaterialxFinalProduct?idMaterial=${idMaterial}&idPresentation=${idPresentation}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  removeMaterialFromFinalProduct(idMaterial: number, idPresentation: number): Observable<any> {
    return this.http.delete(
      `${environment.urlWarehouse}/MaterialxFinalProduct?idMaterial=${idMaterial}&idPresentation=${idPresentation}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
  catalogBymaterial( idCatalog: number): Observable<any> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/Material/catalogBymaterial?idCatalog=${idCatalog}`,
      { headers: this.trackingService.getHeaders() }
    );

  }

  getMaterialsByProvider(idProvider: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlWarehouse}/Material/by-provider/${idProvider}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
