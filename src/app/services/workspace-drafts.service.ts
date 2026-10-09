import { Injectable } from '@angular/core';

export interface GridDraft {
  rows: { row: any; original: any }[];
  state?: any;
  expanded?: { id: string; type: string }[];
  savedAt: number;
}

// Only business fields participate in conflict detection; display metadata is excluded.
const VIEW_FIELDS = new Set(['detailType', 'detailData', 'visible', 'selectedEntity', 'groupEntity', 'totalFinal', 'ivaManuallyEdited', 'expenseTypeText', 'countItems', 'countitems', 'countDocomps']);
export function businessRow(row: any): any {
  return Object.fromEntries(Object.entries(row || {}).filter(([key]) => !key.startsWith('__') && !VIEW_FIELDS.has(key)));
}
export function changedOnServer(original: any, current: any, _draft?: any): boolean {
  if (!original || !current) return true;
  original = businessRow(original);
  current = businessRow(current);
  return Object.keys(original).some(key => !sameValue(original[key], current[key], key));
}

function sameValue(a: any, b: any, key: string): boolean {
  if (a == null && b == null) return true;
  if (/date|fecha/i.test(key) && a && b) return new Date(a).getTime() === new Date(b).getTime();
  if (typeof a !== 'boolean' && typeof b !== 'boolean' && a !== '' && b !== ''
      && Number.isFinite(Number(a)) && Number.isFinite(Number(b))) return Number(a) === Number(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

@Injectable({ providedIn: 'root' })
export class WorkspaceDraftsService {
  private memory = new Map<string, any>();
  key(scope: string): string {
    try {
      const user = localStorage.getItem('mail');
      return user && scope ? `bi-draft-v1:${encodeURIComponent(user)}:${scope}` : '';
    } catch { return ''; }
  }
  read<T>(key: string): T | null {
    if (!key) return null;
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : this.memory.get(key) ?? null;
    } catch { return this.memory.get(key) ?? null; }
  }
  write(key: string, value: any): boolean {
    if (!key) return false;
    this.memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
}
