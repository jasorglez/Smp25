import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

const PUBLICIDAD_BASE = 'assets/publicidad/';
const MANIFEST_URL = `${PUBLICIDAD_BASE}manifest.json`;

/** Si falla el manifiesto, se usan estos nombres (deben coincidir con archivos en assets/publicidad). */
const FALLBACK_IMAGE_NAMES: readonly string[] = [
  'Integracio\u0301n de bot con ERP.jpg',
  'Publicidad 2.png',
  'RH 2.png',
  'RH.png',
  'publicidad 1.png',
];

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  readonly welcomeTitle = 'Bienvenido';
  readonly welcomeSubtitle =
    'Aquí puedes ver novedades y publicidad de la empresa.';

  imageUrls: string[] = [];
  alts: string[] = [];
  currentIndex = 0;
  loading = true;

  /** Intervalo entre diapositivas (avance automático). */
  readonly autoplayIntervalMs = 5000;

  private autoplayId: ReturnType<typeof setInterval> | null = null;
  private onVisibilityChange = (): void => {
    if (typeof document === 'undefined') {
      return;
    }
    if (document.hidden) {
      this.stopAutoplay();
    } else if (this.hasSlides && !this.loading) {
      this.startAutoplay();
    }
  };

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.http
      .get<{ images?: string[] }>(MANIFEST_URL)
      .pipe(
        catchError(() =>
          of<{ images?: string[] }>({ images: [...FALLBACK_IMAGE_NAMES] }),
        ),
      )
      .subscribe((data) => {
        const names = data.images?.length ? data.images : [...FALLBACK_IMAGE_NAMES];
        this.applyImageNames(names);
        this.loading = false;
        this.startAutoplay();
      });
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.stopAutoplay();
  }

  get hasSlides(): boolean {
    return this.imageUrls.length > 0;
  }

  get counterLabel(): string {
    if (!this.hasSlides) {
      return '';
    }
    return `${this.currentIndex + 1} / ${this.imageUrls.length}`;
  }

  next(): void {
    if (!this.hasSlides) {
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.imageUrls.length;
    this.restartAutoplay();
  }

  prev(): void {
    if (!this.hasSlides) {
      return;
    }
    this.currentIndex =
      (this.currentIndex - 1 + this.imageUrls.length) % this.imageUrls.length;
    this.restartAutoplay();
  }

  goTo(i: number): void {
    if (i < 0 || i >= this.imageUrls.length) {
      return;
    }
    this.currentIndex = i;
    this.restartAutoplay();
  }

  private applyImageNames(names: string[]): void {
    const trimmed = names.map((n) => n.trim()).filter(Boolean);
    this.imageUrls = trimmed.map(
      (name) => `${PUBLICIDAD_BASE}${encodeURIComponent(name)}`,
    );
    this.alts = trimmed.map((name) => this.altFromFilename(name));
    this.currentIndex = 0;
  }

  private altFromFilename(name: string): string {
    return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim() || 'Publicidad';
  }

  private startAutoplay(): void {
    this.stopAutoplay();
    if (!this.hasSlides || this.loading) {
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    this.autoplayId = setInterval(() => this.next(), this.autoplayIntervalMs);
  }

  private stopAutoplay(): void {
    if (this.autoplayId !== null) {
      clearInterval(this.autoplayId);
      this.autoplayId = null;
    }
  }

  private restartAutoplay(): void {
    this.startAutoplay();
  }
}
