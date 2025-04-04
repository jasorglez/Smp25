import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { Environment } from 'ag-grid-enterprise';
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
  private authService = inject(AuthService);

  idRoot: number;
  isRoot: boolean = false;
  canSeeBranches: boolean = false;
  canSeeUsers: boolean = false;

  ngOnInit() {
    if (this.signalsService.getemailChoose() === environment.root) {
      this.isRoot = true;
    }
    else {
      this.isRoot = false;
    }

    this.canSeeBranches = this.isRoot || this.authService.hasDetailedPermission('setup', 'branches');
    this.canSeeUsers = this.authService.hasDetailedPermission('setup', 'users');

  }


  //inject new way



}
