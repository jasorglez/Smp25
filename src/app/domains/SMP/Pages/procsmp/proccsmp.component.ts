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
  /** Lectura en plantilla para reevaluar *ngIf tras reloadCurrentSessionGuard / bumpGuardRefreshTick. */
  readonly guardUiTick = this.signalsService.guardRefreshTick;

  idRoot: number;
  isRoot: boolean = false;

  ngOnInit() {
    if (this.signalsService.getemailChoose() === environment.root) {
      this.isRoot = true;
    }
    else {
      this.isRoot = false;
    }
  }


  //inject new way



}
