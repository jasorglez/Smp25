import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { UsersComponent } from '../users.component';
import { UsersxoilfieldsComponent } from '../usersxoilfields/usersxoilfields.component';
import { UsersxcompanysComponent } from "../usersxcompanys/usersxcompanys.component";
import { UsersService } from 'app/services/users.service';

@Component({
  selector: 'app-users-menu',
  standalone: true,
  imports: [CommonModule, UsersComponent, UsersxoilfieldsComponent, UsersxcompanysComponent],
  templateUrl: './users-menu.component.html',
  styleUrl: './users-menu.component.scss',
})
export class UsersMenuComponent {
  private trackingService = inject(TrackingService);

  constructor(public usersService: UsersService) {
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
            'Click en la Pestaña Users x COmpanys',
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
