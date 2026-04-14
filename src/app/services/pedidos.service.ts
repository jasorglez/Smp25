import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root',
})
export class PedidosService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getPedidos(idCompany?: number): Observable<any[]> {
    const url = idCompany 
      ? `${environment.urlAdministration}/Pedidos?idCompany=${idCompany}`
      : `${environment.urlAdministration}/Pedidos`;
    return this.http.get<any[]>(url, { headers: this.trackingService.getHeaders() });
  }

  getPedidoById(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/Pedidos/${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

getPedidosByCompany(idCompany: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/Pedidos?idCompany=${idCompany}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  createPedido(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/Pedidos`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  updatePedido(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/Pedidos/${id}`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  deletePedido(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/Pedidos/${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  // Métodos para Detalles de Pedido
  getDetallesByCompany(idCompany: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/DetallesPedidos/by-company/${idCompany}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  getDetallesByPedido(idPedido: number): Observable<any> {
    return this.http.get<any>(`${environment.urlAdministration}/DetallesPedidos/by-pedido/${idPedido}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  createDetalle(data: any): Observable<any> {
    return this.http.post(`${environment.urlAdministration}/DetallesPedidos`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  updateDetalle(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${environment.urlAdministration}/DetallesPedidos/${id}`, data, {
      headers: this.trackingService.getHeaders(),
    });
  }

  deleteDetalle(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.urlAdministration}/DetallesPedidos/${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }
}