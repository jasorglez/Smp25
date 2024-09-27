import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { UsersService } from 'app/services/users.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';

@Component({
  selector: 'app-users-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-profile.component.html'
})
export class UsersProfileComponent {

  private usersService = inject(UsersService);
  usersxpermissionsService = inject(UsersxpermissionsService);
  
  profile = computed(()=> this.usersService.profile);

}
