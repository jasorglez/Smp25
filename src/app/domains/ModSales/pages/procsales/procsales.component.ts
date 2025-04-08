import {Component, inject} from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {AuthService} from "../../../../services/auth.service";
import { Router } from '@angular/router';

@Component({
  selector: 'app-procsales',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procsales.component.html',
  styleUrl: './procsales.component.scss'
})
export class ProcsalesComponent {
  authService = inject(AuthService)
  constructor(private router: Router) { }
  isPosActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/before-pos') || currentUrl.includes('/pos');
  }
}
