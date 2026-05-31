import { Component, computed, inject, effect, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '@env/environment';
import { SignalsService } from 'app/services/signals.service';
import { UserPreferencesService } from 'app/services/user-preferences.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent implements OnInit {
  private signalsService  = inject(SignalsService);
  prefsSvc                = inject(UserPreferencesService);
  private cdr             = inject(ChangeDetectorRef);
  environment             = environment;

  showPanel = false;

  companyName = computed(() => this.signalsService.getCompanyName()());
  displayName = computed(() => this.signalsService.getDisplayName()());

  readonly bgOptions = [
    { id: 'dark',      label: 'Oscuro',       color: '#1a1a2e' },
    { id: 'navy',      label: 'Azul Noche',   color: '#003366' },
    { id: 'carbon',    label: 'Carbón',        color: '#e94560' },
    { id: 'emerald',   label: 'Esmeralda',     color: '#0d3b2e' },
    { id: 'graphite',  label: 'Grafito',        color: '#2b2b2b' },
    { id: 'burgundy',  label: 'Borgoña',        color: '#4a0e1e' },
    { id: 'purple',    label: 'Violeta',        color: '#2d1b69' },
    { id: 'teal',      label: 'Teal',           color: '#0d4f4f' },
    { id: 'military',  label: 'Militar',        color: '#2d3a1f' },
    { id: 'light',     label: 'Claro',          color: '#f8f9fa' },
    { id: 'white',     label: 'Blanco',         color: '#ffffff' },
    { id: 'transparent', label: 'Sutil',        color: 'linear-gradient(90deg,#e9ecef,#dee2e6)' },
  ];

  readonly textOptions = [
    { id: 'white',  label: 'Blanco',     color: '#ffffff' },
    { id: 'light',  label: 'Gris claro', color: '#ced4da' },
    { id: 'dark',   label: 'Oscuro',     color: '#212529' },
    { id: 'muted',  label: 'Gris',       color: '#6c757d' },
    { id: 'accent', label: 'Azul',       color: '#74b9ff' },
  ];

  readonly sizeOptions = [
    { id: '8px',  label: '8'  },
    { id: '9px',  label: '9'  },
    { id: '10px', label: '10' },
    { id: '12px', label: '12' },
    { id: '14px', label: '14' },
  ];

  readonly fontOptions = [
    { id: 'Roboto',               label: 'Roboto' },
    { id: 'system-ui',            label: 'Sistema' },
    { id: "'Courier New', monospace", label: 'Mono' },
    { id: "'Segoe UI', sans-serif", label: 'Segoe' },
  ];

  constructor() {
    // Reacciona al signal de prefs (cambios desde sidebar u otro dispositivo)
    effect(() => {
      this.prefsSvc.prefs();
      this.cdr.markForCheck();
    });
  }

  // Mapeo bg id → color real CSS
  private readonly bgMap: Record<string, string> = {
    dark:        '#1a1a2e',
    navy:        '#003366',
    carbon:      '#16213e',
    emerald:     '#0d3b2e',
    graphite:    '#1c1c1c',
    burgundy:    '#4a0e1e',
    purple:      '#2d1b69',
    teal:        '#0d4f4f',
    military:    '#2d3a1f',
    light:       '#f8f9fa',
    white:       '#ffffff',
    transparent: 'transparent',
  };

  private readonly textMap: Record<string, string> = {
    white:  '#ffffff',
    light:  '#ced4da',
    dark:   '#212529',
    muted:  '#6c757d',
    accent: '#74b9ff',
  };

  ngOnInit() { /* prefs las carga el sidebar con el userId correcto */ }

  get footerStyle() {
    const p = this.prefsSvc.prefs();
    return {
      'background':   this.bgMap[p.footerBg]  ?? p.footerBg,
      'color':        this.textMap[p.footerText] ?? p.footerText,
      'font-size':    p.footerSize,
      'font-family':  p.footerFont,
    };
  }

  setBg(id: string)   { this.prefsSvc.save({ footerBg: id }); }
  setText(id: string) { this.prefsSvc.save({ footerText: id }); }
  setSize(id: string) { this.prefsSvc.save({ footerSize: id }); }
  setFont(id: string) { this.prefsSvc.save({ footerFont: id }); }

  togglePanel() { this.showPanel = !this.showPanel; }
  closePanel()  { this.showPanel = false; }
}
