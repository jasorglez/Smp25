import {Component, inject} from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {AuthService} from "../../../../services/auth.service";

@Component({
  selector: 'app-procsales',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procsales.component.html',
  styleUrl: './procsales.component.scss'
})
export class ProcsalesComponent {
  authService = inject(AuthService)

}
