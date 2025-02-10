import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procprojects',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procprojects.component.html',
  styleUrl: './procprojects.component.scss'
})
export class ProcprojectsComponent {

}
