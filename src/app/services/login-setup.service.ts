import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TrackingService } from './tracking.service';

export interface LoginImageItem {
  id: number;
  nombre: string;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoginSetupService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private get baseUrl(): string {
    return `${environment.urlSecurity}/LoginImage`;
  }

  /** Requiere autenticación (usado en Setup). */
  getAll(): Observable<LoginImageItem[]> {
    return this.http.get<LoginImageItem[]>(this.baseUrl, {
      headers: this.trackingService.getHeaders(),
    });
  }

  /** Público, sin token (usado en la pantalla de login). */
  getLoginImagesPublic(): Observable<LoginImageItem[]> {
    return this.http.get<LoginImageItem[]>(this.baseUrl);
  }

  /** Sube la imagen al backend (se guarda en carpeta del servidor). Devuelve el nombre del archivo para guardar en BD. */
  uploadFile(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const token = this.trackingService.getAuthToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ url: string }>(`${this.baseUrl}/upload`, formData, { headers });
  }

  /** URL completa para mostrar una imagen: si ya es http(s) se devuelve tal cual; si no, se asume archivo del backend. */
  getImageDisplayUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${environment.urlSecurity}/LoginImage/file/${encodeURIComponent(url)}`;
  }

  /** POST: guarda un solo item (backend solo tiene POST por item, no PUT de lista). */
  saveOne(item: { id: number; nombre: string; url: string }): Observable<LoginImageItem> {
    const body = { id: 0, nombre: item.nombre ?? '', url: item.url ?? '' };
    return this.http.post<{ id: number; contract: LoginImageItem }>(this.baseUrl, body, {
      headers: this.trackingService.getHeaders(),
    }).pipe(
      map((res) => res.contract ?? { id: res.id, nombre: item.nombre, url: item.url })
    );
  }

  /** DELETE: elimina por id. */
  deleteOne(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  async getAllAsync(): Promise<LoginImageItem[]> {
    return firstValueFrom(this.getAll());
  }

  /**
   * Simula "guardar todo": DELETE de los que se quitaron y POST solo de los nuevos.
   * El backend solo tiene GET, POST (un item) y DELETE (por id); no hay PUT ni update.
   */
  async saveAllAsync(
    items: { id?: number; nombre: string; url: string }[],
    originalIds: number[]
  ): Promise<LoginImageItem[]> {
    const currentIds = items
      .map((r) => (typeof r.id === 'number' && r.id > 0 ? r.id : null))
      .filter((id): id is number => id !== null);
    const toDelete = originalIds.filter((id) => !currentIds.includes(id));

    for (const id of toDelete) {
      await firstValueFrom(this.deleteOne(id));
    }

    for (const row of items) {
      const id = typeof row.id === 'number' && row.id > 0 ? row.id : 0;
      if (id <= 0) {
        await firstValueFrom(this.saveOne({ id: 0, nombre: row.nombre ?? '', url: row.url ?? '' }));
      }
    }

    return firstValueFrom(this.getAll());
  }
}
