import { CommonModule } from '@angular/common';
import { Component, computed, inject, Input } from '@angular/core';
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

  @Input() sectionTitle: string = '';
  @Input() sectionIcon: string = 'bi-list-check';
  @Input() assignedItems: string[] = [];

  private signalsService = inject(SignalsService);
  usersxpermissionsService = inject(UsersxpermissionsService);
  
  profile = this.signalsService.profile;

  nameCompany = this.signalsService.nameCompany();
  nameContract = this.signalsService.nameContract();

  get visibleAssignedItems(): string[] {
    return [...new Set((this.assignedItems ?? []).filter(item => !!item))];
  }

}
