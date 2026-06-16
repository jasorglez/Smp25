import { ChangeDetectorRef, Component, computed, effect, NgZone, Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, lastValueFrom } from 'rxjs';

import { environment } from '@env/environment';
import { alerts } from 'app/helpers/alerts';
import { AuthService } from 'app/services/auth.service';
import { BranchsService } from 'app/services/branchs.service';
import { CompanysService } from 'app/services/companys.service';
import { MenuService } from 'app/services/menu.service';
import { RootService } from 'app/services/root.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { TrackingService } from 'app/services/tracking.service';
import { TraductorService } from 'app/services/traductor.service';
import { UsersService } from 'app/services/users.service';

import { SharedModule } from '../shared.module';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [SharedModule, FormsModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  readonly guardUiTick: Signal<number>;
  hasNupnpn: () => boolean = () => false;
  readonly defaultCompanyLogo = './assets/img/default.png';

  /** Siempre true pero lee guardRefreshTick para forzar re-evaluación reactiva del *ngIf */
  readonly permissionRefreshTick = computed(() => {
    this.signalsService.guardRefreshTick();
    return true;
  });

  isSidebarCollapsed = false;
  isTemporarilyExpanded = false;
  private isInteractingWithSelect = false;
  private _branchesReloadedAfterPermissions = false;
  companyLogoSrc = this.defaultCompanyLogo;

  selectedRoot = '';
  selectedBranchId = '';
  selectedCProcessId = 0;
  selectedPlatformId = 0;
  userRoot = 0;
  idUser = 0;

  rootData: any;
  branchData: any[] = [];
  centerprocessData: any[] = [];
  platformData: any[] = [];
  usersData: any[];

  private rootAdministrator: number[] = [];
  private branchListRequestSeq = 0;

  sidebarMenus: {
    identifier: string;
    permissionName: string;
    route: string;
    icon: string;
  }[] = [];

  constructor(
    public translateService: TraductorService,
    public trackingService: TrackingService,
    public companysService: CompanysService,
    public authService: AuthService,
    public rootService: RootService,
    private branchService: BranchsService,
    private userService: UsersService,
    private signalsService: SignalsService,
    private menuService: MenuService,
    private ocAndReqsService: OcAndReqsService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.guardUiTick = this.signalsService.guardRefreshTick;
    this.hasNupnpn = () => this.signalsService.getHasNupnpnCompraRapida()();

    effect(async () => {
      const shouldUpdate = this.signalsService.getUpdateBranchList()();
      if (shouldUpdate) {
        await this.getpermissionxBranchs(parseInt(this.selectedRoot, 10));
        setTimeout(() => this.signalsService.resetSignalBranchList());
      }
    });

    // Verificar NUPNPN después de que el auth esté confirmado (guardRefreshTick > 0)
    // y la sucursal esté seleccionada. Ambas condiciones garantizan que el token es válido.
    effect(() => {
      const tick    = this.signalsService.guardRefreshTick();
      const branchId = this.signalsService.getBranchSelectedBySidebar()();
      if (tick === 0 || branchId == null || branchId === 0) return;
      this.checkNupnpnBadge(branchId);
    });
  }

  private prependAllBranchesOptionIfNeeded(idRoot: number): void {
    const hasAllBranchesOption = this.branchData.some((branch) => branch.id === -idRoot);
    if (this.branchData.length > 1 && !hasAllBranchesOption) {
      this.branchData.unshift({
        id: -idRoot,
        name: 'Todas las sucursales',
      });
    }
  }

  private buildBranchOptions(idRoot: number, branches: { id: number; name: string }[]): { id: number; name: string }[] {
    const next = [...branches];
    if (next.length > 1 && !next.some((branch) => branch.id === -idRoot)) {
      next.unshift({
        id: -idRoot,
        name: 'Todas las sucursales',
      });
    }
    return next;
  }

  private sameBranchOptions(
    current: { id: number; name: string }[],
    next: { id: number; name: string }[]
  ): boolean {
    if (current.length !== next.length) {
      return false;
    }
    return current.every((branch, index) =>
      branch.id === next[index]?.id && branch.name === next[index]?.name
    );
  }

  private pickBranchAfterListLoad(): { id: number; name: string } | null {
    if (!this.branchData?.length) {
      return null;
    }

    const selectedId = Number(this.selectedBranchId);
    if (!Number.isNaN(selectedId)) {
      const selected = this.branchData.find((b) => b.id === selectedId);
      if (selected) {
        return selected;
      }
    }

    const preferredRaw = this.signalsService.getBranchSelectedBySidebar()();
    if (preferredRaw != null && preferredRaw !== 0) {
      const preferredId = Number(preferredRaw);
      if (!Number.isNaN(preferredId)) {
        const found = this.branchData.find((b) => b.id === preferredId);
        if (found) {
          return found;
        }
      }
    }

    return this.branchData[0];
  }

  private async applyPickedBranch(chosen: { id: number; name: string }): Promise<void> {
    const nextId = String(chosen.id);
    const branchDidChange = this.selectedBranchId !== nextId;

    this.selectedBranchId = nextId;
    this.signalsService.setBranchSelectedBySidebar(Number(chosen.id));
    this.signalsService.setBranchNameSelectedBySidebar(chosen.name);

    if (!branchDidChange) {
      return;
    }

    await this.reloadGuardForSelectedBranch();

    // Auth confirmado: verificar artículos NUPNPN para el badge del sidebar
    this.checkNupnpnBadge(Number(chosen.id));
  }

  private async checkNupnpnBadge(branchId: number): Promise<void> {
    if (!branchId) {
      this.signalsService.setHasNupnpnCompraRapida(false);
      return;
    }

    // Determinar qué sucursales consultar:
    //  - id positivo → solo esa sucursal
    //  - id negativo ("Todas las sucursales") → todas las sucursales reales (id positivo)
    const branchIds = branchId > 0
      ? [branchId]
      : this.branchData.filter(b => b.id > 0).map(b => b.id);

    // branchData aún no cargado (carrera de init): no sobrescribir el valor persistido.
    if (branchIds.length === 0) return;

    try {
      const results = await Promise.all(
        branchIds.map(id =>
          lastValueFrom(this.ocAndReqsService.getCompraRapidaItems(id)).catch(() => [] as any[])
        )
      );
      const hasNupnpn = results.some((items: any[]) =>
        (items || []).some((it: any) => String(it.numArticle || '').toUpperCase().startsWith('NUPNPN'))
      );
      this.signalsService.setHasNupnpnCompraRapida(hasNupnpn);
    } catch {
      // No alterar el badge si falla la consulta
    }
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  trackByMenuIdentifier(_index: number, item: { identifier: string }): string {
    return item.identifier;
  }

  private async reloadGuardForSelectedBranch(): Promise<void> {
    const branchId = Number(this.selectedBranchId);
    if (!Number.isFinite(branchId) || branchId === 0) {
      return;
    }

    // "Todas las sucursales" uses a negative id — load global (UserSystem) permissions.
    const isAllBranches = branchId < 0;

    try {
      await lastValueFrom(
        this.authService.reloadCurrentSessionGuard(
          isAllBranches
            ? { preferUserSystemGuard: true }
            : { idBranchOverride: branchId }
        )
      );

      // On page refresh, branches may have loaded via the restricted API
      // (permissions weren't ready yet). Now that permissions are loaded,
      // reload branches once if the user qualifies for the full-branch path.
      if (!this._branchesReloadedAfterPermissions && this.selectedRoot) {
        if (this.authService.isEnvRoot()) {
          this._branchesReloadedAfterPermissions = true;
          await this.getpermissionxBranchs(parseInt(this.selectedRoot, 10));
        }
      }
    } catch (error) {
      console.error('Error al recargar permisos por sucursal en sidebar:', error);
    }
  }

  async ngOnInit() {
    const savedCollapsedState = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsedState !== null) {
      this.isSidebarCollapsed = savedCollapsedState === 'true';
    }

    this.userRoot = this.signalsService.getUserRoot()();
    if (this.signalsService.isidUserEmpty()) {
      this.userService.findEmail(localStorage.getItem('mail')).subscribe({
        next: (datauser: any) => {
          if (datauser) {
            this.trackingService.setId(datauser.id);
            this.signalsService.setidUser(datauser.id);
            this.getpermissionxRoots();
          }
        },
        error: (error) => {
          console.error('Error al obtener los datos del usuario:', error);
        },
      });
    } else {
      await this.getpermissionxRoots();
    }

    this.loadPermissions();

    window.addEventListener('storage', (event) => {
      if (event.key === 'mail') {
        this.loadPermissions();
      }
    });
  }

  onRootsSelected(event: Event): void {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.selectedRoot = target.value;

    if (this.selectedRoot) {
      const selectedCompany = this.rootData.find((r) => r.id === parseInt(this.selectedRoot, 10));
      if (selectedCompany) {
        this.applyCompanyHeaderData(selectedCompany);
        this.signalsService.setCompanyNameSmall(selectedCompany.nameSmall || selectedCompany.name);
      }

      this.trackingService.setCompany(target.value);
      this.signalsService.setRootSelectedBySidebar(Number(this.selectedRoot));
      this.getpermissionxBranchs(parseInt(this.selectedRoot, 10));
      this.loadSidebarMenus(parseInt(this.selectedRoot, 10));
      this.getHeadersCompanys(this.selectedRoot);
    }
  }

  async getpermissionxRoots() {
    this.rootService.get2Root(this.signalsService.idUser()).subscribe({
      next: (data) => {
        const root = Object.values(data);
        if (root && root.length > 0) {
          this.rootData = root;
          this.selectedRoot = this.rootData[0].id;
          this.applyCompanyHeaderData(this.rootData[0]);
          this.signalsService.setRootSelectedBySidebar(Number(this.selectedRoot));
          this.signalsService.setIsAdvanced(this.rootData[0].advanced);
          this.signalsService.setCompanyNameSmall(this.rootData[0].nameSmall || this.rootData[0].name);
          this.trackingService.setCompany(this.selectedRoot);
          this.getHeadersCompanys(this.selectedRoot);
          this.getpermissionxBranchs(parseInt(this.selectedRoot, 10));
          this.loadSidebarMenus(parseInt(this.selectedRoot, 10));
        } else {
          this.selectedRoot = null;
        }
      },
      error: (error) => {
        console.error('Error al obtener roots:', error);
        this.selectedRoot = null;
      },
    });
  }

  async getpermissionxBranchs(idRoot: number) {
    // Only the environment root sees all branches; everyone else (including DB-root
    // and see-all-branches users) is limited to their assigned branches.
    const isRoot = this.authService.isEnvRoot();
    const requestSeq = ++this.branchListRequestSeq;

    if (isRoot) {
      // Using the full-branch path — no need to reload after permissions.
      this._branchesReloadedAfterPermissions = true;
      this.branchService.getBranches2fields(idRoot).subscribe(
        async (data) => {
          if (requestSeq !== this.branchListRequestSeq) {
            return;
          }
          data.sort((a, b) => a.name.localeCompare(b.name));

          const nextBranchData = this.buildBranchOptions(
            idRoot,
            data.map((branch: any) => ({
              id: branch.id,
              name: branch.name,
            }))
          );

          const listChanged = !this.sameBranchOptions(this.branchData, nextBranchData);
          this.branchData = listChanged ? nextBranchData : this.branchData;

          if (this.isInteractingWithSelect) {
            return;
          }

          if (!listChanged && this.selectedBranchId) {
            return;
          }

          const chosen = this.pickBranchAfterListLoad();
          if (chosen) {
            await this.applyPickedBranch(chosen);
          }
        },
        (error) => {
          if (requestSeq !== this.branchListRequestSeq) {
            return;
          }
          console.error('Error al obtener branches:', error);
          this.branchData = [];
        }
      );
    } else {
      this.branchService
        .getBranchesByUserAndCompany(
          this.signalsService.idUser(),
          parseInt(localStorage.getItem('company'), 10)
        )
        .subscribe(
          async (data) => {
            if (requestSeq !== this.branchListRequestSeq) {
              return;
            }
            const nextBranchData = this.buildBranchOptions(
              idRoot,
              (data.project || []).map((branch: any) => ({
                id: branch.idPermission || branch.idBranch || branch.id,
                name: branch.name || branch.description || '',
              }))
            );

            const listChanged = !this.sameBranchOptions(this.branchData, nextBranchData);
            this.branchData = listChanged ? nextBranchData : this.branchData;

            if (this.isInteractingWithSelect) {
              return;
            }

            if (!listChanged && this.selectedBranchId) {
              return;
            }

            const chosen = this.pickBranchAfterListLoad();
            if (chosen) {
              await this.applyPickedBranch(chosen);
            }
          },
          (error) => {
            if (requestSeq !== this.branchListRequestSeq) {
              return;
            }
            console.error('Error al obtener branches:', error);
            this.branchData = [];
          }
        );
    }
  }

  async onBranchSelected(event: Event) {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.selectedBranchId = target.value;

    if (this.selectedBranchId) {
      this.signalsService.setBranchSelectedBySidebar(Number(this.selectedBranchId));

      const branchMeta = this.branchData.find(
        (branch) => branch.id === Number(this.selectedBranchId)
      );
      if (branchMeta) {
        this.signalsService.setBranchNameSelectedBySidebar(branchMeta.name);
      }

      await this.reloadGuardForSelectedBranch();
      this.checkNupnpnBadge(Number(this.selectedBranchId));
    }
  }

  getHeadersCompanys(companyId) {
    this.rootService.getRootbyId(companyId).subscribe({
      next: (datacom: any) => {
        this.applyCompanyHeaderData(datacom);
      },
      error: () => {
        this.rootService.getRoot().subscribe({
          next: (allRoots: any) => {
            const roots = Object.values(allRoots) as any[];
            const found = roots.find((r) => Number(r.id) === Number(companyId));
            if (found) {
              this.applyCompanyHeaderData(found);
            }
          },
          error: () => {
            // Keep current logo when both endpoints fail.
          },
        });
      },
    });
  }

  private applyCompanyHeaderData(company: any): void {
    if (!company) {
      return;
    }

    this.trackingService.setnameComp(company.name ?? '');
    const resolvedLogo = this.resolveCompanyLogo(company.picture);
    this.trackingService.setpictureComp(resolvedLogo);
    this.companyLogoSrc = resolvedLogo;
    Promise.resolve().then(() => this.signalsService.setCompanyName(company.name ?? ''));

    this.trackingService.setPictureComp2(company.picture2 ?? '');
    this.trackingService.setPictureComp3(company.picture3 ?? '');
  }

  private resolveCompanyLogo(picture: string | null | undefined): string {
    const raw = (picture ?? '').trim();

    if (!raw) {
      return this.defaultCompanyLogo;
    }

    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('data:') ||
      raw.startsWith('blob:') ||
      raw.startsWith('./assets/') ||
      raw.startsWith('/assets/')
    ) {
      return raw;
    }

    if (raw.startsWith('/')) {
      return `${environment.urlAzure.replace(/\/+$/, '')}${raw}`;
    }

    return `${environment.urlAzure.replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
  }

  onCompanyLogoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src.endsWith('/assets/img/default.png')) {
      return;
    }

    this.companyLogoSrc = this.defaultCompanyLogo;
    this.trackingService.setpictureComp(this.defaultCompanyLogo);
  }

  async onCpSelected(event: Event) {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.trackingService.setPlatform(parseInt(target.value, 10));
    this.selectedCProcessId = parseInt(target.value, 10);
    await this.getPermissionxPlataform(this.selectedCProcessId);
  }

  async getPermissionxPlataform(id: number) {
    if (this.trackingService.getaplat() === 'Si') {
      this.companysService.getPermissionsxPlatform(id).subscribe((data) => {
        this.platformData = Object.values(data);
        if (this.platformData.length > 0) {
          this.selectedPlatformId = this.platformData[0].id;
          this.trackingService.setPlatform(this.selectedPlatformId);
          this.trackingService.setPlataforma(this.platformData[0].description);
        } else {
          EMPTY;
        }
      });
    }
  }

  async onPlataformSelected(event: Event) {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.trackingService.setPlataforma(target.value);
    this.selectedPlatformId = parseInt(target.value, 10);
    this.trackingService.setPlatform(this.selectedPlatformId);
  }

  Dashboard() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Dashboard',
      'Menu Side Bar',
      ''
    );
  }

  maintenanceproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Mantenimiento',
      'Menu Side Bar',
      ''
    );
  }

  resourcesmenproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Recursos Humanos',
      'Menu Side Bar',
      ''
    );
  }

  salesproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Ventas',
      'Menu Side Bar',
      ''
    );
  }

  Bpi() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu BPI',
      'Menu Side Bar',
      ''
    );
  }

  Indicadores() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu indicadopres',
      'Menu Indicadores Bar',
      ''
    );
  }

  PepOper() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Pep Operaciones',
      'Menu Side Bar',
      ''
    );
  }

  SmpSetup() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Smp Setup',
      'Menu Side Bar',
      ''
    );
  }

  openProjects(event: Event) {
    event.preventDefault();
    alerts.basicAlert(
      'Acceso deshabilitado',
      'La selección de contratos y proyectos ya no forma parte del sidebar.',
      'info'
    );
    this.SmpSetup();
  }

  warehouseproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Compras',
      'Menu Side Bar',
      ''
    );
  }

  almacenesproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Almacenes',
      'Menu Side Bar',
      ''
    );
  }

  private loadPermissions() {
    return EMPTY;
  }

  loadSidebarMenus(idCompany: number): void {
    this.menuService.getSidebarMenus(idCompany).subscribe({
      next: (menus) => this.ngZone.run(() => { this.sidebarMenus = menus; }),
      error: (err) => console.error('Error cargando menus del sidebar:', err),
    });
  }

  onMenuItemClick(menuName: string): void {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Elección del menu ${menuName}`,
      'Menu Side Bar',
      ''
    );
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.isTemporarilyExpanded = false;
    localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
  }

  expandTemporarily() {
    if (this.isSidebarCollapsed) {
      this.isTemporarilyExpanded = true;
    }
  }

  collapseAfterInteraction() {
    if (this.isSidebarCollapsed && this.isTemporarilyExpanded) {
      setTimeout(() => {
        if (this.isInteractingWithSelect) {
          return;
        }
        this.isTemporarilyExpanded = false;
      }, 200);
    }
  }

  beginSelectInteraction() {
    this.isInteractingWithSelect = true;
    this.expandTemporarily();
  }

  onSidebarControlBlur() {
    if (this.isInteractingWithSelect) {
      return;
    }
    this.collapseAfterInteraction();
  }

  private finishSelectInteraction() {
    this.isInteractingWithSelect = false;
    this.collapseAfterInteraction();
  }
}
