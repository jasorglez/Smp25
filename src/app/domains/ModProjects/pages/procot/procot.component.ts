import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from '../../domainsmodule';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-procot',
  standalone: true,
  imports: [RouterModule, DomainsModule, TranslateModule],
  templateUrl: './procot.component.html',
  styleUrl: './procot.component.scss'
})
export class ProcotComponent {

}