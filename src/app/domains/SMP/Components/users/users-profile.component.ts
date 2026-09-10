import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';

@Component({
  selector: 'app-users-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-profile.component.html',
  styleUrl: './users-profile.component.scss'
})
export class UsersProfileComponent {

  private signalsService = inject(SignalsService);
  usersxpermissionsService = inject(UsersxpermissionsService);
  
  profile = this.signalsService.profile;

  nameCompany = this.signalsService.nameCompany();
  nameContract = this.signalsService.nameContract();

}
