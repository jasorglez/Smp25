import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface LoginImage {
  id: number;
  nombre: string;
  url: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LoginImageService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  private readonly url = `${environment.urlSecurity}/LoginImage`;

  getAll(): Observable<LoginImage[]> {
    return this.http.get<LoginImage[]>(this.url, {
      headers: this.trackingService.getHeaders(),
    });
  }

  save(item: LoginImage): Observable<LoginImage> {
    return this.http.post<LoginImage>(this.url, item, {
      headers: this.trackingService.getHeaders(),
    });
  }

  delete(id: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`${this.url}/${id}`, {
      headers: this.trackingService.getHeaders(),
    });
  }
}
