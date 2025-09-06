import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procprojects',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procprojects.component.html',
  styleUrl: './procprojects.component.scss'
})
export class ProcprojectsComponent {
  authService = inject(AuthService);

  public signalsService = inject(SignalsService);

    ngOnInit() {
      this.signalsService.setCatalogSelected('PROJECTS');
    }

     
}
