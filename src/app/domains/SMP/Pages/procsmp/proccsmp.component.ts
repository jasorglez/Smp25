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
  styleUrls: ['./proccsmp.component.scss']
})
export class ProccsmpComponent {

  private signalsService = inject(SignalsService);
  authService = inject(AuthService);

  idRoot: number;
  isRoot: boolean = false;

  ngOnInit() {
    this.isRoot = this.signalsService.getemailChoose() === environment.root;
  }


  //inject new way



}
