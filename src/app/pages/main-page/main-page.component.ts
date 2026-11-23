import { Component, OnInit, OnDestroy, effect, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, EMPTY, filter, Subscription, switchMap, timer } from 'rxjs';
import { SideBarComponent } from 'app/shared/side-bar/side-bar.component';
import { FooterComponent } from 'app/shared/footer/footer.component';
import { SignalsService } from '../../services/signals.service';
import { AuthService } from '../../services/auth.service';
import { TrackingService } from '../../services/tracking.service';
import { RootService } from '../../services/root.service';
import { environment } from '@env/environment';
import { WorkspaceTab, WorkspaceTabsService } from 'app/services/workspace-tabs.service';
import { QuickActionsService } from 'app/services/quick-actions.service';
import { SignalrService } from 'app/services/signalr.service';
import { CustomersService } from 'app/services/customers.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, SideBarComponent, FooterComponent],
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
  private quickActions     = inject(QuickActionsService);
  private signalrService   = inject(SignalrService);
  private customersService = inject(CustomersService);

  private routerSub?: Subscription;
  private cobranzaSub?: Subscription;
  private upcomingCobranzaSub?: Subscription;
  private overdueRefreshSub?: Subscription;
  private overdueContextKey = '';
  overdueNotice: {
    overdueCustomers: number; overdueInstallments: number; overdueBalance: number;
    upcomingCustomers: number; upcomingInstallments: number; upcomingBalance: number;
  } | null = null;
  draggingTabUrl = '';
  private restoringWorkspaceUrl = '';

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
      if (localStorage.getItem('token') && rootId) this.signalrService.startCobranzaConnection(Number(rootId));
      else if (!rootId) this.signalrService.stopCobranzaConnection();
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

    effect(() => {
      const rootId = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
      const canViewCobranza = this.auth.getUserPermissions()?.cobranzas?.active === true;
      const contextKey = `${rootId}|${canViewCobranza}`;
      if (contextKey === this.overdueContextKey) return;
      this.overdueContextKey = contextKey;
      this.overdueRefreshSub?.unsubscribe();
      this.overdueNotice = null;
      if (!rootId || !canViewCobranza || !localStorage.getItem('token')) return;
      this.overdueRefreshSub = timer(0, 5 * 60 * 1000).pipe(
        switchMap(() => this.customersService.getCobranzaDashboard(rootId).pipe(
          catchError(error => {
            console.warn('No se pudo actualizar el aviso global de cuotas vencidas:', error);
            return EMPTY;
          })
        ))
      ).subscribe(loans => {
        if (rootId === Number(this.signalsService.getRootSelectedBySidebar()())) {
          this.overdueNotice = this.summarizeOverdueLoans(loans || []);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.cobranzaSub?.unsubscribe();
    this.upcomingCobranzaSub?.unsubscribe();
    this.overdueRefreshSub?.unsubscribe();
    this.signalrService.stopCobranzaConnection();
  }

  ngOnInit(): void {
    this.initialBranchId = this.signalsService.getBranchSelectedBySidebar()();
    this.cobranzaSub = this.signalrService.cobranzaPayment$.subscribe(payment => {
      if (!payment || Number(payment.companyId) !== Number(this.signalsService.getRootSelectedBySidebar()())) return;
      this.refreshOverdueNotice();
      const amount = Number(payment.amount || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      const overdueInstallments = Number(payment.overdueInstallments || 0);
      const overdueAmount = Number(payment.overdueAmount || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      const overdueNotice = overdueInstallments > 0
        ? ` · Atraso: ${overdueInstallments} cuota(s), ${overdueAmount}`
        : '';
      const isWebPayment = String(payment.source || 'TELEGRAM').toUpperCase() === 'WEB';
      const sourceTitle = isWebPayment
        ? 'Abono registrado desde la web'
        : 'Nuevo cobro desde Telegram';
      const sourceNotice = isWebPayment ? ' · Origen: web' : ` · Cobrador: ${payment.collectorName}`;
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: overdueInstallments > 0 ? 'warning' : 'success',
        title: overdueInstallments > 0 ? 'Abono recibido · cliente con atraso' : sourceTitle,
        text: `${payment.customerName} · ${amount}${sourceNotice}${overdueNotice}`,
        showConfirmButton: false,
        timer: 9000,
        timerProgressBar: true,
      });
    });
    this.upcomingCobranzaSub = this.signalrService.cobranzaUpcomingPayments$.subscribe(reminder => {
      if (!reminder || !this.auth.hasMasterPermission('cobranzas')
        || Number(reminder.companyId) !== Number(this.signalsService.getRootSelectedBySidebar()())) return;
      this.overdueNotice = {
        overdueCustomers: this.overdueNotice?.overdueCustomers || 0,
        overdueInstallments: this.overdueNotice?.overdueInstallments || 0,
        overdueBalance: this.overdueNotice?.overdueBalance || 0,
        upcomingCustomers: Number(reminder.customerCount || 0),
        upcomingInstallments: Number(reminder.installmentCount || 0),
        upcomingBalance: Number(reminder.totalAmount || 0),
      };
    });

    // Escuchar TODAS las navegaciones y reportar módulo a Telegram
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url = e.urlAfterRedirects || e.url;
      if (this.restoringWorkspaceUrl) {
        if (url.split('?')[0] !== this.restoringWorkspaceUrl.split('?')[0]) return;
        this.restoringWorkspaceUrl = '';
      }
      const segment = url.split('/')[1]?.split('?')[0] || '';
      const module  = this.MODULE_MAP[segment] || segment;
      if (module) this.trackingService.logModuleVisit(module);
      this.quickActions.recordRoute(url);
      this.registerWorkspaceRoute(url);
    });

    // Cubre la primera pantalla cuando Angular ya terminó de navegar antes de
    // que este componente alcance a suscribirse al evento NavigationEnd.
    if (this.router.url && this.router.url !== '/') {
      const restoredUrl = this.workspaceTabs.restoreForCurrentUser();
      if (restoredUrl && restoredUrl !== this.router.url.split('?')[0]) {
        this.restoringWorkspaceUrl = restoredUrl;
        void this.router.navigateByUrl(restoredUrl, { state: { restoreWorkspace: true } }).then(() => {
          if (this.restoringWorkspaceUrl) {
            this.restoringWorkspaceUrl = '';
            this.registerWorkspaceRoute(this.router.url);
          }
        });
      } else {
        this.quickActions.recordRoute(this.router.url);
        this.registerWorkspaceRoute(this.router.url);
      }
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

  @HostListener('window:focus')
  refreshOverdueNotice(): void {
    const rootId = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
    if (!rootId || !this.auth.hasMasterPermission('cobranzas')) return;
    this.customersService.getCobranzaDashboard(rootId).subscribe({
      next: loans => {
        if (rootId === Number(this.signalsService.getRootSelectedBySidebar()())) {
          this.overdueNotice = this.summarizeOverdueLoans(loans || []);
        }
      },
      error: error => console.warn('No se pudo actualizar el aviso global de cuotas vencidas:', error)
    });
  }

  private summarizeOverdueLoans(loans: any[]): MainPageComponent['overdueNotice'] {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const overdueCustomers = new Set<number>();
    const upcomingCustomers = new Set<number>();
    let overdueInstallments = 0;
    let overdueBalance = 0;
    let upcomingInstallments = 0;
    let upcomingBalance = 0;
    for (const loan of loans) {
      for (const item of loan?.cuotas || loan?.Cuotas || []) {
        if (item?.active === false || item?.Active === false) continue;
        const due = String(item?.fechaProgramada ?? item?.FechaProgramada ?? '').slice(0, 10);
        if (!due) continue;
        const payments = item?.abonos || item?.Abonos || [];
        const appliedValue = item?.montoAplicado ?? item?.MontoAplicado;
        const paid = appliedValue !== null && appliedValue !== undefined
          ? Number(appliedValue)
          : payments.filter((payment: any) => payment?.active !== false && payment?.Active !== false)
            .reduce((sum: number, payment: any) => sum + Number(payment?.monto ?? payment?.Monto ?? 0), 0);
        const remaining = Math.max(0, Number(item?.montoProgramado ?? item?.MontoProgramado ?? 0) - paid);
        if (remaining <= 0) continue;
        const customerId = Number(loan?.idCustomer ?? loan?.IdCustomer);
        if (due < todayKey) {
          overdueInstallments++;
          overdueBalance += remaining;
          if (customerId) overdueCustomers.add(customerId);
        } else {
          const dueDate = new Date(`${due}T00:00:00`);
          const daysAhead = Math.round((dueDate.getTime() - new Date(`${todayKey}T00:00:00`).getTime()) / 86400000);
          if (daysAhead > 1) continue;
          upcomingInstallments++;
          upcomingBalance += remaining;
          if (customerId) upcomingCustomers.add(customerId);
        }
      }
    }
    return overdueInstallments || upcomingInstallments ? {
      overdueCustomers: overdueCustomers.size,
      overdueInstallments,
      overdueBalance,
      upcomingCustomers: upcomingCustomers.size,
      upcomingInstallments,
      upcomingBalance,
    } : null;
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

  closeAllTabs(): void {
    this.workspaceTabs.closeAll();
    const homeUrl = '/publicidad';
    if (this.router.url.split('?')[0] !== homeUrl) {
      this.router.navigateByUrl(homeUrl);
    } else {
      this.workspaceTabs.register(homeUrl, 'Inicio');
    }
  }

  openUpdates(): void {
    void this.router.navigateByUrl('/publicidad?showUpdates=1');
  }

  onTabDragStart(event: DragEvent, tab: WorkspaceTab): void {
    this.draggingTabUrl = tab.url;
    event.dataTransfer?.setData('text/plain', tab.url);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onTabDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onTabDrop(event: DragEvent, targetTab: WorkspaceTab): void {
    event.preventDefault();
    const sourceUrl = this.draggingTabUrl || event.dataTransfer?.getData('text/plain');
    if (sourceUrl) this.workspaceTabs.move(sourceUrl, targetTab.url);
    this.draggingTabUrl = '';
  }

  onTabDragEnd(): void {
    this.draggingTabUrl = '';
  }

  private registerWorkspaceRoute(url: string): void {
    if (this.workspaceTabs.isGeneralMenu(url) || this.workspaceTabs.isTransientRoute(url)) {
      this.workspaceTabs.remove(url);
      return;
    }

    this.workspaceTabs.register(url, this.getRouteTitle());
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
    procsales: 'Ventas',
    expend: 'Egresos',
    incomes: 'Ingresos',
    'shoppingTD/requisitions-st': 'Requisiciones',
    'shoppingTD/materials-st': 'Materiales de Compras',
    'shoppingTD/quotes-st': 'Cotizaciones',
    'shoppingTD/purchaseorder-st': 'Órdenes de compra',
    'shoppingTD/providers-st': 'Proveedores',
    'shoppingTD/setupwarehouse': 'Configuración de Compras',
    'shoppingTD/catalogs': 'Catálogos de Compras',
    'shoppingTD/fam-subfam': 'Familias de Compras',
    'shoppingTD/projects': 'Proyectos',
    'warehousesTD/entry-st': 'Entradas de almacén',
    'warehousesTD/outings-st': 'Salidas de almacén',
    'warehousesTD/inventory-st': 'Inventario',
    'warehousesTD/warehouses': 'Almacenes',
    'warehousesTD/setup-st': 'Configuración de almacenes',
    'warehousesTD/catalogs': 'Catálogos de movimientos',
    'warehousesTD/material-traceability': 'Trazabilidad de materiales',
    'warehousesTD/kardex': 'Kardex',
    'warehousesTD/projects': 'Proyectos',
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
