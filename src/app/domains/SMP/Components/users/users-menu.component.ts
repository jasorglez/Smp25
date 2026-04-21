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
import { UsersxMasterPermissions2Component } from "./usersxmasterpermissions2.component";
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
    UsersxMasterPermissions2Component, UsersXStoresComponent, UsersXCashRegistersComponent],
  templateUrl: './users-menu.component.html',
  styles: [`
    .nav-pills .nav-link:hover,
    .nav-pills .nav-link:focus {
      color: #495057 !important;
    }

    .nav-pills .nav-link.active,
    .nav-pills .show > .nav-link {
      background-color: #2563eb !important;
      border-color: #2563eb !important;
      color: #ffffff !important;
    }

    .nav-pills .nav-link.active:hover,
    .nav-pills .nav-link.active:focus,
    .nav-pills .show > .nav-link:hover,
    .nav-pills .show > .nav-link:focus {
      color: #ffffff !important;
      background-color: #1d4ed8 !important;
      border-color: #1d4ed8 !important;
    }
  `]
})
export class UsersMenuComponent {
  private trackingService = inject(TrackingService);
  private signalsService  = inject(SignalsService);
  authService = inject(AuthService);
  /** Lectura en plantilla para que *ngIf que dependen del guard se actualicen al bump. */
  readonly guardUiTick = this.signalsService.guardRefreshTick;
  
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
      this.guardUiTick();
      if (this.selectedTab === 'usersxwarehouses' && !this.canShowWarehousesTab()) {
        this.selectedTab = 'users';
      }
    });
    this.onUsersSelected('users');
  }

  /** Coherente con *ngIf de la pestaña Almacenes (Permisos maestros / guard). */
  private canShowWarehousesTab(): boolean {
    if (!this.profile().emailUser()) {
      return false;
    }
    return this.showRoot || this.authService.hasUsersMenuWarehousesAccess();
  }
 
  ngOnInit() {       
    this.correoglobal = this.signalsService.getemailChoose() ;

    this.idRoot       = this.signalsService.getRootSelectedBySidebar()();
    
    if (this.correoglobal === environment.root) {
       this.showRoot = true
    }
  }

  selectedTab: string;

  onUsersSelected(tabName: string) {
    if (tabName === 'usersxwarehouses' && !this.canShowWarehousesTab()) {
      tabName = 'users';
    }
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
}
