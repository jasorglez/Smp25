import { Injectable } from '@angular/core';

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
}

@Injectable({ providedIn: 'root' })
export class QuickActionsService {
  private readonly actions: QuickAction[] = [
    { id: 'requisitions', label: 'Requisiciones', icon: 'bi-clipboard-plus', route: '/shoppingTD/requisitions-st', color: 'warning' },
    { id: 'purchase-orders', label: 'Órdenes de compra', icon: 'bi-cart-check', route: '/shoppingTD/purchaseorder-st', color: 'primary' },
    { id: 'work-orders', label: 'Órdenes de trabajo', icon: 'bi-clipboard-check', route: '/projects/ot', color: 'primary' },
    { id: 'income', label: 'Ingresos', icon: 'bi-plus-circle', route: '/procmodadmon/income', color: 'success' },
    { id: 'expenses', label: 'Egresos', icon: 'bi-dash-circle', route: '/procmodadmon/expend', color: 'danger' },
    { id: 'warehouse-entry', label: 'Entradas de almacén', icon: 'bi-box-arrow-in-down', route: '/warehousesTD/entry-st', color: 'info' },
  ];

  recordRoute(url: string): void {
    const path = url.split('?')[0];
    const action = this.actions.find(item => path === item.route || path.startsWith(`${item.route}/`));
    if (!action) return;

    const usage = this.getUsage();
    const current = usage[action.id] ?? { count: 0, lastUsedAt: 0 };
    usage[action.id] = { count: current.count + 1, lastUsedAt: Date.now() };
    this.saveUsage(usage);
  }

  getTopActions(limit = 3): QuickAction[] {
    const usage = this.getUsage();
    return [...this.actions]
      .filter(action => (usage[action.id]?.count ?? 0) > 0)
      .sort((a, b) => {
        const aUsage = usage[a.id] ?? { count: 0, lastUsedAt: 0 };
        const bUsage = usage[b.id] ?? { count: 0, lastUsedAt: 0 };
        return bUsage.count - aUsage.count || bUsage.lastUsedAt - aUsage.lastUsedAt;
      })
      .slice(0, limit);
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
  }

  private get storageKey(): string {
    const user = (localStorage.getItem('mail') || 'anonymous').toLowerCase();
    return `quick-actions:${user}`;
  }
}
