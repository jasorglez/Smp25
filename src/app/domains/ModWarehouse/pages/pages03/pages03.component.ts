import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-pages03',
  standalone: true,
  imports: [RouterModule, DomainsModule, SharedModule],
  templateUrl: './pages03.component.html',
  styleUrl: './pages03.component.scss'
})
export class Pages03Component {

}
