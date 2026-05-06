import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SharedModule } from 'app/shared/shared.module';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-red-ciudadana',
  standalone: true,
  imports: [RouterModule, DomainsModule, SharedModule],
  templateUrl: './red-ciudadana.component.html',
  styleUrl: './red-ciudadana.component.scss',
})
export class RedCiudadanaComponent {
  authService = inject(AuthService);
}
