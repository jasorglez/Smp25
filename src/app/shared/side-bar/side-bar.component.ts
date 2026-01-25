import { Component, effect } from '@angular/core';
import { Router } from '@angular/router';
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
import { EMPTY, map, tap } from 'rxjs';
import { environment } from '@env/environment';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  isSidebarCollapsed = false;

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
    private signalsService: SignalsService
  ) {
    effect(async () => {
      const shouldUpdate = this.signalsService.getUpdateBranchList()();
      if (shouldUpdate) {
          await this.getpermissionxBranchs(parseInt(this.selectedRoot)); // Refrescar la lista de branches
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

    this.userRoot = this.signalsService.getUserRoot()();
    //console.log('User Root:', this.userRoot);
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
    this.selectedRoot = target.value;
    if (this.selectedRoot) {
      // Limpiar selects de contracts y projects cuando cambia root
      this.clearContractsAndProjects();
      
      this.trackingService.setCompany(target.value);
      this.signalsService.setRootSelectedBySidebar(Number(this.selectedRoot));
      //    this.getpermissionxContracts(parseInt(this.selectedRoot));
      this.getpermissionxBranchs(parseInt(this.selectedRoot));
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
          this.signalsService.setRootSelectedBySidebar(
            Number(this.selectedRoot)
          );
          this.signalsService.setIsAdvanced(this.rootData[0].advanced);
          this.trackingService.setCompany(this.selectedRoot);
          this.getHeadersCompanys(this.selectedRoot);
          // Llamar a getpermissionxContracts con el primer elemento
          //   this.getpermissionxContracts(parseInt(this.selectedRoot));
          this.getpermissionxBranchs(parseInt(this.selectedRoot));
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
    // Verificar si el root actual está en rootAdministrator
    // Si es admin root, o si tiene el permiso principal/see-all-branches, añadir la opción "Todas las sucursales" al principio

    if (
      this.authService.hasDetailedPermission('principal', 'see-all-branches') ||
      this.signalsService.getemailChoose() === environment.root
    ) {
      await this.branchService.getBranches2fields(idRoot).subscribe(
        (data) => {
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

          if (this.branchData.length > 0) {
            this.selectedBranchId = this.branchData[0].id;

            // Agregamos estas líneas para simular la selección automática
            this.signalsService.setBranchSelectedBySidebar(
              Number(this.selectedBranchId)
            );
            this.signalsService.setBranchNameSelectedBySidebar(
              this.branchData[0].name
            );
            this.trackingService.setContract(this.selectedBranchId);

            // Forzamos la actualización del select
            setTimeout(() => {
              const selectElement = document.getElementById(
                'branchs'
              ) as HTMLSelectElement;
              if (selectElement) {
                selectElement.value = this.selectedBranchId;
                // Disparamos el evento change manualmente
                selectElement.dispatchEvent(new Event('change'));
              }
            }, 500);
          }
        },
        (error) => {
          console.error('Error al obtener branches:', error);
          this.branchData = []; // Asignar un array vacío en caso de error
        }
      );
    } else {
      this.branchService
        .getBranchesByUserAndCompany(
          this.signalsService.idUser(),
          parseInt(localStorage.getItem('company'))
        )
        .subscribe(
          (data) => {
            // Crear el array de branches
            this.branchData = data.project.map((branch: any) => ({
              id: branch.id,
              name: branch.name,
            }));

            if (this.branchData.length > 0) {
              this.selectedBranchId = this.branchData[0].id;

              // Agregamos estas líneas para simular la selección automática
              this.signalsService.setBranchSelectedBySidebar(
                Number(this.selectedBranchId)
              );
              this.signalsService.setBranchNameSelectedBySidebar(
                this.branchData[0].name
              );
              this.trackingService.setContract(this.selectedBranchId);

              // Forzamos la actualización del select
              setTimeout(() => {
                const selectElement = document.getElementById(
                  'branchs'
                ) as HTMLSelectElement;
                if (selectElement) {
                  selectElement.value = this.selectedBranchId;
                  // Disparamos el evento change manualmente
                  selectElement.dispatchEvent(new Event('change'));
                }
              }, 500);
            }
          },
          (error) => {
            console.error('Error al obtener branches:', error);
            this.branchData = []; // Asignar un array vacío en caso de error
          }
        );
    }
  }

  async onContractsSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedContractId = target.value;
    if (this.selectedContractId) {
      // Lógica para añadir la signal de solo contract
      this.signalsService.setContractSelectedBySidebar(
        Number(this.selectedContractId)
      );
      // Borro la signal de project para resetear el dato
      this.signalsService.setProjectSelectedBySidebar(null);
      this.trackingService.setContract(this.selectedContractId);
      this.signalsService.setContractSelectedBySidebar(
        Number(this.selectedContractId)
      );
      //llamo a los permisos de x Project
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
          // this.getpermissionxProjects(parseInt(this.selectedContractId));
          if (this.contractData.length === 1) {
            this.selectedContractId = this.contractData[0].contractId;
            this.signalsService.setContractSelectedBySidebar(Number(this.selectedContractId));
            this.trackingService.setContract(this.selectedContractId);
            // Llama a getpermissionxProjects automáticamente si lo necesitas
            await this.getpermissionxProjects(Number(this.selectedContractId));
          }
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
            if (this.projectData.length === 1) {
              this.selectedProjectId = this.projectData[0].idProject;
              this.trackingService.setProject(this.selectedProjectId);
              this.signalsService.setProjectSelectedBySidebar(Number(this.selectedProjectId));
            }
          } else {
            this.selectedProjectId = '';
            this.trackingService.setProject('');
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
    this.trackingService.setProject('');
    
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

  private loadPermissions() {
    return EMPTY;
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    // Guardar preferencia en localStorage
    localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
    // El main-page component detectará el cambio y aplicará la clase
  }
}
