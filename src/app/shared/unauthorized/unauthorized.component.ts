import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [],
  templateUrl: './unauthorized.component.html',
  styleUrl: './unauthorized.component.scss',
})
export class UnauthorizedComponent {
  constructor(private router: Router) {}

  async ngOnInit() {
    alerts.basicAlert(
      'Error',
      'Usted no está autorizado a visitar esta página',
      'error'
    );
    this.router.navigate(['/logistica']);
  }
}
