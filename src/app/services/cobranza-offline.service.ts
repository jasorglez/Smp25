import { Injectable, signal } from '@angular/core';
import { Observable, catchError, from, map, of, throwError, tap } from 'rxjs';
import { CobranzaOfflineOperation, CobranzaOfflineStoreService } from './cobranza-offline-store.service';

export interface CobranzaOfflineGrant {
  email: string;
  userId: number;
  companyId: number;
  branchId: number | null;
  permissions: any;
  verifiedAt: number;
}

@Injectable({ providedIn: 'root' })
export class CobranzaOfflineService {
  static readonly MAX_OFFLINE_HOURS = 8;
  private readonly grantKey = 'biapp.cobranza.offline-grant.v1';
  private readonly lastSyncKey = 'biapp.cobranza.last-sync.v1';
  private onlineSignal = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly isOnline = this.onlineSignal.asReadonly();
  readonly lastSyncAt = signal<string | null>(this.readLastSync());
  readonly pendingCount = signal(0);
  readonly preparationProgress = signal('');
  readonly syncRevision = signal(0);
  readonly syncError = signal('');

  constructor(private readonly store: CobranzaOfflineStoreService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onlineSignal.set(true));
      window.addEventListener('offline', () => this.onlineSignal.set(false));
    }
  }

  get isOffline(): boolean { return !this.isOnline(); }

  snapshotKey(category: string, ...parts: Array<string | number>): string {
    return `cobranza:${category}:${parts.map(value => String(value)).join(':')}`;
  }

  async saveSnapshot<T>(key: string, companyId: number, category: string, value: T): Promise<void> {
    await this.store.saveSnapshot({ key, companyId, category, value });
  }

  async readSnapshot<T>(key: string): Promise<T | null> {
    return (await this.store.getSnapshot<T>(key))?.value ?? null;
  }

  cachedRequest<T>(key: string, category: string, companyId: number, request: Observable<T>): Observable<T> {
    const cached = () => from(this.store.getSnapshot<T>(key)).pipe(
      map(snapshot => {
        if (!snapshot) throw new Error(`No hay datos locales preparados para ${category}.`);
        return snapshot.value;
      })
    );
    if (this.isOffline) return cached();
    return request.pipe(
      tap(value => { void this.saveSnapshot(key, companyId, category, value); }),
      catchError(error => cached().pipe(catchError(() => throwError(() => error))))
    );
  }

  async queueOperation(operation: Omit<CobranzaOfflineOperation, 'id' | 'createdAt' | 'status'>): Promise<CobranzaOfflineOperation> {
    const saved = await this.store.enqueue({ ...operation, userEmail: localStorage.getItem('mail') || undefined });
    await this.refreshPendingCount(operation.companyId);
    return saved;
  }

  async recordVerifiedSession(grant: Omit<CobranzaOfflineGrant, 'verifiedAt'>): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.onLine || !grant.email || !grant.userId || !grant.companyId
      || grant.permissions?.cobranzas?.active !== true) return;
    const saved: CobranzaOfflineGrant = { ...grant, verifiedAt: Date.now() };
    localStorage.setItem(this.grantKey, JSON.stringify(saved));
  }

  readValidGrant(email?: string, companyId?: number): CobranzaOfflineGrant | null {
    if (!this.isOffline) return null;
    try {
      const raw = localStorage.getItem(this.grantKey);
      if (!raw) return null;
      const grant = JSON.parse(raw) as CobranzaOfflineGrant;
      const expired = !Number.isFinite(grant.verifiedAt)
        || Date.now() - grant.verifiedAt > CobranzaOfflineService.MAX_OFFLINE_HOURS * 60 * 60 * 1000;
      if (expired || grant.permissions?.cobranzas?.active !== true
        || (email && grant.email.toLowerCase() !== email.toLowerCase())
        || (companyId && Number(grant.companyId) !== Number(companyId))) return null;
      return grant;
    } catch {
      return null;
    }
  }

  hasValidOfflineSession(): boolean { return !!this.readValidGrant(); }

  hasStoredOfflineGrant(): boolean {
    try { return !!localStorage.getItem(this.grantKey); }
    catch { return false; }
  }

  getOfflineRemainingMs(): number {
    const grant = this.readValidGrant();
    if (!grant) return 0;
    return Math.max(0, grant.verifiedAt + CobranzaOfflineService.MAX_OFFLINE_HOURS * 60 * 60 * 1000 - Date.now());
  }

  clearOfflineGrant(): void {
    localStorage.removeItem(this.grantKey);
  }

  async markSnapshotSynced(): Promise<void> {
    const now = new Date().toISOString();
    localStorage.setItem(this.lastSyncKey, now);
    this.lastSyncAt.set(now);
    try { await navigator.storage?.persist?.(); } catch { /* El navegador puede no ofrecer persistencia solicitada. */ }
  }

  notifySyncCompleted(): void { this.syncRevision.update(value => value + 1); }
  setSyncError(message: string): void { this.syncError.set(message); }

  async refreshPendingCount(companyId: number): Promise<void> {
    try { this.pendingCount.set((await this.store.getPendingOperations(companyId)).length); }
    catch { this.pendingCount.set(0); }
  }

  private readLastSync(): string | null {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(this.lastSyncKey);
  }
}
