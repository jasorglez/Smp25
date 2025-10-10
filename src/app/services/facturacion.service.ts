import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {

  constructor() { }

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getClaveUnidad() {
    return this.http.get(`${environment.urlSmp}/ClaveUnidad`, { headers: this.trackingService.getHeaders() });
  }

  getClaveUnidad2fields() {
    return this.http.get(`${environment.urlSmp}/ClaveUnidad/2fields`, { headers: this.trackingService.getHeaders() });
  }

  getFormaPago() {
    return this.http.get(`${environment.urlSmp}/FormaPago`, { headers: this.trackingService.getHeaders() });
  }

  getFormaPago2fields() {
    return this.http.get(`${environment.urlSmp}/FormaPago/2fields`, { headers: this.trackingService.getHeaders() });
  }

  getMetodoPago() {
    return this.http.get(`${environment.urlSmp}/MetodoPago`, { headers: this.trackingService.getHeaders() });
  }

  getMetodoPago2fields() {
    return this.http.get(`${environment.urlSmp}/MetodoPago/2fields`, { headers: this.trackingService.getHeaders() });
  }

  getMoneda() {
    return this.http.get(`${environment.urlSmp}/Moneda`, { headers: this.trackingService.getHeaders() });
  }

  getMoneda2fields() {
    return this.http.get(`${environment.urlSmp}/Moneda/2fields`, { headers: this.trackingService.getHeaders() });
  }

  getTipoComprobante() {
    return this.http.get(`${environment.urlSmp}/TipoComprobante`, { headers: this.trackingService.getHeaders() });
  }

  getTipoComprobante2fields() {
    return this.http.get(`${environment.urlSmp}/TipoComprobante/2fields`, { headers: this.trackingService.getHeaders() });
  }

  getUsoCfdi() {
    return this.http.get(`${environment.urlSmp}/UsoCfdi`, { headers: this.trackingService.getHeaders() });
  }

  getUsoCfdi2fields() {
    return this.http.get(`${environment.urlSmp}/UsoCfdi/2fields`, { headers: this.trackingService.getHeaders() });
  }

  getProductosServicios() {
    return this.http.get(`${environment.urlSmp}/ClaveProdServ`, { headers: this.trackingService.getHeaders() });
  }

  getProductosServicios2fields() {
    return this.http.get(`${environment.urlSmp}/ClaveProd/2fields`, { headers: this.trackingService.getHeaders() });
  }

 

}