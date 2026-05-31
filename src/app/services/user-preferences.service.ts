import { Injectable, signal, inject } from '@angular/core';
import { Database, ref, get, set } from '@angular/fire/database';
import { SignalsService } from './signals.service';

export interface UserPrefs {
  sidebarTheme: string;
  sidebarSize:  string;
  sidebarFont:  string;
  sidebarText:  string;
  footerBg:     string;
  footerText:   string;
  footerSize:   string;
  footerFont:   string;
}

const DEFAULTS: UserPrefs = {
  sidebarTheme: 'blue',
  sidebarSize:  '12px',
  sidebarFont:  'Roboto',
  sidebarText:  'auto',
  footerBg:     'dark',
  footerText:   'white',
  footerSize:   '12px',
  footerFont:   'Roboto',
};

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private db             = inject(Database);
  private signalsService = inject(SignalsService);

  readonly prefs = signal<UserPrefs>({ ...DEFAULTS });

  private get userId(): number { return this.signalsService.idUser(); }
  private cacheKey(userId: number) { return `userPrefs_${userId}`; }

  /** Carga el caché LOCAL del usuario específico (render instantáneo antes de Firebase) */
  loadFromCache(userId: number) {
    if (!userId) { this.prefs.set({ ...DEFAULTS }); return; }
    const raw = localStorage.getItem(this.cacheKey(userId));
    if (raw) {
      try { this.prefs.set({ ...DEFAULTS, ...JSON.parse(raw) }); return; } catch { /* JSON corrupto */ }
    }
    this.prefs.set({ ...DEFAULTS }); // usuario sin caché → defaults limpios
  }

  /** Carga desde Firebase y sobreescribe. Si no hay datos → defaults limpios. */
  async load(userId: number) {
    if (!userId) return;
    try {
      const snap = await get(ref(this.db, `userPrefs/${userId}/prefs`));
      const merged = snap.exists()
        ? { ...DEFAULTS, ...snap.val() }
        : { ...DEFAULTS };
      this.prefs.set(merged);
      // Actualizar caché local de ESTE usuario
      localStorage.setItem(this.cacheKey(userId), JSON.stringify(merged));
    } catch {
      // Firebase falló — dejamos lo que haya en caché (ya cargado por loadFromCache)
    }
  }

  async save(partial: Partial<UserPrefs>) {
    const updated = { ...this.prefs(), ...partial };
    this.prefs.set(updated);
    const uid = this.userId;
    if (uid) {
      localStorage.setItem(this.cacheKey(uid), JSON.stringify(updated));
      try { await set(ref(this.db, `userPrefs/${uid}/prefs`), updated); } catch { /* silencio */ }
    }
  }
}
