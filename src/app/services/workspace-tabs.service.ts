import { Injectable, signal } from '@angular/core';

export interface WorkspaceTab {
  url: string;
  title: string;
}

/** Mantiene las pantallas de trabajo abiertas y las restaura por usuario. */
@Injectable({ providedIn: 'root' })
export class WorkspaceTabsService {
  private readonly storagePrefix = 'bi-workspace-v2:';
  private readonly legacyStorageKey = 'bi-workspace-tabs';
  private readonly menuContainers = new Set([
    'almacenes', 'dashboardgrales', 'logistica', 'pmo', 'presupuestos',
    'procmodadmon', 'procmodmaintenance', 'proceswar', 'procreshuman',
    'projects', 'shoppingDelison', 'shoppingTD', 'smp', 'warehousesTD',
  ]);

  readonly tabs = signal<WorkspaceTab[]>([]);
  readonly activeUrl = signal<string>('');
  private loadedUser = '';

  /** Lee la sesión de trabajo del usuario autenticado sin alterar su URL activa. */
  restoreForCurrentUser(): string | null {
    this.ensureUserLoaded();
    return this.activeUrl() || null;
  }

  register(url: string, title: string): void {
    this.ensureUserLoaded();
    const normalizedUrl = this.normalizeUrl(url);
    const currentTabs = this.tabs();
    const existing = currentTabs.find(tab => tab.url === normalizedUrl);

    if (existing) {
      if (existing.title !== title) {
        this.tabs.set(currentTabs.map(tab => tab.url === normalizedUrl ? { ...tab, title } : tab));
      }
    } else {
      this.tabs.set([...currentTabs, { url: normalizedUrl, title }]);
    }

    this.activeUrl.set(normalizedUrl);
    this.persist();
  }

  close(url: string): WorkspaceTab | undefined {
    const normalizedUrl = this.normalizeUrl(url);
    const currentTabs = this.tabs();
    const index = currentTabs.findIndex(tab => tab.url === normalizedUrl);
    if (index < 0) return undefined;

    if (currentTabs.length === 1) {
      this.tabs.set([]);
      this.activeUrl.set('');
      this.persist();
      return { url: '/publicidad', title: 'Inicio' };
    }

    const nextTabs = currentTabs.filter(tab => tab.url !== normalizedUrl);
    const nextActive = nextTabs[Math.max(0, index - 1)];
    const wasActive = this.activeUrl() === normalizedUrl;
    this.tabs.set(nextTabs);
    if (wasActive) this.activeUrl.set(nextActive.url);
    this.persist();
    return wasActive ? nextActive : undefined;
  }

  /** Cierra todas las pestañas por solicitud explícita del usuario. */
  closeAll(): void {
    this.tabs.set([]);
    this.activeUrl.set('');
    this.persist();
  }

  /** Limpia solo el estado en memoria al salir; conserva pestañas y borradores. */
  preserveForLogout(): void {
    this.tabs.set([]);
    this.activeUrl.set('');
    this.loadedUser = '';
  }

  remove(url: string): void {
    const normalizedUrl = this.normalizeUrl(url);
    const currentTabs = this.tabs();
    const nextTabs = currentTabs.filter(tab => tab.url !== normalizedUrl);
    if (nextTabs.length === currentTabs.length) return;

    this.tabs.set(nextTabs);
    if (this.activeUrl() === normalizedUrl) this.activeUrl.set('');
    this.persist();
  }

  move(sourceUrl: string, targetUrl: string): void {
    const source = this.normalizeUrl(sourceUrl);
    const target = this.normalizeUrl(targetUrl);
    if (source === target) return;

    const currentTabs = [...this.tabs()];
    const sourceIndex = currentTabs.findIndex(tab => tab.url === source);
    const targetIndex = currentTabs.findIndex(tab => tab.url === target);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [tab] = currentTabs.splice(sourceIndex, 1);
    const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    currentTabs.splice(insertAt, 0, tab);
    this.tabs.set(currentTabs);
    this.persist();
  }

  private ensureUserLoaded(): void {
    let user = '';
    try { user = localStorage.getItem('mail') || ''; } catch { return; }
    if (!user || user === this.loadedUser) return;

    const storageKey = this.storageKey(user);
    let saved: any = null;
    try {
      const encoded = localStorage.getItem(storageKey);
      if (encoded) saved = JSON.parse(encoded);
      if (!saved) {
        const legacy = sessionStorage.getItem(this.legacyStorageKey);
        if (legacy) {
          saved = { tabs: JSON.parse(legacy), activeUrl: '' };
          localStorage.setItem(storageKey, JSON.stringify(saved));
          sessionStorage.removeItem(this.legacyStorageKey);
        }
      }
    } catch { saved = null; }

    const tabs = Array.isArray(saved?.tabs) ? saved.tabs.filter((tab: any) =>
      typeof tab?.url === 'string' && typeof tab?.title === 'string' && !this.isGeneralMenu(tab.url)
    ).map((tab: WorkspaceTab) => ({ ...tab, url: this.normalizeUrl(tab.url) })) : [];
    this.tabs.set(tabs);
    const active = typeof saved?.activeUrl === 'string' ? this.normalizeUrl(saved.activeUrl) : '';
    this.activeUrl.set(tabs.some(tab => tab.url === active) ? active : (tabs.at(-1)?.url || ''));
    this.loadedUser = user;
  }

  private storageKey(user: string): string {
    return `${this.storagePrefix}${encodeURIComponent(user)}`;
  }

  private normalizeUrl(url: string): string {
    const withoutFragment = url.split('#')[0];
    return withoutFragment.length > 1 && withoutFragment.endsWith('/')
      ? withoutFragment.slice(0, -1)
      : withoutFragment;
  }

  private persist(): void {
    let user = '';
    try { user = localStorage.getItem('mail') || ''; } catch { return; }
    if (!user) return;
    try {
      localStorage.setItem(this.storageKey(user), JSON.stringify({ tabs: this.tabs(), activeUrl: this.activeUrl() }));
    } catch {
      // La navegación sigue funcionando si el navegador no permite almacenamiento.
    }
  }

  isGeneralMenu(url: string): boolean {
    const path = this.normalizeUrl(url).split('?')[0];
    const segments = path.split('/').filter(Boolean);
    return segments.length === 1 && this.menuContainers.has(segments[0]);
  }
}
