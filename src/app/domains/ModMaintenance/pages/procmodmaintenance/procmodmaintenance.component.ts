import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procmodmaintenance',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmodmaintenance.component.html',
  styleUrl: './procmodmaintenance.component.scss'
})
export class ProcmodmaintenanceComponent {

}
