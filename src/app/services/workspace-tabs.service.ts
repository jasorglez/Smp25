import { Injectable, signal } from '@angular/core';

export interface WorkspaceTab {
  url: string;
  title: string;
}

/**
 * Mantiene las pantallas abiertas del área de trabajo.  Las pestañas son de
 * navegación: la ruta sigue siendo la fuente de verdad y por eso los enlaces,
 * el botón Atrás y las ligas directas continúan funcionando igual.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceTabsService {
  private readonly storageKey = 'bi-workspace-tabs';
  private readonly menuContainers = new Set([
    'almacenes', 'dashboardgrales', 'logistica', 'pmo', 'presupuestos',
    'procmodadmon', 'procmodmaintenance', 'proceswar', 'procreshuman',
    'projects', 'shoppingDelison', 'shoppingTD', 'smp', 'warehousesTD',
  ]);

  readonly tabs = signal<WorkspaceTab[]>(this.readTabs());
  readonly activeUrl = signal<string>('');

  register(url: string, title: string): void {
    const normalizedUrl = this.normalizeUrl(url);
    const currentTabs = this.tabs();
    const existing = currentTabs.find(tab => tab.url === normalizedUrl);

    if (existing) {
      if (existing.title !== title) {
        this.tabs.set(currentTabs.map(tab => tab.url === normalizedUrl ? { ...tab, title } : tab));
        this.persist();
      }
    } else {
      this.tabs.set([...currentTabs, { url: normalizedUrl, title }]);
      this.persist();
    }

    this.activeUrl.set(normalizedUrl);
  }

  close(url: string): WorkspaceTab | undefined {
    const normalizedUrl = this.normalizeUrl(url);
    const currentTabs = this.tabs();
    const index = currentTabs.findIndex(tab => tab.url === normalizedUrl);
    if (index < 0 || currentTabs.length === 1) return undefined;

    const nextTabs = currentTabs.filter(tab => tab.url !== normalizedUrl);
    const nextActive = nextTabs[Math.max(0, index - 1)];
    this.tabs.set(nextTabs);
    this.persist();

    if (this.activeUrl() === normalizedUrl) {
      this.activeUrl.set(nextActive.url);
      return nextActive;
    }

    return undefined;
  }

  remove(url: string): void {
    const normalizedUrl = this.normalizeUrl(url);
    const nextTabs = this.tabs().filter(tab => tab.url !== normalizedUrl);
    if (nextTabs.length === this.tabs().length) return;

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

  private normalizeUrl(url: string): string {
    const withoutFragment = url.split('#')[0];
    return withoutFragment.length > 1 && withoutFragment.endsWith('/')
      ? withoutFragment.slice(0, -1)
      : withoutFragment;
  }

  private readTabs(): WorkspaceTab[] {
    try {
      const saved = sessionStorage.getItem(this.storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter(tab =>
          typeof tab?.url === 'string' &&
          typeof tab?.title === 'string' &&
          !this.isGeneralMenu(tab.url)
        )
        : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.tabs()));
    } catch {
      // La navegación no depende de que el navegador permita almacenamiento.
    }
  }

  isGeneralMenu(url: string): boolean {
    const path = this.normalizeUrl(url).split('?')[0];
    const segments = path.split('/').filter(Boolean);
    return segments.length === 1 && this.menuContainers.has(segments[0]);
  }
}
