import { Injectable } from '@angular/core';

export interface CobranzaOfflineSnapshot<T = unknown> {
  key: string;
  companyId: number;
  category: string;
  value: T;
  updatedAt: string;
}

export interface CobranzaOfflineOperation {
  id: string;
  companyId: number;
  userEmail?: string;
  type: string;
  localEntityId?: number;
  payload: unknown;
  createdAt: string;
  status: 'PENDING' | 'SYNCING' | 'ERROR' | 'SYNCED';
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CobranzaOfflineStoreService {
  private readonly databaseName = 'biapp-cobranza-offline';
  private readonly databaseVersion = 1;
  private databasePromise: Promise<IDBDatabase> | null = null;

  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  async saveSnapshot<T>(snapshot: Omit<CobranzaOfflineSnapshot<T>, 'updatedAt'>): Promise<void> {
    await this.put('snapshots', { ...snapshot, updatedAt: new Date().toISOString() });
  }

  async getSnapshot<T>(key: string): Promise<CobranzaOfflineSnapshot<T> | null> {
    return (await this.get<CobranzaOfflineSnapshot<T>>('snapshots', key)) || null;
  }

  async getSnapshots<T>(companyId: number, category?: string): Promise<CobranzaOfflineSnapshot<T>[]> {
    const all = await this.getAll<CobranzaOfflineSnapshot<T>>('snapshots');
    return all.filter(item => Number(item.companyId) === Number(companyId)
      && (!category || item.category === category));
  }

  async enqueue(operation: Omit<CobranzaOfflineOperation, 'id' | 'createdAt' | 'status'>): Promise<CobranzaOfflineOperation> {
    const item: CobranzaOfflineOperation = {
      ...operation,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'PENDING'
    };
    await this.put('outbox', item);
    return item;
  }

  async getPendingOperations(companyId: number): Promise<CobranzaOfflineOperation[]> {
    const all = await this.getAll<CobranzaOfflineOperation>('outbox');
    return all.filter(item => Number(item.companyId) === Number(companyId) && item.status !== 'SYNCED')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async updateOperation(operation: CobranzaOfflineOperation): Promise<void> {
    await this.put('outbox', operation);
  }

  async removeOperation(id: string): Promise<void> {
    await this.delete('outbox', id);
  }

  async saveMeta<T>(key: string, value: T): Promise<void> {
    await this.put('meta', { key, value });
  }

  async getMeta<T>(key: string): Promise<T | null> {
    const record = await this.get<{ key: string; value: T }>('meta', key);
    return record?.value ?? null;
  }

  private async open(): Promise<IDBDatabase> {
    if (!this.isAvailable()) throw new Error('Este navegador no permite almacenamiento local para Cobranza.');
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.databaseName, this.databaseVersion);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('snapshots')) database.createObjectStore('snapshots', { keyPath: 'key' });
          if (!database.objectStoreNames.contains('outbox')) database.createObjectStore('outbox', { keyPath: 'id' });
          if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento offline de Cobranza.'));
        request.onblocked = () => reject(new Error('Cierra otras pestañas de BIAPP para preparar Cobranza offline.'));
      });
    }
    return this.databasePromise;
  }

  private async put(storeName: string, value: unknown): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar información offline.'));
      transaction.onabort = () => reject(transaction.error || new Error('Se canceló el guardado offline.'));
    });
  }

  private async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const database = await this.open();
    return new Promise<T | undefined>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error || new Error('No se pudo leer información offline.'));
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const database = await this.open();
    return new Promise<T[]>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve((request.result || []) as T[]);
      request.onerror = () => reject(request.error || new Error('No se pudo leer el almacenamiento offline.'));
    });
  }

  private async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo quitar la operación offline.'));
    });
  }
}
