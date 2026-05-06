import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, AppTheme } from 'app/services/theme.service';

@Component({
  selector: 'app-red-procesos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './procesos.component.html',
})
export class RedProcesosComponent {
  themeService = inject(ThemeService);

  readonly options: { value: AppTheme; label: string; icon: string }[] = [
    { value: 'system', label: 'Sistema',  icon: 'bi-display'    },
    { value: 'light',  label: 'Claro',    icon: 'bi-sun'        },
    { value: 'dark',   label: 'Oscuro',   icon: 'bi-moon-stars' },
  ];

  setTheme(theme: AppTheme): void {
    this.themeService.set(theme);
  }
}
