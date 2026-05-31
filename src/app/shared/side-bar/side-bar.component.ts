import { Component, effect, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { EMPTY, map, tap } from 'rxjs';
import { environment } from '@env/environment';
import { ConventionsService } from 'app/services/conventions.service';
import { PresupuestoService } from 'app/services/presupuesto.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [SharedModule, FormsModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideBarComponent {
  isSidebarCollapsed = false;
  isTemporarilyExpanded = false;
  currentTheme = 'blue';
  showThemePicker = false;

  readonly sidebarThemes = [
    { id: 'blue',     label: 'Azul Noche',    preview: 'linear-gradient(135deg,#003366,#001f4d)' },
    { id: 'carbon',   label: 'Carbón',         preview: 'linear-gradient(135deg,#16213e,#e94560)' },
    { id: 'emerald',  label: 'Esmeralda',      preview: 'linear-gradient(135deg,#0d3b2e,#56e39f)' },
    { id: 'graphite', label: 'Grafito',         preview: 'linear-gradient(135deg,#1c1c1c,#f5a623)' },
    { id: 'burgundy', label: 'Borgoña',         preview: 'linear-gradient(135deg,#4a0e1e,#9b1730)' },
    { id: 'purple',   label: 'Violeta',         preview: 'linear-gradient(135deg,#2d1b69,#7c3aed)' },
    { id: 'teal',     label: 'Teal',            preview: 'linear-gradient(135deg,#0d4f4f,#2dd4bf)' },
    { id: 'military', label: 'Verde Militar',   preview: 'linear-gradient(135deg,#2d3a1f,#a3be8c)' },
  ];

  selectedRoot = signal<string>('');

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
  presupuestoVigenteNombre: string = '';

  usersData: any[];

  private rootAdministrator: number[] = [];

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
    private presupuestoService: PresupuestoService,
    private cdr: ChangeDetectorRef
  ) {
    effect(async () => {
      const shouldUpdate = this.signalsService.getUpdateBranchList()();
      if (shouldUpdate) {
          await this.getpermissionxBranchs(parseInt(this.selectedRoot())); // Refrescar la lista de branches
          setTimeout(() => this.signalsService.resetSignalIncAndExp());
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

  async ngOnInit() {
    // Cargar preferencia de sidebar colapsado
    const savedCollapsedState = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsedState !== null) {
      this.isSidebarCollapsed = savedCollapsedState === 'true';
    }
    // Cargar tema del sidebar
    const savedTheme = localStorage.getItem('sidebarTheme');
    if (savedTheme) this.currentTheme = savedTheme;

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
    const target = event.target as HTMLSelectElement;
    this.selectedRoot.set(target.value);
    if (this.selectedRoot()) {
      // Limpiar selects de contracts y projects cuando cambia root
      this.clearContractsAndProjects();

      // Obtener el nameSmall de la empresa seleccionada
      const selectedCompany = this.rootData.find(r => r.id === parseInt(this.selectedRoot()));
      if (selectedCompany) {
        this.signalsService.setCompanyNameSmall(selectedCompany.nameSmall || selectedCompany.name);
      }

      this.trackingService.setCompany(String(this.selectedRoot()));
      this.signalsService.setRootSelectedBySidebar(Number(this.selectedRoot()));
      //    this.getpermissionxContracts(parseInt(this.selectedRoot()));
      this.getpermissionxBranchs(parseInt(this.selectedRoot()));
      this.getHeadersCompanys(String(this.selectedRoot()));
      this.loadLicenseInfo(parseInt(this.selectedRoot()));
    }
  }

  async getpermissionxRoots() {
    this.rootService.get2Root(this.signalsService.idUser()).subscribe({
      next: (data) => {
        const root = Object.values(data);
        if (root && root.length > 0) {
          this.rootData = root;
          this.cdr.markForCheck();
          // Seleccionar automáticamente el primer elemento
          this.selectedRoot.set(this.rootData[0].id);
          this.signalsService.setRootSelectedBySidebar(
            Number(this.rootData[0].id)
          );
          this.signalsService.setIsAdvanced(this.rootData[0].advanced);
          this.signalsService.setCompanyNameSmall(this.rootData[0].nameSmall || this.rootData[0].name);
          this.trackingService.setCompany(this.rootData[0].id);
          this.getHeadersCompanys(this.rootData[0].id);
          this.loadLicenseInfo(parseInt(this.rootData[0].id));
          // Llamar a getpermissionxContracts con el primer elemento
          //   this.getpermissionxContracts(parseInt(this.selectedRoot()));
          this.getpermissionxBranchs(parseInt(this.selectedRoot()));
          // Forzar la actualización del select
          setTimeout(() => {
            const selectElement = document.getElementById(
              'root'
            ) as HTMLSelectElement;
            if (selectElement) {
              selectElement.value = String(this.selectedRoot());
            }
          });
        } else {
          this.selectedRoot.set('');
        }
      },
error: (error) => {
        console.error('Error al obtener roots:', error);
        this.selectedRoot.set('');
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
          this.cdr.markForCheck();

          // branchData[0] = "Todas las sucursales" (ID negativo) → seleccionar la primera real (índice 1)
          const defaultBranch = this.branchData.length > 1 ? this.branchData[1] : this.branchData[0];
          if (defaultBranch) {
            this.selectedBranchId = String(defaultBranch.id);

            this.signalsService.setBranchSelectedBySidebar(Number(this.selectedBranchId));
            this.signalsService.setBranchNameSelectedBySidebar(defaultBranch.name);
            this.trackingService.setContract(this.selectedBranchId);

            setTimeout(() => {
              const sel = document.getElementById('branchs') as HTMLSelectElement;
              if (sel) sel.value = this.selectedBranchId;
            });

            await this.getpermissionxContracts();
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
            this.branchData = data.project.map((branch: any) => ({
              id: branch.id,
              name: branch.name,
            }));
            this.cdr.markForCheck();

            if (this.branchData.length > 0) {
              this.selectedBranchId = String(this.branchData[0].id);

              this.signalsService.setBranchSelectedBySidebar(
                Number(this.selectedBranchId)
              );
              this.signalsService.setBranchNameSelectedBySidebar(
                this.branchData[0].name
              );
              this.trackingService.setContract(this.selectedBranchId);

              // Actualizar DOM después de que *ngFor haya creado las opciones
              setTimeout(() => {
                const sel = document.getElementById('branchs') as HTMLSelectElement;
                if (sel) sel.value = this.selectedBranchId;
              });

              // Cargar contratos en cascada
              await this.getpermissionxContracts();
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
    const target = event.target as HTMLSelectElement;
    this.selectedBranchId = target.value;
    if (this.selectedBranchId) {
      // Limpiar selects de contracts y projects cuando cambia branch
      this.clearContractsAndProjects();

      // Lógica para añadir la signal de branch
      this.signalsService.setBranchSelectedBySidebar(
        Number(this.selectedBranchId)
      );
      this.signalsService.setBranchNameSelectedBySidebar(
        this.branchData.find(
          (branch) => branch.id === Number(this.selectedBranchId)
        ).name
      );
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
          this.cdr.markForCheck();
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
      this.loadVigentePresupuesto(Number(this.selectedRoot()), Number(this.selectedProjectId));
    }
  }

  async getpermissionxProjects(idContract: number) {
    this.projectData = []; // Siempre vaciamos el array de proyectos
    this.projectService
      .getProjectsByContract(this.signalsService.idUser(), idContract)
      .subscribe({
        next: (data) => {
          this.projectData = Object.values(data);
          this.cdr.markForCheck();
          if (this.projectData.length > 0) {
            // Auto-seleccionar siempre el primer proyecto
            this.selectedProjectId = String(this.projectData[0].idProject);
            this.trackingService.setProject(this.selectedProjectId);
            this.signalsService.setProjectSelectedBySidebar(Number(this.selectedProjectId));
            // Signal exclusiva del sidebar (no la toca ordenes)
            this.signalsService.setSidebarProjectId(Number(this.selectedProjectId));
            this.signalsService.setProjectNameBySidebar(this.projectData[0].projectName ?? '');
            this.loadVigentePresupuesto(Number(this.selectedRoot()), Number(this.selectedProjectId));
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
    this.rootService.getRootbyId(companyId).subscribe((datacom: any) => {
      // Utilizar los datos obtenidos
      this.trackingService.setnameComp(datacom.name);
      this.signalsService.setCompanyName(datacom.name); // Envio la signal a auth.service
      this.trackingService.setpictureComp(datacom.picture);
      this.trackingService.setPictureComp2(datacom.picture2);
      this.trackingService.setPictureComp3(datacom.picture3);
      //this.trackingService.setformatrepint(datacom.formatrep);
      // alert('Format:'+ datacom.formatrep);
    });
  }

  loadLicenseInfo(idRoot: number) {
    this.rootService.getRootbyId(idRoot).subscribe((data: any) => {
      const status = data?.licenseStatus ?? 'trial';
      const days   = data?.daysRemaining ?? data?.licenseDays ?? 15;
      this.signalsService.setLicenseStatus(status);
      this.signalsService.setLicenseDaysRemaining(days);
    });
  }

  async onCpSelected(event: Event) {
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

  publicidadMenu() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Publicidad',
      'Menu Side Bar',
      ''
    );
  }

  Admonproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Admon',
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

  clienteproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Cliente',
      'Menu Side Bar',
      ''
    );
  }

  productosproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Productos',
      'Menu Side Bar',
      ''
    );
  }

  pedidosproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Pedidos',
      'Menu Side Bar',
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

    // Limpiar presupuesto vigente
    this.presupuestoVigenteNombre = '';
    
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

  private loadVigentePresupuesto(idCompany: number, idProject: number) {
    if (!idCompany || !idProject) { this.presupuestoVigenteNombre = ''; return; }
    this.presupuestoService.getVigente(idCompany, idProject).subscribe({
      next: (p) => { this.presupuestoVigenteNombre = p ? p.nombre : ''; },
      error: () => { this.presupuestoVigenteNombre = ''; }
    });
  }

  private loadPermissions() {
    return EMPTY;
  }

toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.isTemporarilyExpanded = false;
    this.showThemePicker = false;
    localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
  }

  setTheme(themeId: string) {
    this.currentTheme = themeId;
    localStorage.setItem('sidebarTheme', themeId);
    this.showThemePicker = false;
    this.cdr.markForCheck();
  }

  toggleThemePicker() {
    if (this.isSidebarCollapsed && !this.isTemporarilyExpanded) {
      this.expandTemporarily();
    }
    this.showThemePicker = !this.showThemePicker;
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
        this.isTemporarilyExpanded = false;
      }, 200); // Pequeño delay para permitir la interacción
    }
  }
}
