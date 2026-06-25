import { Component, inject } from '@angular/core';
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

  private readonly TELEGRAM_ADMIN_EMAILS = ['root@bi2.mx', 'asoriano@bi2.mx'];

  get email(): string {
    return (this.signalsService.getemailChoose() || '').toLowerCase();
  }

  get isRoot(): boolean {
    return this.email === environment.root.toLowerCase();
  }

  get canSeeBranches(): boolean {
    return this.isRoot || this.authService.hasDetailedPermission('setup', 'branches');
  }

  get canSeeUsers(): boolean {
    return this.authService.hasDetailedPermission('setup', 'users');
  }

  get canSeeTelegramMonitor(): boolean {
    return this.TELEGRAM_ADMIN_EMAILS.includes(this.email);
  }
}
