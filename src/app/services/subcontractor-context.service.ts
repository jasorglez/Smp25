import { Injectable, signal } from '@angular/core';

export interface SelectedSubcontractor { id: number; name: string; }

@Injectable({ providedIn: 'root' })
export class SubcontractorContextService {
  private readonly storageKey = 'projects-selected-subcontractor';
  readonly selected = signal<SelectedSubcontractor | null>(this.read());

  set(provider: any) {
    const selected = { id: Number(provider?.id), name: provider?.name || provider?.company || '' };
    localStorage.setItem(this.storageKey, JSON.stringify(selected));
    this.selected.set(selected);
  }
  clear() { localStorage.removeItem(this.storageKey); this.selected.set(null); }
  private read(): SelectedSubcontractor | null {
    try { return JSON.parse(localStorage.getItem(this.storageKey) || 'null'); } catch { return null; }
  }
}
