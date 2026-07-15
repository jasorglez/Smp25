import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

// Un nodo de la explosion de materiales (BOM) de un producto terminado.
// Lista de adyacencia: cada nodo apunta a su padre (idPadre). Raiz = idPadre null.
export interface ProductoTerminadoBom {
  id?: number | null;
  idCompany: number;
  idProductoRoot: number;          // vw_finalproduct.id
  idPadre?: number | null;         // null = raiz (producto terminado)
  idMaterial?: number | null;      // material (hoja basica o semi-elaborado); null en la raiz
  nombre?: string | null;
  esBasico?: boolean;              // true = hoja basica (ultima compra); false = semi-elaborado (calculado)
  cantidad?: number;
  unidad?: string | null;
  mermaPct?: number;               // % desperdicio
  costoUnitario?: number;          // cache
  costoTotal?: number;             // cache = cantidad * costoUnitario * (1 + mermaPct/100)
  orden?: number;
  nivel?: number;
  comentarios?: string | null;
  modoCosto?: string;              // PONDERADO | ULTIMA | MAXIMO (base de costo del basico)
  active?: boolean;
  dateModified?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductoTerminadoBomService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private base = `${environment.urlWarehouse}/ProductoTerminadoBom`;

  // Todos los nodos BOM de una empresa (todos los productos).
  getByCompany(idCompany: number): Observable<ProductoTerminadoBom[]> {
    return this.http.get<ProductoTerminadoBom[]>(
      `${this.base}/byCompany/${idCompany}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  // Arbol completo de un producto terminado.
  getByRoot(idCompany: number, idProductoRoot: number): Observable<ProductoTerminadoBom[]> {
    return this.http.get<ProductoTerminadoBom[]>(
      `${this.base}/byRoot/${idCompany}/${idProductoRoot}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  getById(id: number): Observable<ProductoTerminadoBom> {
    return this.http.get<ProductoTerminadoBom>(
      `${this.base}/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  create(node: ProductoTerminadoBom): Observable<ProductoTerminadoBom> {
    return this.http.post<ProductoTerminadoBom>(
      this.base, node,
      { headers: this.trackingService.getHeaders() }
    );
  }

  update(id: number, node: ProductoTerminadoBom): Observable<ProductoTerminadoBom> {
    return this.http.put<ProductoTerminadoBom>(
      `${this.base}/${id}`, node,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete(
      `${this.base}/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
