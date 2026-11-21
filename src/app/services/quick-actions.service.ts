import { Injectable, signal } from '@angular/core';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  color: string;
}

interface ActionUsage {
  count: number;
  lastUsedAt: number;
  label?: string;
  route?: string;
  icon?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class QuickActionsService {
  private readonly favoritesRevision = signal(0);

  private readonly actions: QuickAction[] = [
    { id: 'requisitions', label: 'Requisiciones', icon: 'bi-clipboard-plus', route: '/shoppingTD/requisitions-st', color: 'warning' },
    { id: 'purchase-orders', label: 'Órdenes de compra', icon: 'bi-cart-check', route: '/shoppingTD/purchaseorder-st', color: 'primary' },
    { id: 'work-orders', label: 'Órdenes de trabajo', icon: 'bi-clipboard-check', route: '/projects/ot', color: 'primary' },
    { id: 'income', label: 'Ingresos', icon: 'bi-plus-circle', route: '/procmodadmon/income', color: 'success' },
    { id: 'expenses', label: 'Egresos', icon: 'bi-dash-circle', route: '/procmodadmon/expend', color: 'danger' },
    { id: 'warehouse-entry', label: 'Entradas de almacén', icon: 'bi-box-arrow-in-down', route: '/warehousesTD/entry-st', color: 'info' },
  ];

  recordRoute(url: string): void {
    const path = this.normalizePath(url);
    if (!path || this.isExcludedRoute(path)) return;

    const user = this.currentUser;
    if (!user) return;

    const knownAction = this.actions
      .filter(item => path === item.route || path.startsWith(`${item.route}/`))
      .sort((a, b) => b.route.length - a.route.length)[0];
    const action: QuickAction = knownAction ?? {
      id: `route:${path}`,
      label: this.resolveRouteLabel(path),
      icon: 'bi bi-clock-history',
      route: path,
      color: 'primary',
    };

    const usage = this.getUsage();
    const current = usage[action.id] ?? { count: 0, lastUsedAt: 0 };
    usage[action.id] = {
      ...current,
      count: current.count + 1,
      lastUsedAt: Date.now(),
      label: knownAction ? current.label : action.label,
      route: action.route,
      icon: action.icon,
      color: action.color,
    };
    this.saveUsage(usage);
  }

  getTopActions(limit = 3): QuickAction[] {
    this.favoritesRevision();
    const usage = this.getUsage();
    const dismissed = this.getDismissed();
    const staticActions = this.actions.filter(action => (usage[action.id]?.count ?? 0) > 0);
    const dynamicActions: QuickAction[] = Object.entries(usage)
      .filter(([id, item]) => id.startsWith('route:') && !!item.route && !!item.label && !this.isExcludedRoute(item.route))
      .map(([id, item]) => ({
        id,
        route: item.route!,
        label: item.label!,
        icon: item.icon || 'bi bi-clock-history',
        color: item.color || 'primary',
      }));

    return [...staticActions, ...dynamicActions]
      .filter(action => !dismissed[action.id])
      .sort((a, b) => {
        const aUsage = usage[a.id] ?? { count: 0, lastUsedAt: 0 };
        const bUsage = usage[b.id] ?? { count: 0, lastUsedAt: 0 };
        return bUsage.count - aUsage.count || bUsage.lastUsedAt - aUsage.lastUsedAt;
      })
      .slice(0, limit);
  }

  dismissAction(actionId: string): void {
    const dismissed = this.getDismissed();
    dismissed[actionId] = true;
    this.saveDismissed(dismissed);
  }

  hasDismissedActions(): boolean {
    return Object.keys(this.getDismissed()).length > 0;
  }

  restoreDismissedActions(): void {
    localStorage.removeItem(this.dismissedStorageKey);
  }

  private getUsage(): Record<string, ActionUsage> {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    } catch {
      return {};
    }
  }

  private saveUsage(usage: Record<string, ActionUsage>): void {
    localStorage.setItem(this.storageKey, JSON.stringify(usage));
    this.favoritesRevision.update(value => value + 1);
  }

  private getDismissed(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(this.dismissedStorageKey) || '{}');
    } catch {
      return {};
    }
  }

  private saveDismissed(dismissed: Record<string, boolean>): void {
    localStorage.setItem(this.dismissedStorageKey, JSON.stringify(dismissed));
    this.favoritesRevision.update(value => value + 1);
  }

  private normalizePath(url: string): string {
    const path = (url || '').split(/[?#]/)[0].replace(/\/+$/, '');
    return path.startsWith('/') ? path : `/${path}`;
  }

  private isExcludedRoute(path: string): boolean {
    if (path === '/' || path === '/cobranza') return true;
    return ['/login', '/demo', '/logout', '/not-found', '/unauthorized']
      .some(route => path === route || path.startsWith(`${route}/`));
  }

  private resolveRouteLabel(path: string): string {
    if (typeof document !== 'undefined') {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const matchingAnchor = anchors
        .map(anchor => ({
          anchor,
          path: this.normalizePath(new URL(anchor.href, document.baseURI).pathname),
        }))
        .filter(item => item.path === path)
        .sort((a, b) => b.path.length - a.path.length)[0]?.anchor;
      const labelNode = matchingAnchor?.cloneNode(true) as HTMLAnchorElement | undefined;
      labelNode?.querySelectorAll('mat-icon, .material-icons, .mat-icon').forEach(icon => icon.remove());
      const label = matchingAnchor?.getAttribute('aria-label')
        || matchingAnchor?.getAttribute('title')
        || labelNode?.textContent?.trim();
      if (label) return label.replace(/\s+/g, ' ');
    }

    const segments = path.split('/').filter(Boolean);
    const leaf = segments[segments.length - 1] || path;
    return leaf
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  private get currentUser(): string {
    try {
      return (localStorage.getItem('mail') || '').trim().toLowerCase();
    } catch {
      return '';
    }
  }

  private get storageKey(): string {
    return `quick-actions:${this.currentUser || 'anonymous'}`;
  }

  private get dismissedStorageKey(): string {
    return `quick-actions-dismissed:${this.currentUser || 'anonymous'}`;
  }
}
