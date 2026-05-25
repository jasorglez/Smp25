import { Injectable } from '@angular/core';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 2;

export interface PosSession {
  id: 'current';
  idStore: number;
  storeName: string;
  idCashRegister: number;
  cashRegisterDesc: string;
  prefix: string;
  consecutive: number;
  idCompany: number;
  idBranch: number;
  startedAt: string;
  fondoInicial: number;
  idTurno: number;
  cajero?: string;
}

@Injectable({ providedIn: 'root' })
export class PosDbService {
  private db: IDBDatabase | null = null;

  async openDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('session'))
          db.createObjectStore('session', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('productos_cache'))
          db.createObjectStore('productos_cache', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('clientes_cache'))
          db.createObjectStore('clientes_cache', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('ventas_pendientes'))
          db.createObjectStore('ventas_pendientes', { keyPath: 'localId' });
        if (!db.objectStoreNames.contains('conceptos_pendientes')) {
          const s = db.createObjectStore('conceptos_pendientes', { keyPath: 'localId' });
          s.createIndex('by_sale', 'localSaleId', { unique: false });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  private async store(name: string, mode: IDBTransactionMode) {
    const db = await this.openDb();
    return db.transaction(name, mode).objectStore(name);
  }

  private wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Session ─────────────────────────────────────────────────────────────

  async saveSession(session: Omit<PosSession, 'id'>): Promise<void> {
    const s = await this.store('session', 'readwrite');
    await this.wrap(s.put({ ...session, id: 'current' }));
  }

  async getSession(): Promise<PosSession | null> {
    const s = await this.store('session', 'readonly');
    return this.wrap(s.get('current')) as Promise<PosSession | null>;
  }

  async clearSession(): Promise<void> {
    const s = await this.store('session', 'readwrite');
    await this.wrap(s.delete('current'));
  }

  async incrementConsecutive(): Promise<number> {
    const session = await this.getSession();
    if (!session) throw new Error('No hay sesión activa');
    const next = session.consecutive + 1;
    await this.saveSession({ ...session, consecutive: next });
    return next;
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  async saveProducts(products: any[]): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction('productos_cache', 'readwrite');
    const s = tx.objectStore('productos_cache');
    s.clear();
    for (const p of products) s.put(p);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getProducts(): Promise<any[]> {
    const s = await this.store('productos_cache', 'readonly');
    return this.wrap(s.getAll());
  }

  async searchProducts(term: string): Promise<any[]> {
    const all = await this.getProducts();
    if (!term) return all.slice(0, 50);
    const t = term.toLowerCase();
    return all.filter(p =>
      (p.description && p.description.toLowerCase().includes(t)) ||
      (p.insumo && p.insumo.toLowerCase().includes(t)) ||
      (p.barCode && String(p.barCode).toLowerCase().includes(t)) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(t))
    ).slice(0, 50);
  }

  // ─── Clients ──────────────────────────────────────────────────────────────

  async saveClients(clients: any[]): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction('clientes_cache', 'readwrite');
    const s = tx.objectStore('clientes_cache');
    s.clear();
    for (const c of clients) s.put(c);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getClients(): Promise<any[]> {
    const s = await this.store('clientes_cache', 'readonly');
    return this.wrap(s.getAll());
  }

  // ─── Pending Sales ────────────────────────────────────────────────────────

  async savePendingSale(sale: any, concepts: any[]): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(['ventas_pendientes', 'conceptos_pendientes'], 'readwrite');
    tx.objectStore('ventas_pendientes').put(sale);
    for (const c of concepts) tx.objectStore('conceptos_pendientes').put(c);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingSales(): Promise<any[]> {
    const s = await this.store('ventas_pendientes', 'readonly');
    return this.wrap(s.getAll());
  }

  async getConceptsByLocalSaleId(localId: string): Promise<any[]> {
    const s = await this.store('conceptos_pendientes', 'readonly');
    return this.wrap(s.index('by_sale').getAll(localId));
  }

  async deletePendingSale(localId: string): Promise<void> {
    const concepts = await this.getConceptsByLocalSaleId(localId);
    const db = await this.openDb();
    const tx = db.transaction(['ventas_pendientes', 'conceptos_pendientes'], 'readwrite');
    tx.objectStore('ventas_pendientes').delete(localId);
    for (const c of concepts) tx.objectStore('conceptos_pendientes').delete(c.localId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async countPendingSales(): Promise<number> {
    const s = await this.store('ventas_pendientes', 'readonly');
    return this.wrap(s.count());
  }
}
