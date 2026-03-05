import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface LoginImage {
  id: number;
  nombre: string;
  url: string;
  active: boolean;
}

/** Alias para compatibilidad con código que usa LoginImageItem */
export type LoginImageItem = LoginImage;

@Injectable({
  providedIn: 'root',
})
export class LoginImageService {
  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private readonly baseUrl = `${environment.urlSecurity}/LoginImage`;

  /** Con autenticación — para el panel de administración. */
  getAll(): Observable<LoginImage[]> {
    return this.http.get<LoginImage[]>(this.baseUrl, {
      headers: this.trackingService.getHeaders(),
    });
  }

  /** Sin token — para la pantalla de login (endpoint AllowAnonymous). */
  getLoginImagesPublic(): Observable<LoginImage[]> {
    return this.http.get<LoginImage[]>(this.baseUrl);
  }

  /** URL completa para mostrar una imagen: si ya es http(s) se devuelve tal cual. */
  getImageDisplayUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.baseUrl}/file/${encodeURIComponent(url)}`;
  }

  /** POST de un solo item. */
  save(item: Partial<LoginImage>): Observable<LoginImage> {
    const body = { id: 0, nombre: item.nombre ?? '', url: item.url ?? '' };
    return this.http.post<{ id: number; contract: LoginImage }>(this.baseUrl, body, {
      headers: this.trackingService.getHeaders(),
    }).pipe(
      map((res) => res.contract ?? ({ id: res.id, nombre: item.nombre, url: item.url, active: true } as LoginImage))
    );
  }

  /** DELETE por id. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }

  /** Sube archivo al backend. */
  uploadFile(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const token   = this.trackingService.getAuthToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ url: string }>(`${this.baseUrl}/upload`, formData, { headers });
  }

  async getAllAsync(): Promise<LoginImage[]> {
    return firstValueFrom(this.getAll());
  }

  /**
   * Guarda la lista completa: DELETE de los eliminados + POST de los nuevos.
   */
  async saveAllAsync(
    items: { id?: number; nombre: string; url: string }[],
    originalIds: number[]
  ): Promise<LoginImage[]> {
    const currentIds = items
      .map((r) => (typeof r.id === 'number' && r.id > 0 ? r.id : null))
      .filter((id): id is number => id !== null);

    const toDelete = originalIds.filter((id) => !currentIds.includes(id));
    for (const id of toDelete) {
      await firstValueFrom(this.delete(id));
    }

    for (const row of items) {
      const id = typeof row.id === 'number' && row.id > 0 ? row.id : 0;
      if (id <= 0) {
        await firstValueFrom(
          this.save({ id: 0, nombre: row.nombre ?? '', url: row.url ?? '', active: true })
        );
      }
    }

    return firstValueFrom(this.getAll());
  }
}
