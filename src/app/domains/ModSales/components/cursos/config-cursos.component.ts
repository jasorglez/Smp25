import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-config-cursos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card border-primary shadow-sm mt-2" style="max-width:640px">
      <div class="card-header bg-primary text-white py-2 d-flex align-items-center gap-2">
        <i class="bi bi-gear-fill"></i>
        <span class="fw-semibold">Configuración de Cursos</span>
      </div>
      <div class="card-body">

        <div class="alert alert-info small py-2">
          <i class="bi bi-info-circle me-1"></i>
          La configuración de Telegram (Chat ID) se define <strong>por curso</strong> al crear o editar cada uno
          en la pestaña <strong>Mis Cursos</strong>.
        </div>

        <h6 class="fw-semibold mt-3 mb-2">URL pública de registro</h6>
        <p class="text-muted small mb-1">
          Cuando creas un curso con un slug, la URL para compartir por WhatsApp/Telegram es:
        </p>
        <div class="input-group input-group-sm mb-3">
          <span class="input-group-text bg-light text-muted">{{ baseUrl }}</span>
          <span class="input-group-text fw-bold text-primary">?c=</span>
          <input class="form-control bg-light" readonly value="[slug-del-curso]">
        </div>
        <p class="text-muted small">
          El slug lo defines tú al crear el curso. Ejemplo: <code>gemini-ene2026</code>
          generaría <code>{{ baseUrl }}?c=gemini-ene2026</code>
        </p>

        <hr>

        <h6 class="fw-semibold mb-2">Estado de servicios</h6>
        <div class="d-flex flex-column gap-2">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-envelope-check-fill text-success"></i>
            <span class="small">Correo de confirmación al alumno — vía Firebase Extension <code>mail</code></span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-telegram text-primary"></i>
            <span class="small">Notificación Telegram al admin — configurado por curso (Chat ID)</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-database-fill text-info"></i>
            <span class="small">Registros almacenados en Firebase Firestore — colección <code>cursos/&#123;id&#125;/registros</code></span>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class ConfigCursosComponent {
  get baseUrl() {
    return `${window.location.origin}/registrocursos`;
  }
}
