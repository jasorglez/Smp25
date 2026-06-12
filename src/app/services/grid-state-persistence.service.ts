import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, groupBy, map, mergeMap } from 'rxjs/operators';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

interface GridColumnStateDto {
  id?: number;
  idUser: number;
  gridKey: string;
  columnState?: string | null;
}

/**
 * Servicio GENÉRICO de persistencia del estado de columnas de AG Grid por usuario.
 *
 * Persiste el `columnState` completo (visibilidad + orden + ancho) en BD
 * (Delison.grid_column_state) usando una `gridKey` única por tabla.
 *
 * Uso en un componente con AG Grid:
 *   - onGridReady:  this.gridState.loadState('mi-grid').subscribe(s => { if (s.length) api.applyColumnState({ state: s, applyOrder: true }); });
 *   - onColumnVisible / onColumnMoved / onColumnResized(finished):
 *                   this.gridState.saveState('mi-grid', api.getColumnState());
 */
@Injectable({ providedIn: 'root' })
export class GridStatePersistenceService {
  private http = inject(HttpClient);
  private tracking = inject(TrackingService);
  private signals = inject(SignalsService);

  // Cola de guardados con debounce por gridKey (evita spamear la BD durante un drag).
  private saveQueue$ = new Subject<{ gridKey: string; state: any[] }>();

  constructor() {
    this.saveQueue$
      .pipe(
        groupBy(req => req.gridKey),
        mergeMap(group$ => group$.pipe(debounceTime(600)))
      )
      .subscribe(req => this.flush(req.gridKey, req.state));
  }

  /** Carga el columnState guardado para (usuario actual, gridKey). [] si no hay nada. */
  loadState(gridKey: string): Observable<any[]> {
    const idUser = this.signals.getIdUSer()();
    if (!idUser) return of([]);

    return this.http
      .get<GridColumnStateDto | null>(`${environment.urlWarehouse}/GridColumnState`, {
        params: { idUser: String(idUser), gridKey },
        headers: this.tracking.getHeaders(),
      })
      .pipe(
        map(res => {
          if (!res || !res.columnState) return [];
          try {
            const parsed = JSON.parse(res.columnState);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }),
        catchError(() => of([]))
      );
  }

  /** Encola un guardado del columnState (con debounce por gridKey). */
  saveState(gridKey: string, state: any[]): void {
    if (!gridKey || !Array.isArray(state)) return;
    this.saveQueue$.next({ gridKey, state });
  }

  private flush(gridKey: string, state: any[]): void {
    const idUser = this.signals.getIdUSer()();
    if (!idUser) return;

    const body: GridColumnStateDto = {
      idUser,
      gridKey,
      columnState: JSON.stringify(state ?? []),
    };

    this.http
      .post(`${environment.urlWarehouse}/GridColumnState`, body, {
        headers: this.tracking.getHeaders(),
      })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }
}
