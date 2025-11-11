import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [RouterModule, DomainsModule, TranslateModule],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss'
})
export class EmployeesComponent {
  authService = inject(AuthService);
  signalsService = inject(SignalsService);

}
