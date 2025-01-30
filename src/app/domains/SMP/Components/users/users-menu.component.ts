import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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

@Component({
  selector: 'app-users-menu',
  standalone: true,
  imports: [CommonModule, UsersComponent, UsersxoilfieldsComponent,
    UsersxcompanysComponent, UsersxprojectsComponent, UsersxcontractsComponent,
    UsersxrootComponent, UsersxwarehousesComponent, UsersxbranchesComponent,
    UsersxMasterPermissions2Component],
  templateUrl: './users-menu.component.html'
})
export class UsersMenuComponent {
  private trackingService = inject(TrackingService);
  private signalsService = inject(SignalsService);
  profile = computed(() => this.signalsService.profile);

  constructor() {
    this.onUsersSelected('users');
  }

  selectedTab: string;
  onUsersSelected(tabName: string) {
    this.selectedTab = tabName;
    switch (tabName) {
      case 'users':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users',
          'Warehouses',
          this.trackingService.getEmail()
        );
        break;
        case 'usersxcompanys':
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Click en la Pestaña Users x Companys',
            'Warehouses',
            this.trackingService.getEmail()
          );
          break;
          case 'usersxcontracts':
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Click en la Pestaña Users x Contracts',
              'Warehouses',
              this.trackingService.getEmail()
            );
            break;
      case 'usersxprojects':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users x Projects',
          'Warehouses',
          this.trackingService.getEmail()
        );
        break;
      case 'usersxoilfields':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users x Oilfields',
          'Warehouses',
          this.trackingService.getEmail()
        );
        break;
    }
  }
}
