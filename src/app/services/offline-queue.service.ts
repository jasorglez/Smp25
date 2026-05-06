import { Injectable } from '@angular/core';
import { IRedMiembro } from 'app/interface/ired-miembro';

export interface OfflineQueueItem {
  id: string;
  miembro: Partial<IRedMiembro>;
  ineFrenteBase64: string | null;
  ineReversoBase64: string | null;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly DB_NAME    = 'red-ciudadana-offline';
  private readonly STORE_NAME = 'queue';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async enqueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp'>): Promise<void> {
    const db = await this.openDB();
    const entry: OfflineQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror   = () => reject(tx.error);
    });
  }

  async getQueue(): Promise<OfflineQueueItem[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(this.STORE_NAME, 'readonly');
      const req = tx.objectStore(this.STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async count(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }
}
