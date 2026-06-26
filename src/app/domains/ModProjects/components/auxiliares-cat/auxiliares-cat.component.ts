import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auxiliares-cat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container-fluid mt-3">
      <div class="card">
        <div class="card-header">
          <h5 class="mb-0"><i class="bi bi-layers me-2"></i>Auxiliares</h5>
        </div>
        <div class="card-body text-muted">
          Módulo de Auxiliares — en construcción.
        </div>
      </div>
    </div>
  `,
})
export class AuxiliaresCatComponent {}
