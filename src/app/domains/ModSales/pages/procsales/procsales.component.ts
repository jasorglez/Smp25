import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procsales',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procsales.component.html',
  styleUrl: './procsales.component.scss'
})
export class ProcsalesComponent {
  

}
