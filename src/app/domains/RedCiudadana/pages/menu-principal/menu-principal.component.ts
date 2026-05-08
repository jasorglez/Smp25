import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-menu-principal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './menu-principal.component.html',
  styleUrl: './menu-principal.component.scss',
})
export class MenuPrincipalComponent {
  private router = inject(Router);
  auth = inject(AuthService);

  irA(ruta: string): void {
    this.router.navigate([ruta]);
  }
}
