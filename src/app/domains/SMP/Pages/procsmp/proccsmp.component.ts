import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-proccsmp',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './proccsmp.component.html',
  styleUrl: './proccsmp.component.scss'
})
export class ProccsmpComponent {

  private signalsService = inject(SignalsService);
  authService = inject(AuthService);

  idRoot: number;
  isRoot: boolean = false;
  canSeeBranches: boolean = false;
  canSeeUsers: boolean = false;
  canSeeCorporativos: boolean = false;
  canSeeRoot: boolean = false;
  canSeeRoles: boolean = false;

  ngOnInit() {
    if (this.signalsService.getemailChoose() === environment.root) {
      this.isRoot = true;
    }
    else {
      this.isRoot = false;
    }

    this.canSeeBranches = this.isRoot || this.authService.hasDetailedPermission('setup', 'branches');
    this.canSeeUsers = this.authService.hasDetailedPermission('setup', 'users');
    this.canSeeCorporativos = this.isRoot || this.authService.hasDetailedPermission('setup', 'corporativos');
    this.canSeeRoot = this.isRoot || this.authService.hasDetailedPermission('setup', 'root');
    this.canSeeRoles = this.isRoot || this.authService.hasDetailedPermission('setup', 'roles');

  }


  //inject new way



}
