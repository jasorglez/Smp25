import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { EntregaOcService, EntregaOc } from './entrega-oc.service';

@Injectable({ providedIn: 'root' })
export class EntregasPendingService {
  private entregaOcService = inject(EntregaOcService);

  // key = idDetailsreqoc (ítem de la OC), value = filas de entregas a persistir
  private pending = new Map<number, any[]>();
  // Estado visible actual del nivel3 (incluso sin ediciones), para validar duplicados al guardar.
  private visible = new Map<number, any[]>();

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

  /** Registra el estado visible del nivel3 (incluso sin ediciones) para validación al guardar. */
  setVisible(idDetailsreqoc: number, rows: any[]): void {
    this.visible.set(idDetailsreqoc, rows);
  }

  /** Quita un ítem del tracking visible (cuando se cierra el nivel3). */
  clearVisible(idDetailsreqoc: number): void {
    this.visible.delete(idDetailsreqoc);
  }

  /** Devuelve el primer idDetailsreqoc con fechas de entrega duplicadas, o null si todo válido.
   *  Revisa tanto el estado visible (lo que el usuario ve) como el pending (lo que ha editado). */
  findItemWithDuplicateDates(): number | null {
    // Combina visible + pending — pending sobreescribe visible para un mismo idDetail.
    const merged = new Map<number, any[]>();
    for (const [k, v] of this.visible.entries()) merged.set(k, v);
    for (const [k, v] of this.pending.entries()) merged.set(k, v);

    for (const [idDetail, rows] of merged.entries()) {
      const fechas = rows
        .map((r: any) => (r.fechaEntrega ? String(r.fechaEntrega).substring(0, 10) : ''))
        .filter(Boolean);
      if (fechas.length > 1 && new Set(fechas).size < fechas.length) {
        return idDetail;
      }
    }
    return null;
  }

  remove(idDetailsreqoc: number): void {
    this.pending.delete(idDetailsreqoc);
    this._hasPending.next(this.pending.size > 0);
  }

  clear(): void {
    this.pending.clear();
    this.visible.clear();
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
          close: row.close ?? false,
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
