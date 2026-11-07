import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-demo-login',
  standalone: true,
  template: `
    <main class="d-flex flex-column align-items-center justify-content-center vh-100 p-4 text-center"
          style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
      <section class="card shadow p-4" style="max-width: 30rem;">
        <h1 class="h4 mb-3">Acceso demo no disponible</h1>
        <p class="mb-4">
          Para proteger la cuenta, el acceso de demostración requiere una sesión segura configurada en el servidor.
          Inicia sesión con tu cuenta para continuar.
        </p>
        <button class="btn btn-primary" type="button" (click)="goToLogin()">
          Ir a iniciar sesión
        </button>
      </section>
    </main>
  `,
})
export class DemoLoginComponent {
  private readonly router = inject(Router);

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
