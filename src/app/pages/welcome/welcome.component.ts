import { Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { CompanyPublicityImage, CompanyPublicityService } from 'app/services/company-publicity.service';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { ProductUpdate, ProductUpdatesPage, ProductUpdatesService } from 'app/services/product-updates.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private readonly publicity = inject(CompanyPublicityService);
  private readonly auth = inject(AuthService);
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
  images: CompanyPublicityImage[] = [];
  canManageImages = false;
  get isRootUser(): boolean {
    const flag: unknown = this.signals.getUserRoot()();
    return this.auth.isRoot() || flag === true || Number(flag) === 1 || String(flag).toLowerCase() === 'true';
  }
  uploadBusy = false;
  imageError = '';
  private companyId = 0;
  private imageRequestId = 0;
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

  constructor() {
    effect(() => {
      const companyId = Number(this.signals.getRootSelectedBySidebar()() || 0);
      if (companyId !== this.companyId) {
        this.companyId = companyId;
        void this.loadCompanyImages();
      }
    });
  }

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      if (params.get('showUpdates') === '1') this.openUpdates();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    if (this.updateSearchTimer) clearTimeout(this.updateSearchTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.stopAutoplay();
    this.imageUrls.forEach(url => URL.revokeObjectURL(url));
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

  private clearImageUrls(): void {
    this.stopAutoplay();
    this.imageUrls.forEach(url => URL.revokeObjectURL(url));
    this.imageUrls = [];
    this.alts = [];
    this.images = [];
    this.currentIndex = 0;
  }

  private async loadCompanyImages(): Promise<void> {
    const requestId = ++this.imageRequestId;
    this.clearImageUrls();
    this.canManageImages = false;
    this.imageError = '';
    this.loading = true;
    if (!this.companyId) { this.loading = false; return; }
    try {
      const companyId = this.companyId;
      const result = await firstValueFrom(this.publicity.list(companyId));
      const loaded = await Promise.all((result.images || []).map(async image => {
        try { return { image, blob: await firstValueFrom(this.publicity.image(companyId, image.id)) }; }
        catch { return null; }
      }));
      if (requestId !== this.imageRequestId) return;
      this.canManageImages = result.canManage === true;
      for (const item of loaded) {
        if (!item) continue;
        this.images.push(item.image);
        this.imageUrls.push(URL.createObjectURL(item.blob));
        this.alts.push(item.image.altText || item.image.fileName || 'Publicidad');
      }
    } catch (error) {
      const response = error as HttpErrorResponse;
      if (requestId === this.imageRequestId) {
        this.imageError = response.error?.message
          || `No se pudieron cargar las imágenes de esta empresa${response.status ? ` (HTTP ${response.status})` : ''}.`;
      }
      console.error('Error al cargar publicidad:', error);
    } finally {
      if (requestId === this.imageRequestId) {
        this.loading = false;
        this.startAutoplay();
      }
    }
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.canManageImages || !this.companyId) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      this.imageError = 'Selecciona una imagen PNG, JPG o WebP de máximo 5 MB.';
      return;
    }
    this.uploadBusy = true;
    this.imageError = '';
    try {
      await firstValueFrom(this.publicity.upload(this.companyId, file));
      await this.loadCompanyImages();
    } catch (error) {
      const response = error as HttpErrorResponse;
      this.imageError = response.error?.message
        || (response.status === 403 ? 'No tienes permiso para administrar las imágenes de esta empresa.'
          : `No se pudo subir la imagen${response.status ? ` (HTTP ${response.status})` : ''}.`);
      console.error('Error al subir publicidad:', error);
    }
    finally { this.uploadBusy = false; }
  }

  async deleteImage(image: CompanyPublicityImage): Promise<void> {
    if (!this.canManageImages || !this.companyId || !confirm('¿Borrar esta imagen de publicidad?')) return;
    this.imageError = '';
    try {
      await firstValueFrom(this.publicity.delete(this.companyId, image.id));
      await this.loadCompanyImages();
    } catch { this.imageError = 'No se pudo borrar la imagen.'; }
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
