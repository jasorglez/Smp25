import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confcatalogos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center" style="min-height: 300px;">
      <i class="bi bi-boxes text-secondary" style="font-size: 3rem;"></i>
      <h4 class="mt-3 text-secondary">En construcción</h4>
      <p class="text-muted">Este módulo estará disponible próximamente.</p>
    </div>
  `
})
export class ConfcatalogosComponent {}
