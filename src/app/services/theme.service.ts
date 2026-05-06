import { Injectable, signal } from '@angular/core';

export type AppTheme = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'app-theme';
  private readonly mq = window.matchMedia('(prefers-color-scheme: dark)');

  readonly theme = signal<AppTheme>(this.getStoredTheme());

  constructor() {
    this.apply(this.theme());
    // Actualiza el tema cuando cambia la preferencia del OS (solo cuando está en modo "sistema")
    this.mq.addEventListener('change', () => {
      if (this.theme() === 'system') this.apply('system');
    });
  }

  set(theme: AppTheme): void {
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.theme.set(theme);
    this.apply(theme);
  }

  private getStoredTheme(): AppTheme {
    const stored = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  }

  private apply(theme: AppTheme): void {
    const bsTheme = theme === 'system'
      ? (this.mq.matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-bs-theme', bsTheme);
  }
}
