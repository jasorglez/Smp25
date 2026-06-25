import { Component, effect, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-procmenuconfiguracion',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmenuconfiguracion.component.html',
  styleUrl: './procmenuconfiguracion.component.scss'
})
export class ProcmenuconfiguracionComponent {

  private signalsService = inject(SignalsService);
  authService = inject(AuthService);

  isRoot: boolean = false;
  canSeeBranches: boolean = false;
  canSeeUsers: boolean = false;
  canSeeTelegramMonitor: boolean = false;

  private readonly TELEGRAM_ADMIN_EMAILS = ['root@bi2.mx', 'asoriano@bi2.mx'];

  constructor() {
    effect(() => {
      const email = (this.signalsService.getemailChoose() || '').toLowerCase();
      this.isRoot = email === environment.root.toLowerCase();
      this.canSeeTelegramMonitor = this.TELEGRAM_ADMIN_EMAILS.includes(email);
      this.canSeeBranches = this.isRoot || this.authService.hasDetailedPermission('setup', 'branches');
      this.canSeeUsers = this.authService.hasDetailedPermission('setup', 'users');
    });
  }
}
