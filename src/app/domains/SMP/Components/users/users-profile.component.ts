import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';

@Component({
  selector: 'app-users-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-profile.component.html',
  styleUrl: './users-profile.component.scss',
})
export class UsersProfileComponent {
  private signalsService = inject(SignalsService);
  usersxpermissionsService = inject(UsersxpermissionsService);

  private readonly fallbackPic = './assets/img/profile.png';

  profile = this.signalsService.profile;
  displayPic = this.fallbackPic;

  nameCompany = this.signalsService.nameCompany();
  nameContract = this.signalsService.nameContract();

  /** Evita resaltar “Departamento no encontrado” como si fuera un rol válido. */
  get isOrganizationPlaceholder(): boolean {
    const o = (this.profile.organizationUser() || '').toLowerCase();
    return o.includes('no encontrado') || o.includes('sin definir');
  }

  constructor() {
    effect(() => {
      const url = this.profile.profilePicUser();
      this.displayPic =
        url && String(url).trim() !== '' ? String(url) : this.fallbackPic;
    });
  }

  onImgError(): void {
    this.displayPic = this.fallbackPic;
  }
}
