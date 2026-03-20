import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './departamentos.component.html',
})
export class DepartamentosComponent {
  authService = inject(AuthService);
}
