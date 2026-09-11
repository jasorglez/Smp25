import { Component, OnInit, OnDestroy, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { SideBarComponent } from 'app/shared/side-bar/side-bar.component';
import { FooterComponent } from 'app/shared/footer/footer.component';
import { SignalsService } from '../../services/signals.service';
import { AuthService } from '../../services/auth.service';
import { TrackingService } from '../../services/tracking.service';
import { RootService } from '../../services/root.service';
import { environment } from '@env/environment';
import { WorkspaceTab, WorkspaceTabsService } from 'app/services/workspace-tabs.service';

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
  private rootService      = inject(RootService);
  readonly workspaceTabs   = inject(WorkspaceTabsService);

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

    // Detecta qué empresa seleccionó el usuario y activa el gate de Telegram
    effect(() => {
      const rootId = this.signalsService.getRootSelectedBySidebar()();
      if (rootId) {
        this.rootService.getRootbyId(rootId).subscribe({
          next: (data: any) => {
            this.trackingService.setEsProspecto(!!data?.esProspecto);
          },
          error: () => this.trackingService.setEsProspecto(false),
        });
      } else {
        this.trackingService.setEsProspecto(false);
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
      const url = e.urlAfterRedirects || e.url;
      const segment = url.split('/')[1]?.split('?')[0] || '';
      const module  = this.MODULE_MAP[segment] || segment;
      if (module) this.trackingService.logModuleVisit(module);
      this.workspaceTabs.register(url, this.getRouteTitle());
    });

    // Cubre la primera pantalla cuando Angular ya terminó de navegar antes de
    // que este componente alcance a suscribirse al evento NavigationEnd.
    if (this.router.url && this.router.url !== '/') {
      this.workspaceTabs.register(this.router.url, this.getRouteTitle());
    }

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

  activateTab(tab: WorkspaceTab): void {
    if (tab.url !== this.workspaceTabs.activeUrl()) {
      this.router.navigateByUrl(tab.url);
    }
  }

  closeTab(event: MouseEvent, tab: WorkspaceTab): void {
    event.preventDefault();
    event.stopPropagation();
    const nextTab = this.workspaceTabs.close(tab.url);
    if (nextTab) this.router.navigateByUrl(nextTab.url);
  }

  private getRouteTitle(): string {
    let route: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    const segments: string[] = [];

    while (route.firstChild) {
      route = route.firstChild;
      segments.push(...route.url.map(segment => segment.path));
    }

    const configuredTitle = route.data?.['title'];
    if (configuredTitle) return configuredTitle;

    const leaf = segments[segments.length - 1] || 'Inicio';
    const routeKey = segments.join('/');
    return this.routeTitles[routeKey] || this.routeTitles[leaf] || this.humanizeRoute(leaf);
  }

  private humanizeRoute(route: string): string {
    return route
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  private readonly routeTitles: Record<string, string> = {
    publicidad: 'Inicio',
    dashboard: 'Dashboard',
    expend: 'Egresos',
    incomes: 'Ingresos',
    'shoppingTD/requisitions-st': 'Requisiciones',
    'shoppingTD/purchaseorder-st': 'Órdenes de compra',
    'shoppingTD/providers-st': 'Proveedores',
    'shoppingTD/setupwarehouse': 'Configuración de Compras',
    'warehousesTD/entry-st': 'Entradas de almacén',
    'warehousesTD/outings-st': 'Salidas de almacén',
    'warehousesTD/inventory-st': 'Inventario',
    'warehousesTD/warehouses': 'Almacenes',
    'warehousesTD/setup-st': 'Configuración de almacenes',
    'warehousesTD/material-traceability': 'Trazabilidad de materiales',
    'projects/contracts': 'Contratos',
    'projects/projects': 'Proyectos',
    'projects/subcontractors': 'Subcontratistas',
    'projects/subcontract-programs': 'Programas x Subcontratista',
    'projects/subcontract-estimates': 'Estimaciones x Subcontratista',
    'projects/subcontract-reports': 'Reportes Diarios x Subcontratista',
    'projects/sistema': 'Reporte diario',
    'projects/workprograms': 'Programas de trabajo',
    'projects/ot/ordenes': 'Órdenes de trabajo',
    'projects/ot/busquedas-ot': 'Búsqueda de OT',
    'projects/ot/catastrales': 'OT manuales',
    'projects/ot/generales': 'Gráficos de eficiencia',
    'purchaseorder-st': 'Órdenes de compra',
    'requisitions-st': 'Requisiciones',
    'entry-st': 'Entradas de almacén',
    'outings-st': 'Salidas de almacén',
    'inventory-st': 'Inventario',
    'setup-st': 'Configuración de almacenes',
    'providers-st': 'Proveedores',
    'subcontract-programs': 'Programas x Subcontratista',
    'subcontract-estimates': 'Estimaciones x Subcontratista',
    'subcontract-reports': 'Reportes Diarios x Subcontratista',
    ordenes: 'Órdenes de trabajo',
    'busquedas-ot': 'Búsqueda de OT',
  };
}
