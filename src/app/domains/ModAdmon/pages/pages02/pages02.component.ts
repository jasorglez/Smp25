import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-pages02',
  standalone: true,
  imports: [RouterModule, DomainsModule,SharedModule],
  templateUrl: './pages02.component.html',
  styleUrl: './pages02.component.scss'
})
export class Pages02Component {

}
