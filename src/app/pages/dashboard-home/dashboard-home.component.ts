import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DashAdmonComponent } from './components/dash-admon.component';
import { DashProjectsComponent } from './components/dash-projects.component';
import { DashWarehouseComponent } from './components/dash-warehouse.component';
import { CrmDashboardComponent } from 'app/domains/ModSales/components/crm-dashboard/crm-dashboard.component';
import { AdministrationService } from 'app/services/administration.service';
import { QuickActionsService } from 'app/services/quick-actions.service';
import { SignalsService } from 'app/services/signals.service';
import { DashAiComponent } from './components/dash-ai.component';
import { UsersService } from 'app/services/users.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DashAdmonComponent, DashProjectsComponent, DashWarehouseComponent, CrmDashboardComponent, DashAiComponent],
  template: `
    <div class="dashboard-wrapper">
      <div class="dashboard-body">
      <section class="dashboard-welcome">
        <div class="dashboard-welcome-copy">
          <span class="dashboard-clock"><i class="bi bi-clock"></i> {{ clockText }}</span>
          <div class="dashboard-greeting-line">
            <h4>{{ greeting }}, {{ userName }}</h4>
          </div>
          <p *ngIf="projectName()"><i class="bi bi-kanban me-1"></i>{{ projectName() }}</p>
          <p *ngIf="!projectName()">Aquí tienes el resumen de tu operación.</p>
          <div class="dashboard-holidays" *ngIf="upcomingHolidays.length">
            <span><i class="bi bi-calendar-event me-1"></i>Próximos días festivos en {{ holidayCountryName }}</span>
            <span *ngFor="let holiday of upcomingHolidays">
              <strong>{{ holiday.dateLabel }}</strong> · {{ holiday.localName || holiday.name }}
            </span>
          </div>
        </div>
        <a routerLink="/publicidad" class="dashboard-publicidad-link">
          <i class="bi bi-megaphone-fill" aria-hidden="true"></i>
          <span>Publicidad</span>
          <span class="dashboard-publicidad-hint">Novedades y anuncios de la empresa</span>
          <i class="bi bi-chevron-right dashboard-publicidad-chevron" aria-hidden="true"></i>
        </a>
        <div class="dashboard-context">
          <div>
            <i class="bi bi-building"></i>
            <span>Sucursal activa</span>
            <strong>{{ branchName() || 'Todas las sucursales' }}</strong>
          </div>
          <div *ngIf="projectName()">
            <i class="bi bi-briefcase"></i>
            <span>Proyecto activo</span>
            <strong>{{ projectName() }}</strong>
          </div>
        </div>
      </section>

      <!-- Pestañas -->
      <ul class="nav nav-tabs px-3 pt-2">
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'admon'" (click)="activeTab = 'admon'">
            <i class="bi bi-bar-chart-line me-1"></i> Administración
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'proyectos'" (click)="activeTab = 'proyectos'">
            <i class="bi bi-kanban me-1"></i> Proyectos
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'almacenes'" (click)="activeTab = 'almacenes'">
            <i class="bi bi-box-seam me-1"></i> Almacenes
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'ventas'" (click)="activeTab = 'ventas'">
            <i class="bi bi-cart3 me-1"></i> Ventas
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab === 'ia'" (click)="activeTab = 'ia'">
            <i class="bi bi-stars me-1"></i> Inteligencia IA
          </button>
        </li>
      </ul>

      <section class="dashboard-quick-tools" aria-label="Herramientas rápidas">
        <div class="dashboard-rate">
          <span class="dashboard-rate-icon"><i class="bi bi-currency-dollar"></i></span>
          <div>
            <span>Tipo de cambio · USD/MXN</span>
            <strong *ngIf="!isLoadingExchangeRate && exchangeRate !== null">&#36;{{ exchangeRate | number:'1.2-4' }}</strong>
            <small *ngIf="exchangeRateCheckedAt">{{ exchangeRateSource }} · Consultado {{ exchangeRateCheckedAt }}</small>
            <small *ngIf="!isLoadingExchangeRate && exchangeRate === null">No disponible</small>
          </div>
          <button type="button" class="btn btn-sm" (click)="loadExchangeRate()" [disabled]="isLoadingExchangeRate" title="Actualizar tipo de cambio">
            <i class="bi bi-arrow-clockwise" [class.spin]="isLoadingExchangeRate"></i>
          </button>
        </div>
        <div class="dashboard-quick-actions" *ngIf="favoriteActions.length">
          <span>Tus acciones frecuentes</span>
          <a *ngFor="let action of favoriteActions" class="btn btn-sm" [ngClass]="'btn-outline-' + action.color" [routerLink]="action.route">
            <i class="bi" [ngClass]="action.icon"></i> {{ action.label }}
          </a>
        </div>
      </section>

      <!-- Contenido -->
      <div class="tab-content p-2">
        <div [hidden]="activeTab !== 'ia'">
          <app-dash-ai />
        </div>
        <ng-container *ngIf="activeTab === 'admon'">
          <app-dash-admon [dashboardExchangeRate]="exchangeRate" />
        </ng-container>
        <ng-container *ngIf="activeTab === 'proyectos'">
          <app-dash-projects />
        </ng-container>
        <ng-container *ngIf="activeTab === 'almacenes'">
          <app-dash-warehouse />
        </ng-container>
        <ng-container *ngIf="activeTab === 'ventas'">
          <app-crm-dashboard />
        </ng-container>
      </div>
      </div>

    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      min-height: calc(100vh - 88px);
      display: flex;
      flex-direction: column;
      background: #f8f9fa;
    }
    .dashboard-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .dashboard-welcome {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.15rem 1.25rem;
      color: #fff;
      background: linear-gradient(115deg, #123b5b, #176d96);
    }
    .dashboard-clock { font-size: .72rem; font-weight: 600; letter-spacing: .03em; opacity: .78; }
    .dashboard-welcome h4 { margin: .2rem 0; font-weight: 700; }
    .dashboard-welcome p { margin: 0; font-size: .82rem; opacity: .82; }
    .dashboard-holidays { display: flex; flex-wrap: wrap; gap: .25rem .9rem; margin-top: .45rem; font-size: .72rem; opacity: .92; }
    .dashboard-holidays > span:first-child { font-weight: 700; }
    .dashboard-context { display: flex; gap: .6rem; }
    .dashboard-context > div { display: grid; grid-template-columns: auto 1fr; column-gap: .5rem; min-width: 140px; padding: .55rem .7rem; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.16); border-radius: .45rem; }
    .dashboard-context i { grid-row: span 2; align-self: center; font-size: 1.05rem; opacity: .85; }
    .dashboard-context span { font-size: .62rem; font-weight: 700; letter-spacing: .04em; opacity: .72; text-transform: uppercase; }
    .dashboard-context strong { max-width: 180px; overflow: hidden; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
    .tab-content {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    .nav-tabs {
      background: #fff;
      border-bottom: 2px solid #dee2e6;
    }
    .nav-link {
      border: none;
      color: #6c757d;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 0;
      cursor: pointer;
      background: transparent;
    }
    .nav-link.active {
      color: #2980b9;
      border-bottom: 3px solid #2980b9;
      background: transparent;
    }
    .nav-link:hover:not(.active) {
      color: #343a40;
      background: #f0f4ff;
    }
    .dashboard-quick-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: .55rem 1rem;
      background: #fff;
      border-bottom: 1px solid #dee2e6;
    }
    .dashboard-rate, .dashboard-quick-actions { display: flex; align-items: center; gap: .55rem; }
    .dashboard-rate-icon { display: grid; width: 34px; height: 34px; place-items: center; color: #fff; background: #1680ad; border-radius: 50%; }
    .dashboard-rate div { display: grid; line-height: 1.08; }
    .dashboard-rate span:not(.dashboard-rate-icon), .dashboard-quick-actions > span { color: #6c757d; font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .dashboard-rate strong { color: #124a68; font-size: 1.05rem; }
    .dashboard-rate small { color: #8997a0; font-size: .67rem; }
    .dashboard-rate .btn { color: #1680ad; }
    .dashboard-quick-actions { flex-wrap: wrap; justify-content: flex-end; }
    .dashboard-quick-actions .btn { font-size: .75rem; }
    .spin { display: inline-block; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 767px) {
      .dashboard-welcome { align-items: flex-start; flex-direction: column; }
      .dashboard-publicidad-link { position: static; align-self: flex-start; transform: none; }
      .dashboard-publicidad-link:hover { transform: none; }
      .dashboard-context { width: 100%; }
      .dashboard-context > div { flex: 1; }
      .dashboard-quick-tools { align-items: flex-start; flex-direction: column; }
      .dashboard-quick-actions { justify-content: flex-start; }
    }
    .dashboard-greeting-line { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem 1rem; }
    .dashboard-publicidad-link {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: .25rem .45rem;
      padding: 3px 8px;
      border-radius: 5px;
      color: #fff;
      background: rgba(255,255,255,.14);
      font-size: .78rem;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .dashboard-publicidad-link:hover {
      background: rgba(255,255,255,.25);
      color: #fff;
      transform: translateX(-50%);
    }
    .dashboard-publicidad-hint {
      font-size: 0.68rem;
      font-weight: 500;
      color: rgba(255,255,255,.82);
    }
    .dashboard-publicidad-chevron {
      font-size: 0.72rem;
      opacity: 0.8;
    }
  `]
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  private administrationService = inject(AdministrationService);
  private http = inject(HttpClient);
  private signalsService = inject(SignalsService);
  private usersService = inject(UsersService);
  private trackingService = inject(TrackingService);
  readonly quickActions = inject(QuickActionsService);
  readonly projectName = this.signalsService.getProjectNameBySidebar();
  readonly branchName = this.signalsService.getBranchNameSelectedBySidebar();
  activeTab: string = 'admon';
  isLoadingExchangeRate = false;
  exchangeRate: number | null = null;
  exchangeRateCheckedAt = '';
  exchangeRateSource = 'FIX Banxico';
  clockText = '';
  private fullUserName = '';
  upcomingHolidays: Array<{ date: string; name: string; localName: string; dateLabel: string }> = [];
  holidayCountryName = '';
  private clockTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 60_000);
    this.loadExchangeRate();
    this.loadFullUserName();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    return hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get userName(): string {
    return this.fullUserName || this.trackingService.getnameUser() || 'bienvenido';
  }

  private loadFullUserName(): void {
    this.fullUserName = this.trackingService.getnameUser() || '';
    const email = localStorage.getItem('mail') || '';
    if (!email) return;

    this.usersService.findEmail(email).subscribe({
      next: (user) => {
        this.fullUserName = user?.displayName?.trim() || this.fullUserName;
        if (this.fullUserName) this.trackingService.setnameUser(this.fullUserName);
        this.loadUpcomingHolidays(user?.country || '');
      },
      error: (error) => console.error('No se pudo cargar el nombre completo del usuario:', error)
    });
  }

  private loadUpcomingHolidays(country: string): void {
    const countryCode = this.getHolidayCountryCode(country);
    if (countryCode) {
      this.fetchUpcomingHolidays(country, countryCode);
      return;
    }

    const normalizedCountry = this.normalizeCountry(country);
    if (!normalizedCountry) return;
    this.http.get<any[]>('https://date.nager.at/api/v3/AvailableCountries').subscribe({
      next: (countries) => {
        const match = (countries || []).find(item => this.normalizeCountry(item.name) === normalizedCountry);
        if (match?.countryCode) this.fetchUpcomingHolidays(country, match.countryCode);
      },
      error: (error) => console.warn('No se pudo identificar el país para consultar días festivos:', error)
    });
  }

  private fetchUpcomingHolidays(country: string, countryCode: string): void {
    this.http.get<any[]>(`https://date.nager.at/api/v3/NextPublicHolidays/${countryCode}`).subscribe({
      next: (holidays) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.upcomingHolidays = (holidays || [])
          .filter(holiday => holiday.date && new Date(`${holiday.date}T00:00:00`) >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3)
          .map(holiday => ({
            date: holiday.date,
            name: holiday.name,
            localName: holiday.localName,
            dateLabel: new Date(`${holiday.date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          }));
        this.holidayCountryName = country.trim();
      },
      error: (error) => console.warn('No se pudieron consultar los días festivos del país del usuario:', error)
    });
  }

  private getHolidayCountryCode(country: string): string {
    const normalized = this.normalizeCountry(country);
    if (/^[a-z]{2}$/i.test(country.trim())) return country.trim().toUpperCase();
    const aliases: Record<string, string> = {
      'mexico': 'MX', 'estados unidos mexicanos': 'MX',
      'estados unidos': 'US', 'united states': 'US', 'usa': 'US',
      'canada': 'CA', 'espana': 'ES', 'colombia': 'CO', 'argentina': 'AR',
      'chile': 'CL', 'peru': 'PE', 'brasil': 'BR', 'brazil': 'BR'
    };
    return aliases[normalized] || '';
  }

  private normalizeCountry(country: string): string {
    return (country || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  get favoriteActions() {
    return this.quickActions.getTopActions();
  }

  loadExchangeRate(): void {
    this.isLoadingExchangeRate = true;
    this.administrationService.getTodayExchangeRate().subscribe({
      next: (response) => {
        const rate = Number(response?.rate ?? response?.value ?? response);
        if (Number.isFinite(rate) && rate > 0) {
          this.exchangeRate = rate;
          this.setExchangeRateCheckTime();
          this.exchangeRateSource = 'FIX Banxico';
          this.isLoadingExchangeRate = false;
        } else {
          this.loadReferenceExchangeRate();
        }
      },
      error: () => this.loadReferenceExchangeRate(),
    });
  }

  private loadReferenceExchangeRate(): void {
    this.http.get<{ rates?: { MXN?: number }; time_last_update_utc?: string }>(
      'https://open.er-api.com/v6/latest/USD'
    ).subscribe({
      next: (response) => {
        const rate = Number(response?.rates?.MXN);
        this.exchangeRate = Number.isFinite(rate) && rate > 0 ? rate : null;
        this.exchangeRateSource = this.exchangeRate !== null ? 'Referencia de mercado' : '';
        this.setExchangeRateCheckTime();
        this.isLoadingExchangeRate = false;
      },
      error: () => {
        this.exchangeRate = null;
        this.exchangeRateCheckedAt = '';
        this.exchangeRateSource = '';
        this.isLoadingExchangeRate = false;
      },
    });
  }

  private setExchangeRateCheckTime(): void {
    this.exchangeRateCheckedAt = new Date().toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private updateClock(): void {
    this.clockText = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }
}
