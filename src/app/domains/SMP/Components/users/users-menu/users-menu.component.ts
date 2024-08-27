import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { UsersComponent } from '../users.component';

@Component({
  selector: 'app-users-menu',
  standalone: true,
  imports: [CommonModule, UsersComponent],
  templateUrl: './users-menu.component.html',
  styleUrl: './users-menu.component.scss',
})
export class UsersMenuComponent {
  private trackingService = inject(TrackingService);

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
      case 'usersxprojects':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users',
          'Warehouses',
          this.trackingService.getEmail()
        );
        break;
      case 'usersxoilfields':
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Click en la Pestaña Users',
          'Warehouses',
          this.trackingService.getEmail()
        );
        break;
    }
  }
}
