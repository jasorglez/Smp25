import { Component, computed } from '@angular/core';
import { UsersService } from 'app/services/users.service';

@Component({
  selector: 'app-users-profile',
  standalone: true,
  imports: [],
  templateUrl: './users-profile.component.html',
  styleUrl: './users-profile.component.scss'
})
export class UsersProfileComponent {

  constructor(private usersService: UsersService) {}

  profile = computed(()=> this.usersService.profile);

}
