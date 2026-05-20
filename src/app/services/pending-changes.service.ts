import { Injectable, signal, computed } from '@angular/core';

/**
 * Interfaz que cada nivel hijo registra en PendingChangesService.
 * - `hasChanges`: indica si ese nivel tiene cambios pendientes en este momento.
 * - `save`: función que persiste los cambios del nivel y resuelve cuando termina.
 *   Recibe un mapa opcional `idMap` con `tempId → realId` para que el hijo
 *   actualice referencias a filas padre recién creadas (ej. materialId que
 *   pasó de `temp_5` a `1234` tras guardar el Nivel 1).
 */
export interface ChildSaver {
  hasChanges: boolean;
  save: (idMap?: Map<string, number>) => Promise<void>;
}

/**
 * Bus central de cambios pendientes para arquitecturas master-detail multinivel.
 *
 * Permite que un único botón "Guardar" en el componente raíz (Nivel 1) orqueste
 * la persistencia de varios sub-grids hijos (Niveles 2..N). Cada hijo se registra
 * con un `saverId` único al montarse y se desregistra al destruirse; reporta sus
 * cambios mediante `notifyChanges()`. El Nivel 1 consulta `hasAnyPendingChanges`
 * (Signal reactiva) para encender su badge rojo y llama `saveAll()` para persistir
 * todos los hijos con cambios.
 */
@Injectable({ providedIn: 'root' })
export class PendingChangesService {
  /** Registro interno de hijos: saverId → ChildSaver. */
  private savers = new Map<string, ChildSaver>();

  /** Signal interna: ¿algún hijo tiene cambios? Recalculada en cada notify/unregister. */
  private _hasAnyPendingChanges = signal<boolean>(false);

  /** Signal pública (sólo lectura) para que el Nivel 1 encienda el badge. */
  public readonly hasAnyPendingChanges = computed(() => this._hasAnyPendingChanges());

  /** Registra un nivel hijo. Llamar en agInit/ngOnInit del componente. */
  register(saverId: string, saver: ChildSaver): void {
    this.savers.set(saverId, saver);
    this.recompute();
  }

  /** Desregistra un nivel hijo. Llamar en ngOnDestroy. */
  unregister(saverId: string): void {
    this.savers.delete(saverId);
    this.recompute();
  }

  /** Actualiza el flag hasChanges de un hijo registrado. */
  notifyChanges(saverId: string, hasChanges: boolean): void {
    const saver = this.savers.get(saverId);
    if (!saver) return;
    saver.hasChanges = hasChanges;
    this.recompute();
  }

  /** Snapshot no reactivo (útil dentro de métodos async). */
  hasAnyChanges(): boolean {
    return this._hasAnyPendingChanges();
  }

  /**
   * Orquesta el guardado de TODOS los hijos con cambios pendientes.
   *
   * Ejecuta SECUENCIALMENTE (no paralelo) para que cada saver pueda AÑADIR al
   * `idMap` los IDs reales que generó (ej. nuevos proveedores), y el siguiente
   * saver use esos IDs al remapear sus FKs (ej. sucursales que dependen del
   * proveedor recién creado). El orden de ejecución es el orden de registro:
   * los componentes que se abren primero (más cerca de la raíz) se guardan primero.
   *
   * @param idMap Opcional: mapa `tempId → realId`. Se inicializa vacío si no se pasa.
   *              Los savers pueden añadir entradas mutándolo durante su save().
   */
  async saveAll(idMap?: Map<string, number>): Promise<void> {
    const dirty = Array.from(this.savers.values()).filter(s => s.hasChanges);
    if (dirty.length === 0) return;
    const map = idMap ?? new Map<string, number>();
    for (const s of dirty) {
      await s.save(map);
    }
    // Tras un guardado exitoso, todos quedan limpios.
    this.savers.forEach(s => { s.hasChanges = false; });
    this.recompute();
  }

  /** Recalcula la Signal escaneando todos los savers. */
  private recompute(): void {
    let any = false;
    this.savers.forEach(s => { if (s.hasChanges) any = true; });
    this._hasAnyPendingChanges.set(any);
  }
}
