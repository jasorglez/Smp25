import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { UsersComponent } from './users.component';
import { UsersxoilfieldsComponent } from './usersxoilfields.component';
import { UsersxcompanysComponent } from "./usersxcompanys.component";
import { UsersxprojectsComponent } from "./usersxprojects.component";
import { UsersxcontractsComponent } from "./usersxcontracts.component";
import { UsersxrootComponent } from "./usersxroot.component";
import { SignalsService } from 'app/services/signals.service';
import { UsersxwarehousesComponent } from "./usersxwarehouses.component";
import { UsersxbranchesComponent } from './usersxbranches.component';
import { UsersXStoresComponent } from "./usersxstores.component";
import { UsersXCashRegistersComponent } from "./usersxcashregisters.component";
import { environment } from '@env/environment';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-users-menu',
  standalone: true,
  imports: [CommonModule, UsersComponent, UsersxoilfieldsComponent,
    UsersxcompanysComponent, UsersxprojectsComponent, UsersxcontractsComponent,
    UsersxrootComponent, UsersxwarehousesComponent, UsersxbranchesComponent,
    UsersXStoresComponent, UsersXCashRegistersComponent],
  templateUrl: './users-menu.component.html',
  styleUrl: './users-menu.component.scss'
})
export class UsersMenuComponent {
  private trackingService = inject(TrackingService);
  private signalsService  = inject(SignalsService);
  authService = inject(AuthService);
  
  showRoot : boolean = false ;
  
  profile = computed(() => this.signalsService.profile);

  idRoot: number = 0 ;
  correoglobal: string = ''; // Asegúrate de que esta variable tenga el valor correcto

 /*  selectedTab: string = '';

    // Función para verificar si el correo es root
  isRootEmail(): boolean {
    return this.correoglobal === environment.root;
  }*/

  constructor() {
    effect(() => {
      const profileUserId = Number(this.signalsService.profile.idUser());
      const signalUserId = Number(this.signalsService.getIdUSer()());
      const userId = profileUserId || signalUserId;
      // También reacciona cuando se guardan permisos (refresSecurity)
      const refresh = this.signalsService.getRefresSecurity()();
      if (userId > 0) {
        this.loadBasePermissionsByUser(userId);
      }
      if (refresh) {
        this.signalsService.setRefresSecurity(false);
      }
    });
  }
 
  ngOnInit() {
    this.correoglobal = this.signalsService.getemailChoose() ;

    this.idRoot       = this.signalsService.getRootSelectedBySidebar()();

    if (this.correoglobal === environment.root) {
       this.showRoot = true
    }

  }

  selectedTab: string = '';
  hasSelectedUser: boolean = false;
  private baseUserPermissions: any = null;
  private readonly usersSetupKeys = [
    'users',
    'master-permissions',
    'contractors',
    'contracts',
    'oilfields',
    'projects',
    'companies',
    'branches',
    'warehouses'
  ];

  hasUsersSetupAccess(detailedPermissionKey: string): boolean {
    const permissions = this.baseUserPermissions ?? this.authService.getUserPermissions();
    const section = this.getUsersSetupSection(permissions);
    const children = section?.children ?? {};
    const isActive = (value: any) => value?.active === true || value === true;
    const subSection = children?.[detailedPermissionKey];
    let bySection = isActive(subSection);

    // Caso especial: "Sección de usuarios" puede venir con identificador distinto según catálogo.
    if (!bySection && detailedPermissionKey === 'users') {
      const aliasKeys = ['users', 'user', 'users-section', 'section-users', 'userssetup', 'setup-users'];
      bySection = aliasKeys.some((key) => isActive(children?.[key]));

      if (!bySection) {
        bySection = Object.entries(children).some(([key, value]) =>
          /(user|usuario)/i.test(key) && isActive(value)
        );
      }
    }

    return bySection;
  }

  hasUsersTabAccess(): boolean {
    const permissions = this.baseUserPermissions ?? this.authService.getUserPermissions();
    const section = this.getUsersSetupSection(permissions);
    const masterActive = section?.active === true;
    return this.hasUsersSetupAccess('users') || masterActive;
  }

  hasMasterActive(masterKey: string): boolean {
    const permissions = this.baseUserPermissions ?? this.authService.getUserPermissions();
    return permissions?.[masterKey]?.active === true;
  }

  private getUsersSetupSection(permissions: any): any {
    if (!permissions) return null;
    if (permissions['users-setup']) return permissions['users-setup'];
    const sections = Object.values(permissions).filter((item: any) => item?.children && typeof item.children === 'object');
    return sections.find((section: any) =>
      this.usersSetupKeys.some((key) => section.children?.[key] !== undefined)
    ) || null;
  }

  private loadBasePermissionsByUser(userId: number) {
    if (!userId || isNaN(userId)) return;
    this.authService.fetchUserPermissions(userId).subscribe({
      next: (data: any) => {
        this.baseUserPermissions = data?.permissions ?? null;
      },
      error: () => {
        this.baseUserPermissions = null;
      }
    });
  }

  onUsersSelected(tabName: string) {
    this.selectedTab = tabName;
    switch (tabName) {
      case 'users':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users',
          'SETUP',
          this.trackingService.getEmail()
        );
        break;
        case 'usersxcompanys':
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Click en la Pestaña Users x Companys',
            'SETUP',
            this.trackingService.getEmail()
          );
          break;
          case 'usersxcontracts':
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Click en la Pestaña Users x Contracts',
              'SETUP',
              this.trackingService.getEmail()
            );
            break;
      case 'usersxprojects':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users x Projects',
          'SETUP',
          this.trackingService.getEmail()
        );
        break;
      case 'usersxoilfields':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users x Oilfields',
          'SETUP',
          this.trackingService.getEmail()
        );
        break;
    }
  }

  onUserSelectionChange(hasSelection: boolean) {
    this.hasSelectedUser = hasSelection;
    if (!hasSelection && (this.selectedTab === 'usersxroot' || this.selectedTab === 'usersxbranches')) {
      this.selectedTab = '';
    }
  }
}
