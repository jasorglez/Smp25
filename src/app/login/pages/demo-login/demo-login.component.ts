import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-demo-login',
  standalone: true,
  template: `
    <main class="d-flex flex-column align-items-center justify-content-center vh-100 p-4 text-center"
          style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
      <section class="card shadow p-4" style="max-width: 30rem;">
        <div class="spinner-border text-primary mx-auto mb-3" role="status" aria-label="Abriendo demo"></div>
        <h1 class="h4 mb-2">Preparando la empresa demo</h1>
        <p class="mb-0 text-muted">Iniciando una sesión de demostración segura…</p>
      </section>
    </main>
  `,
})
export class DemoLoginComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  async ngOnInit(): Promise<void> {
    const activeToken = localStorage.getItem('token');
    const activeEmail = (localStorage.getItem('mail') || '').toLowerCase();
    if (activeToken && !this.auth.isTokenExpired() && activeEmail === environment.demo.email.toLowerCase()) {
      await this.router.navigateByUrl('/dashboard');
      return;
    }

    if (activeToken && !this.auth.isTokenExpired()) await this.auth.logout();
    localStorage.removeItem('company');
    localStorage.removeItem('branch');
    await this.router.navigate(['/login'], { queryParams: { demo: '1' }, replaceUrl: true });
  }
}
