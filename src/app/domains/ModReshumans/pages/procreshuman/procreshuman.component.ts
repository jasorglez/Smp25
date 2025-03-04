import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procreshuman',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procreshuman.component.html',
  styleUrl: './procreshuman.component.scss'
})

export class ProcreshumanComponent {

}
