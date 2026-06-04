import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-pages04',
  standalone: true,
  imports: [RouterModule, DomainsModule, SharedModule],
  templateUrl: './pages04.component.html',
  styleUrl: './pages04.component.scss',
})
export class Pages04Component {

}
