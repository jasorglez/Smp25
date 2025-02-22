import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-employees2',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './employees2.component.html',
  styleUrl: './employees2.component.scss'
})
export class Employees2Component {

  signalsService = inject(SignalsService);

}
