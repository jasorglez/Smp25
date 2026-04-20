import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

export interface MaterialJarabeConfig {
  id?: number;
  idMaterial: number;
  usarEnJarabe: boolean;
  prefijoNota?: string | null;
  consecutivoNota?: number | null;
  prefijoLote?: string | null;
  consecutivoLote?: number | null;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MaterialJarabeService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByMaterial(idMaterial: number): Observable<MaterialJarabeConfig> {
    return this.http.get<MaterialJarabeConfig>(
      `${environment.urlProduction}/materialjarabe/${idMaterial}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  save(idMaterial: number, data: MaterialJarabeConfig): Observable<MaterialJarabeConfig> {
    return this.http.put<MaterialJarabeConfig>(
      `${environment.urlProduction}/materialjarabe/${idMaterial}`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
