import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { ProductUpdate, ProductUpdatesPage, ProductUpdatesService } from 'app/services/product-updates.service';
import { environment } from '@env/environment';

interface PublicityImage {
  file: string;
  alt: string;
}

const PUBLIC_IMAGE_BASE = 'assets/media/inicio/';
const PUBLIC_IMAGE_CACHE_KEY = encodeURIComponent(environment.version);
const MANIFEST_URL = `${PUBLIC_IMAGE_BASE}manifest.json?v=${PUBLIC_IMAGE_CACHE_KEY}`;

/** Debe coincidir con los archivos neutrales de assets/media/inicio. */
const FALLBACK_IMAGES: readonly PublicityImage[] = [
  { file: 'slide-01.png', alt: '3 erp' },
  { file: 'slide-02.png', alt: 'demo para obras' },
  { file: 'slide-03.png', alt: 'erp construccion' },
  { file: 'slide-04.png', alt: 'Gestión de obras con ERP y bot' },
  { file: 'slide-05.png', alt: 'Historia' },
  { file: 'slide-06.jpg', alt: 'Integración de bot con ERP' },
  { file: 'slide-07.jpg', alt: 'Inteligencia empresarial en tiempo real' },
  { file: 'slide-08.png', alt: 'Intensive frontend development course promotion 1' },
  { file: 'slide-09.png', alt: 'publicidad 1' },
  { file: 'slide-10.png', alt: 'Publicidad 2' },
  { file: 'slide-11.png', alt: 'Publicidad de ERP para construcción' },
  { file: 'slide-12.png', alt: 'RH 2' },
  { file: 'slide-13.png', alt: 'RH' },
  { file: 'slide-14.jpg', alt: 'Solución integral para ventas y ERP logo' },
  { file: 'slide-15.png', alt: 'ventas x whatsapp' },
  { file: 'slide-16.png', alt: 'ventas xwhats' },
  { file: 'slide-17.png', alt: 'Ventas' },
];

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly updatesService = inject(ProductUpdatesService);
  private readonly signals = inject(SignalsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly welcomeTitle = 'Bienvenido';
  readonly welcomeSubtitle =
    'Aquí puedes ver novedades y publicidad de la empresa.';
  readonly announcements = [
    {
      category: 'Actualización',
      title: 'Reportes PDF en la misma ventana',
      description: 'Genera y revisa tus reportes sin perder las fechas seleccionadas.',
      icon: 'bi-file-earmark-pdf',
      highlight: true,
      href: null,
    },
    {
      category: 'Nuevo en tu inicio',
      title: 'Un saludo más personal',
      description: 'Consulta también los próximos días festivos de tu país.',
      icon: 'bi-calendar-event',
      highlight: false,
      href: null,
    },
    {
      category: 'Tutoriales',
      title: 'Visita nuestro canal de YouTube',
      description: 'Encuentra demostraciones, consejos y guías para aprovechar el sistema.',
      icon: 'bi-youtube',
      highlight: false,
      href: 'https://www.youtube.com/@bi2mx',
    },
    {
      category: 'Actualizaciones',
      title: 'Conoce las nuevas funciones',
      description: 'Revisa esta sección para enterarte de mejoras y formas más rápidas de trabajar.',
      icon: 'bi-lightbulb',
      highlight: false,
      href: null,
    },
  ];

  imageUrls: string[] = [];
  alts: string[] = [];
  currentIndex = 0;
  loading = true;
  showUpdates = false;
  updatesLoading = false;
  updatesError = '';
  updates: ProductUpdate[] = [];
  updateSearch = '';
  updatesTotalCount = 0;
  updatesPage = 1;
  readonly updatesPageSize = 20;
  private updateSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private updatesRequestId = 0;

  /** Intervalo entre diapositivas (avance automático). */
  readonly autoplayIntervalMs = 5000;

  private autoplayId: ReturnType<typeof setInterval> | null = null;
  private queryParamsSubscription?: { unsubscribe(): void };
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
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      if (params.get('showUpdates') === '1') this.openUpdates();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.http
      .get<{ images?: PublicityImage[] }>(MANIFEST_URL)
      .pipe(
        catchError(() =>
          of<{ images?: PublicityImage[] }>({ images: [...FALLBACK_IMAGES] }),
        ),
      )
      .subscribe((data) => {
        const images = data.images?.length ? data.images : [...FALLBACK_IMAGES];
        this.applyImageNames(images);
        this.loading = false;
        this.startAutoplay();
      });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    if (this.updateSearchTimer) clearTimeout(this.updateSearchTimer);
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

  get filteredUpdates(): ProductUpdate[] {
    return this.updates;
  }

  get updatesPageCount(): number {
    return Math.max(1, Math.ceil(this.updatesTotalCount / this.updatesPageSize));
  }

  openUpdates(): void {
    this.showUpdates = true;
    this.updateSearch = '';
    this.updatesPage = 1;
    this.updatesError = '';
    this.loadUpdatesPage();
  }

  onUpdateSearchChange(): void {
    if (this.updateSearchTimer) clearTimeout(this.updateSearchTimer);
    this.updateSearchTimer = setTimeout(() => {
      this.updatesPage = 1;
      this.loadUpdatesPage();
    }, 300);
  }

  goToUpdatesPage(page: number): void {
    const nextPage = Math.max(1, Math.min(this.updatesPageCount, Number(page) || 1));
    if (nextPage === this.updatesPage || this.updatesLoading) return;
    this.updatesPage = nextPage;
    this.loadUpdatesPage();
  }

  private loadUpdatesPage(): void {
    const idRoot = Number(this.signals.getRootSelectedBySidebar()() || 0);
    if (!idRoot) {
      this.updates = [];
      this.updatesTotalCount = 0;
      this.updatesLoading = false;
      this.updatesError = 'Selecciona una empresa para consultar las actualizaciones.';
      return;
    }

    this.updatesLoading = true;
    this.updatesError = '';
    const requestId = ++this.updatesRequestId;
    this.updatesService.getPublishedPage(idRoot, this.updatesPage, this.updatesPageSize, this.updateSearch).pipe(
      catchError((error) => {
        console.error('No se pudieron cargar las actualizaciones:', error);
        if (requestId === this.updatesRequestId) {
          this.updatesError = 'No se pudieron cargar las actualizaciones. Intenta de nuevo.';
        }
        return of({ items: [], totalCount: 0, page: this.updatesPage, pageSize: this.updatesPageSize } as ProductUpdatesPage);
      }),
    ).subscribe((response) => {
      if (requestId !== this.updatesRequestId) return;
      this.updates = response?.items ?? [];
      this.updatesTotalCount = Number(response?.totalCount || 0);
      this.updatesLoading = false;
    });
  }

  closeUpdates(): void {
    this.showUpdates = false;
    if (this.route.snapshot.queryParamMap.has('showUpdates')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showUpdates: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  formatUpdateDate(value: string, timeZone?: string | null): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timeZone || 'America/Indiana/Indianapolis',
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
    }
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

  private applyImageNames(images: PublicityImage[]): void {
    const availableImages = images.filter((image) => image.file?.trim());
    this.imageUrls = availableImages.map(
      (image) => `${PUBLIC_IMAGE_BASE}${encodeURIComponent(image.file.trim())}?v=${PUBLIC_IMAGE_CACHE_KEY}`,
    );
    this.alts = availableImages.map(
      (image) => image.alt?.trim() || this.altFromFilename(image.file),
    );
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
