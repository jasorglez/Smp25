import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-page01',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './page01.component.html',
  styleUrl: './page01.component.scss'
})
export class Page01Component {

}
