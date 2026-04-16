import { Component, computed, effect, Signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TraductorService } from '../../services/traductor.service';
import { TrackingService } from '../../services/tracking.service';
import { CompanysService } from '../../services/companys.service';
import { ContractsService } from 'app/services/contracts.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { UsersService } from 'app/services/users.service';
import { SharedModule } from '../shared.module';
import { FormsModule } from '@angular/forms';
import { EMPTY, lastValueFrom, map, tap } from 'rxjs';
import { environment } from '@env/environment';
import { ConventionsService } from 'app/services/conventions.service';
import { MenuService } from 'app/services/menu.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [SharedModule, FormsModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  /** Fuerza reevaluación de *ngIf del menú tras recargar `guard` / `guardAdvanced` en sesión. */
  readonly guardUiTick: Signal<number>;
  readonly defaultCompanyLogo = './assets/img/default.png';

  /** Computed que fuerza re-evaulation del *ngIf para cada menú cuando guardUiTick cambia */
  readonly permissionRefreshTick: Signal<number>;

  isSidebarCollapsed = false;
  isTemporarilyExpanded = false;
  private isInteractingWithSelect = false;
  companyLogoSrc = this.defaultCompanyLogo;

  selectedRoot: string = '';

  rootData: any;
  contractData: any;
  branchData: any[] = [];
  projectData: any[] = [];
  centerprocessData: any[] = [];
  platformData: any[] = [];
  idUser: number = 0;

  selectedContractId: string = '';
  selectedProjectId: string = '';
  selectedBranchId: string = '';
  selectedCProcessId: number = 0;
  selectedPlatformId: number = 0;
  userRoot: number = 0;
  conventionVigenteNombre: string = '';

  usersData: any[];

  private rootAdministrator: number[] = [];

  sidebarMenus: { identifier: string; permissionName: string; route: string; icon: string }[] = [];

  constructor(
    public translateService: TraductorService,
    public trackingService: TrackingService,
    public companysService: CompanysService,
    public authService: AuthService,
    public rootService: RootService,
    private branchService: BranchsService,
    public contractService: ContractsService,
    public projectService: ProjectsService,
    private userService: UsersService,
    private signalsService: SignalsService,
    private conventionsService: ConventionsService,
    private menuService: MenuService
  ) {
    this.guardUiTick = this.signalsService.guardRefreshTick;
    this.permissionRefreshTick = computed(() => this.guardUiTick()); // Depende de guardUiTick
    effect(async () => {
      const shouldUpdate = this.signalsService.getUpdateBranchList()();
      if (shouldUpdate) {
          await this.getpermissionxBranchs(parseInt(this.selectedRoot)); // Refrescar la lista de branches
          setTimeout(() => this.signalsService.resetSignalIncAndExp());
        }
    });

    // 🔄 Recargar menús cuando cambian permisos (guardUiTick bump)
    effect(() => {
      this.guardUiTick(); // Observar cambios de permisos
      if (this.selectedRoot) {
        this.loadSidebarMenus(parseInt(this.selectedRoot));
      }
    });

    // 🔄 Effect para sincronización bidireccional Grid → Sidebar
    effect(() => {
      const selectedProjectFromSignal = this.signalsService.getProjectSelectedBySidebar()();

      // Actualizar el ComboBox visual solo si es diferente al valor actual
      if (selectedProjectFromSignal && selectedProjectFromSignal.toString() !== this.selectedProjectId) {
        this.selectedProjectId = selectedProjectFromSignal.toString();

        // Forzar actualización del DOM del select
        setTimeout(() => {
          const selectElement = document.getElementById('project') as HTMLSelectElement;
          if (selectElement) {
            selectElement.value = this.selectedProjectId;
          }
        }, 50);
      }
    });
  }

  /**
   * Tras armar `branchData` (incl. «Todas las sucursales»), elige sucursal activa:
   * conserva la ya seleccionada (p. ej. applybranch tras login) si sigue en la lista;
   * si no, primera sucursal concreta.
   */
  private pickBranchAfterListLoad(): { id: number; name: string } | null {
    if (!this.branchData?.length) {
      return null;
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
    return this.branchData.length > 1 ? this.branchData[1] : this.branchData[0];
  }

  private async applyPickedBranch(chosen: { id: number; name: string }): Promise<void> {
    this.selectedBranchId = String(chosen.id);
    this.signalsService.setBranchSelectedBySidebar(Number(chosen.id));
    this.signalsService.setBranchNameSelectedBySidebar(chosen.name);
    this.trackingService.setContract(this.selectedBranchId);
    setTimeout(() => {
      const sel = document.getElementById('branchs') as HTMLSelectElement;
      if (sel) {
        sel.value = this.selectedBranchId;
      }
    });
    await this.reloadGuardForSelectedBranch();
    await this.getpermissionxContracts();
  }

  private async reloadGuardForSelectedBranch(): Promise<void> {
    const branchId = Number(this.selectedBranchId);
    if (!Number.isFinite(branchId) || branchId === 0) {
      return;
    }
    try {
      await lastValueFrom(
        this.authService.reloadCurrentSessionGuard({
          idBranchOverride: branchId,
        })
      );
    } catch (error) {
      console.error('Error al recargar permisos por sucursal en sidebar:', error);
    }
  }

  async ngOnInit() {
    // Cargar preferencia de sidebar colapsado
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
      // Limpiar selects de contracts y projects cuando cambia root
      this.clearContractsAndProjects();

      // Obtener el nameSmall de la empresa seleccionada
      const selectedCompany = this.rootData.find(r => r.id === parseInt(this.selectedRoot));
      if (selectedCompany) {
        this.applyCompanyHeaderData(selectedCompany);
        this.signalsService.setCompanyNameSmall(selectedCompany.nameSmall || selectedCompany.name);
      }

      this.trackingService.setCompany(target.value);
      this.signalsService.setRootSelectedBySidebar(Number(this.selectedRoot));
      //    this.getpermissionxContracts(parseInt(this.selectedRoot));
      this.getpermissionxBranchs(parseInt(this.selectedRoot));
      this.loadSidebarMenus(parseInt(this.selectedRoot));
      this.getHeadersCompanys(this.selectedRoot);
    }
  }

  async getpermissionxRoots() {
    this.rootService.get2Root(this.signalsService.idUser()).subscribe({
      next: (data) => {
        const root = Object.values(data);
        if (root && root.length > 0) {
          this.rootData = root;
          // Seleccionar automáticamente el primer elemento
          this.selectedRoot = this.rootData[0].id;
          this.applyCompanyHeaderData(this.rootData[0]);
          this.signalsService.setRootSelectedBySidebar(
            Number(this.selectedRoot)
          );
          this.signalsService.setIsAdvanced(this.rootData[0].advanced);
          this.signalsService.setCompanyNameSmall(this.rootData[0].nameSmall || this.rootData[0].name);
          this.trackingService.setCompany(this.selectedRoot);
          this.getHeadersCompanys(this.selectedRoot);
          // Llamar a getpermissionxContracts con el primer elemento
          //   this.getpermissionxContracts(parseInt(this.selectedRoot));
          this.getpermissionxBranchs(parseInt(this.selectedRoot));
          this.loadSidebarMenus(parseInt(this.selectedRoot));
          // Forzar la actualización del select
          setTimeout(() => {
            const selectElement = document.getElementById(
              'root'
            ) as HTMLSelectElement;
            if (selectElement) {
              selectElement.value = this.selectedRoot!;
            }
          });
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
    const hasPermission = this.authService.hasDetailedPermission('principal', 'see-all-branches');
    const isRoot = this.signalsService.getemailChoose() === environment.root;

    if (hasPermission || isRoot) {

      this.branchService.getBranches2fields(idRoot).subscribe(
        async (data) => {
          data.sort((a, b) => a.name.localeCompare(b.name));

          // Crear el array de branches
          this.branchData = data.map((branch: any) => ({
            id: branch.id,
            name: branch.name,
          }));
          this.branchData.unshift({
            id: -idRoot, // ID negativo del root
            name: 'Todas las sucursales',
          });

          const chosen = this.pickBranchAfterListLoad();
          if (chosen) {
            await this.applyPickedBranch(chosen);
          }
        },
        (error) => {
          console.error('Error al obtener branches:', error);
          this.branchData = [];
        }
      );
    } else {
      this.branchService
        .getBranchesByUserAndCompany(
          this.signalsService.idUser(),
          parseInt(localStorage.getItem('company'))
        )
        .subscribe(
          async (data) => {
            this.branchData = (data.project || []).map((branch: any) => ({
              id: branch.id,
              name: branch.name,
            }));

            // Igual que en el flujo con see-all-branches: opción global para reportes / setup.
            this.branchData.unshift({
              id: -idRoot,
              name: 'Todas las sucursales',
            });

            const chosen = this.pickBranchAfterListLoad();
            if (chosen) {
              await this.applyPickedBranch(chosen);
            }
          },
          (error) => {
            console.error('Error al obtener branches:', error);
            this.branchData = [];
          }
        );
    }
  }

  async onContractsSelected(event: Event) {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.selectedContractId = target.value;
    if (this.selectedContractId) {
      const selectedItem = this.contractData.find(
        (c: any) => String(c.contractId) === this.selectedContractId
      );
      this.signalsService.setContractSelectedBySidebar(Number(this.selectedContractId));
      this.signalsService.contractSignal(
        Number(this.selectedContractId),
        selectedItem?.contract ?? ''
      );
      this.signalsService.setProjectSelectedBySidebar(null);
      this.signalsService.setSidebarProjectId(null);
      this.trackingService.setContract(this.selectedContractId);
      this.loadVigenteConvention(Number(this.selectedContractId));
      await this.getpermissionxProjects(Number(this.selectedContractId));
    }
  }

  async onBranchSelected(event: Event) {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.selectedBranchId = target.value;
    if (this.selectedBranchId) {
      // Limpiar selects de contracts y projects cuando cambia branch
      this.clearContractsAndProjects();

      // Lógica para añadir la signal de branch
      this.signalsService.setBranchSelectedBySidebar(
        Number(this.selectedBranchId)
      );
      const branchMeta = this.branchData.find(
        (branch) => branch.id === Number(this.selectedBranchId)
      );
      if (branchMeta) {
        this.signalsService.setBranchNameSelectedBySidebar(branchMeta.name);
      }
      await this.reloadGuardForSelectedBranch();
      await this.getpermissionxContracts();
      // Borro la signal de project para resetear el dato
    }
  }

  async getpermissionxContracts() {
    // Aquí consulto la tabla donde está el idUser correspondiente a company
    this.contractService
      .getContractsByBranch(
        this.signalsService.idUser(),
        parseInt(this.selectedBranchId)
      )
      .subscribe(async (data) => {
        const contract = Object.values(data);
        if (contract && contract.length > 0) {
          this.contractData = contract;
          // Auto-seleccionar siempre el primer contrato
          this.selectedContractId = String(this.contractData[0].contractId);
          this.signalsService.setContractSelectedBySidebar(Number(this.selectedContractId));
          this.signalsService.contractSignal(
            Number(this.selectedContractId),
            this.contractData[0].contract ?? ''
          );
          this.trackingService.setContract(this.selectedContractId);
          this.loadVigenteConvention(Number(this.selectedContractId));
          setTimeout(() => {
            const sel = document.getElementById('contracts') as HTMLSelectElement;
            if (sel) sel.value = this.selectedContractId;
          });
          await this.getpermissionxProjects(Number(this.selectedContractId));
        }
      });
  } 

  async onProjectSelected(event: Event) {
    this.finishSelectInteraction();
    const target = event.target as HTMLSelectElement;
    this.selectedProjectId = target.value;
    if (this.selectedProjectId) {
      // Lógica para añadir la signal de project
      this.signalsService.setProjectSelectedBySidebar(
        Number(this.selectedProjectId)
      );

      this.trackingService.setProject(this.selectedProjectId);
      this.signalsService.setProjectSelectedBySidebar(
        Number(this.selectedProjectId)
      );
      // Signal exclusiva del sidebar (no la toca ordenes)
      this.signalsService.setSidebarProjectId(Number(this.selectedProjectId));
      const found = this.projectData.find(p => String(p.idProject) === this.selectedProjectId);
      this.signalsService.setProjectNameBySidebar(found?.projectName ?? '');
    }
  }

  async getpermissionxProjects(idContract: number) {
    this.projectData = []; // Siempre vaciamos el array de proyectos
    this.projectService
      .getProjectsByContract(this.signalsService.idUser(), idContract)
      .subscribe({
        next: (data) => {
          this.projectData = Object.values(data);
          if (this.projectData.length > 0) {
            // Auto-seleccionar siempre el primer proyecto
            this.selectedProjectId = String(this.projectData[0].idProject);
            this.trackingService.setProject(this.selectedProjectId);
            this.signalsService.setProjectSelectedBySidebar(Number(this.selectedProjectId));
            // Signal exclusiva del sidebar (no la toca ordenes)
            this.signalsService.setSidebarProjectId(Number(this.selectedProjectId));
            this.signalsService.setProjectNameBySidebar(this.projectData[0].projectName ?? '');
            setTimeout(() => {
              const sel = document.getElementById('project') as HTMLSelectElement;
              if (sel) sel.value = this.selectedProjectId;
            });
          } else {
            this.selectedProjectId = '';
            this.trackingService.setProject('');
            this.signalsService.setSidebarProjectId(null);
          }
        },
        error: (error) => {
          this.selectedProjectId = '';
          this.trackingService.setProject('');
        },
      });
  }

  getHeadersCompanys(companyId) {
    this.rootService.getRootbyId(companyId).subscribe({
      next: (datacom: any) => {
        this.applyCompanyHeaderData(datacom);
      },
      error: () => {
        // Root/{id} failed — try get-all as fallback to retrieve company with picture
        this.rootService.getRoot().subscribe({
          next: (allRoots: any) => {
            const roots = Object.values(allRoots) as any[];
            const found = roots.find((r) => Number(r.id) === Number(companyId));
            if (found) {
              this.applyCompanyHeaderData(found);
            }
          },
          error: () => {
            // Both endpoints failed; keep whatever logo is already set
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
    this.signalsService.setCompanyName(company.name ?? '');

    const resolvedLogo = this.resolveCompanyLogo(company.picture);
    this.trackingService.setpictureComp(resolvedLogo);
    this.companyLogoSrc = resolvedLogo;

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
    this.trackingService.setPlatform(parseInt(target.value));
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

    //this.trackingService.setPlatform(parseInt(target.value)) ;
    this.trackingService.setPlataforma(target.value);

    this.selectedPlatformId = parseInt(target.value, 10);
    this.trackingService.setPlatform(this.selectedPlatformId);
  }

  // Menus de las llamadas del HTML
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
    if (!this.selectedContractId || Number(this.selectedContractId) <= 0) {
      event.preventDefault();
      alerts.basicAlert(
        'Contrato requerido',
        'Hey debes de tener siempre un Contrato para una estimacion',
        'warning'
      );
      return;
    }

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

  private clearContractsAndProjects() {
    // Limpiar datos de contracts
    this.contractData = [];
    this.selectedContractId = '';
    this.signalsService.setContractSelectedBySidebar(null);
    
    // Limpiar datos de projects
    this.projectData = [];
    this.selectedProjectId = '';
    this.signalsService.setProjectSelectedBySidebar(null);
    this.signalsService.setSidebarProjectId(null);
    this.trackingService.setProject('');

    // Limpiar convenio vigente
    this.conventionVigenteNombre = '';
    this.signalsService.setConventionVigente(null);
    
    // Limpiar los selects en el DOM
    setTimeout(() => {
      const contractSelect = document.getElementById('contracts') as HTMLSelectElement;
      if (contractSelect) {
        contractSelect.value = '';
      }
      
      const projectSelect = document.getElementById('project') as HTMLSelectElement;
      if (projectSelect) {
        projectSelect.value = '';
      }
    }, 50);
  }

  private loadVigenteConvention(idContract: number) {
    this.conventionsService.getVigenteConvention(idContract).subscribe(vigente => {
      if (vigente) {
        this.conventionVigenteNombre = vigente.name;
        this.signalsService.setConventionVigente(vigente);
      } else {
        this.conventionVigenteNombre = '';
        this.signalsService.setConventionVigente(null);
      }
    });
  }

  private loadPermissions() {
    return EMPTY;
  }

  loadSidebarMenus(idCompany: number): void {
    this.menuService.getSidebarMenus(idCompany).subscribe({
      next: (menus) => { this.sidebarMenus = menus; },
      error: (err) => console.error('Error cargando menus del sidebar:', err)
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
    // Guardar preferencia en localStorage
    localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
    // El main-page component detectará el cambio y aplicará la clase
  }

  // Método para expandir temporalmente la barra
  expandTemporarily() {
    if (this.isSidebarCollapsed) {
      this.isTemporarilyExpanded = true;
    }
  }

  // Método para colapsar después de la expansión temporal
  collapseAfterInteraction() {
    if (this.isSidebarCollapsed && this.isTemporarilyExpanded) {
      setTimeout(() => {
        if (this.isInteractingWithSelect) {
          return;
        }
        this.isTemporarilyExpanded = false;
      }, 200); // Pequeño delay para permitir la interacción
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
