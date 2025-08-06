import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';
import { PriceXProductsPresentationResponse } from 'app/interface/priceXProductsPresentation.interface';

@Injectable({
  providedIn: 'root',
})
export class PriceXProductsPresentationService {
  private http = inject(HttpClient);

  private trackingService = inject(TrackingService);

  getAllPriceXProductsPresentations(): Observable<
    PriceXProductsPresentationResponse[]
  > {
    return this.http.get<PriceXProductsPresentationResponse[]>(
      `${environment.urlWarehouse}/pricexproductspresentation`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getPriceXProductsPresentationsById(
    idPrice: number
  ): Observable<PriceXProductsPresentationResponse[]> {
    return this.http.get<PriceXProductsPresentationResponse[]>(
      `${environment.urlWarehouse}/pricexproductspresentation/${idPrice}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  updatePriceXProductsPresentationsById(
    idPrice: number,
    priceXProductLike: any
  ): Observable<any> {
    return this.http.put(
      `${environment.urlWarehouse}/pricexproductspresentation/${idPrice}`,
      priceXProductLike,
      { headers: this.trackingService.getHeaders() }
    );
  }

  createPriceXProductsPresentations(priceXProductLike: any): Observable<any> {
    return this.http.post(
      `${environment.urlWarehouse}/pricexproductspresentation`,
      priceXProductLike,
      { headers: this.trackingService.getHeaders() }
    );
  }

  deletePriceXProductsPresentationsById(idPrice: number): Observable<boolean> {
    return this.http.delete<boolean>(
      `${environment.urlWarehouse}/pricexproductspresentation/${idPrice}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
