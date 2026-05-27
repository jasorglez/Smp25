import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { EntregaOcService, EntregaOc } from './entrega-oc.service';

@Injectable({ providedIn: 'root' })
export class EntregasPendingService {
  private entregaOcService = inject(EntregaOcService);

  // key = idDetailsreqoc (ítem de la OC), value = filas de entregas a persistir
  private pending = new Map<number, any[]>();

  private _hasPending = new BehaviorSubject<boolean>(false);
  hasPending$ = this._hasPending.asObservable();

  /** Registra/actualiza las filas de entregas pendientes de un ítem. */
  set(idDetailsreqoc: number, rows: any[]): void {
    this.pending.set(idDetailsreqoc, rows);
    this._hasPending.next(this.pending.size > 0);
  }

  /** Devuelve las filas pending para un ítem, o undefined si no hay cambios en sesión. */
  getPendingRows(idDetailsreqoc: number): any[] | undefined {
    return this.pending.get(idDetailsreqoc);
  }

  remove(idDetailsreqoc: number): void {
    this.pending.delete(idDetailsreqoc);
    this._hasPending.next(this.pending.size > 0);
  }

  clear(): void {
    this.pending.clear();
    this._hasPending.next(false);
  }

  /** Persiste todas las entregas pendientes. PUT en paralelo, POST en SERIE
   *  para que SQL asigne IDs autoincrementales en el orden visual del grid
   *  (evita el reordenamiento al recargar, ya que GetByDetail ordena por Id ASC).
   *  Los DELETEs se ejecutan inmediatamente al confirmar Eliminar — no pasan por aquí. */
  async flush(): Promise<void> {
    const updateOps: Promise<any>[] = [];
    const createSequence: Array<{ row: any; payload: EntregaOc }> = [];

    for (const [idDetail, rows] of this.pending.entries()) {
      for (const row of rows) {
        // Una fila nueva se persiste solo si el usuario la editó (__touched),
        // así las filas default con fecha de hoy que nadie toca no generan basura.
        const hasData = !!row.__touched;
        const payload: EntregaOc = {
          idDetailsreqoc: idDetail,
          fechaEntrega: row.fechaEntrega || null,
          cantidadRecibir: row.cantidadRecibir ?? null,
          notaFactura: row.notaFactura || null,
          totalEntrega: row.totalEntrega ?? null,
          fechaEntradaAlmacen: row.fechaEntradaAlmacen || null,
          active: true,
        };

        if (row.id) {
          updateOps.push(lastValueFrom(this.entregaOcService.update(row.id, { ...payload, id: row.id })));
        } else if (hasData) {
          createSequence.push({ row, payload });
        }
      }
    }

    await Promise.all(updateOps);
    for (const { row, payload } of createSequence) {
      const created: any = await lastValueFrom(this.entregaOcService.create(payload));
      row.id = created?.id ?? null;
    }

    this.clear();
  }
}
