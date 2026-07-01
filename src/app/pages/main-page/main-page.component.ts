import { Component, OnInit, OnDestroy, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { SideBarComponent } from 'app/shared/side-bar/side-bar.component';
import { FooterComponent } from 'app/shared/footer/footer.component';
import { SignalsService } from '../../services/signals.service';
import { AuthService } from '../../services/auth.service';
import { TrackingService } from '../../services/tracking.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SideBarComponent, FooterComponent],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements OnInit, OnDestroy {
  private signalsService   = inject(SignalsService);
  private router           = inject(Router);
  private auth             = inject(AuthService);
  private trackingService  = inject(TrackingService);

  private routerSub?: Subscription;

  private readonly MODULE_MAP: Record<string, string> = {
    'dashboard'          : 'Dashboard',
    'publicidad'         : 'Inicio',
    'procsales'          : 'Ventas',
    'procmodadmon'       : 'Administracion',
    'smp'                : 'Setup',
    'projects'           : 'Proyectos',
    'procmodmaintenance' : 'Mantenimiento',
    'almacenes'          : 'Almacenes',
    'proceswar'          : 'Almacen',
    'dashboardgrales'    : 'Dashboards',
    'logistica'          : 'Logistica',
    'presupuestos'       : 'Presupuestos',
    'pmo'                : 'PMO',
  };

  private initialBranchId: number;
  isSidebarCollapsed: boolean = false;

  licenseStatus = this.signalsService.getLicenseStatus();
  licenseDays   = this.signalsService.getLicenseDaysRemaining();

  // Root nunca ve bloqueos de licencia
  isRootUser = computed(() =>
    !!this.signalsService.getUserRoot()() ||
    this.signalsService.getemailChoose() === environment.root
  );

  isDemo = computed(() =>
    this.signalsService.getemailChoose() === environment.demo?.email
  );

  constructor() {
    effect(() => {
      const newBranchId = this.signalsService.getBranchSelectedBySidebar()();
      const isAdvanced = this.signalsService.getIsAdvanced();
      if (this.initialBranchId !== undefined && this.initialBranchId !== newBranchId && isAdvanced) {
        const target = this.auth.hasMasterPermission('dashboard') ? '/dashboard' : '/publicidad';
        this.router.navigateByUrl(target);
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.initialBranchId = this.signalsService.getBranchSelectedBySidebar()();

    // Escuchar TODAS las navegaciones y reportar módulo a Telegram
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const segment = (e.urlAfterRedirects || e.url).split('/')[1]?.split('?')[0] || '';
      const module  = this.MODULE_MAP[segment] || segment;
      if (module) this.trackingService.logModuleVisit(module);
    });

    // Cargar estado inicial del sidebar
    const savedState = localStorage.getItem('sidebarCollapsed');
    this.isSidebarCollapsed = savedState === 'true';

    // Escuchar cambios en localStorage (cuando otro tab o el sidebar cambia el estado)
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Escuchar cambios locales (mismo tab)
    this.checkSidebarState();
    setInterval(() => this.checkSidebarState(), 100);
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'sidebarCollapsed') {
      this.isSidebarCollapsed = event.newValue === 'true';
    }
  }

  private checkSidebarState() {
    const currentState = localStorage.getItem('sidebarCollapsed') === 'true';
    if (this.isSidebarCollapsed !== currentState) {
      this.isSidebarCollapsed = currentState;
    }
  }
}
