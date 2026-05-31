import { Injectable, signal, inject } from '@angular/core';
import { Database, ref, get, set } from '@angular/fire/database';
import { SignalsService } from './signals.service';

export interface UserPrefs {
  sidebarTheme:  string;
  footerBg:      string;
  footerText:    string;
  footerSize:    string;
  footerFont:    string;
}

const DEFAULTS: UserPrefs = {
  sidebarTheme: 'blue',
  footerBg:     'dark',
  footerText:   'white',
  footerSize:   '12px',
  footerFont:   'Roboto',
};

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private db            = inject(Database);
  private signalsService = inject(SignalsService);

  readonly prefs = signal<UserPrefs>({ ...DEFAULTS });

  private get userId(): number { return this.signalsService.idUser(); }

  async load(userId: number) {
    if (!userId) return;
    try {
      const snap = await get(ref(this.db, `userPrefs/${userId}/prefs`));
      if (snap.exists()) {
        this.prefs.set({ ...DEFAULTS, ...snap.val() });
      }
    } catch { /* silencio si Firebase falla */ }
  }

  async save(partial: Partial<UserPrefs>) {
    const updated = { ...this.prefs(), ...partial };
    this.prefs.set(updated);
    const uid = this.userId;
    if (uid) {
      try { await set(ref(this.db, `userPrefs/${uid}/prefs`), updated); } catch { /* silencio */ }
    }
    // cache local para render instantáneo en próxima carga
    localStorage.setItem('userPrefs', JSON.stringify(updated));
  }

  loadFromCache() {
    const raw = localStorage.getItem('userPrefs');
    if (raw) {
      try { this.prefs.set({ ...DEFAULTS, ...JSON.parse(raw) }); } catch { /* ignorar JSON corrupto */ }
    }
  }
}
