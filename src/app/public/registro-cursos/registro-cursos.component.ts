import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CursosService, Curso, COMO_SE_ENTERO_OPCIONES, EXPERIENCIA_OPCIONES } from 'app/services/cursos.service';
import { Timestamp } from '@angular/fire/firestore';

type Estado = 'cargando' | 'no-encontrado' | 'lleno' | 'formulario' | 'enviado' | 'duplicado' | 'error';

@Component({
  selector: 'app-registro-cursos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rc-wrap">
      <div class="rc-box">

        <!-- CARGANDO -->
        <div *ngIf="estado === 'cargando'" class="rc-state">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <span class="ms-2 small text-muted">Cargando...</span>
        </div>

        <!-- NO ENCONTRADO -->
        <div *ngIf="estado === 'no-encontrado'" class="rc-state">
          <i class="bi bi-exclamation-circle text-warning fs-3"></i>
          <p class="mt-2 mb-0 small">Curso no disponible o enlace incorrecto.</p>
        </div>

        <!-- LLENO -->
        <div *ngIf="estado === 'lleno'" class="rc-state">
          <i class="bi bi-people text-danger fs-3"></i>
          <p class="mt-2 mb-0"><strong>{{ curso?.nombre }}</strong></p>
          <p class="small text-muted mb-0">Cupo completo. Escríbenos para lista de espera.</p>
        </div>

        <!-- DUPLICADO -->
        <div *ngIf="estado === 'duplicado'" class="rc-state">
          <i class="bi bi-envelope-check text-warning fs-3"></i>
          <h6 class="mt-2 mb-1">Ya estás registrado</h6>
          <p class="small text-muted mb-0">
            El correo <strong>{{ form.correo }}</strong> ya tiene un registro en este curso.
          </p>
        </div>

        <!-- ENVIADO -->
        <div *ngIf="estado === 'enviado'" class="rc-state">
          <i class="bi bi-check-circle-fill text-success fs-2"></i>
          <h6 class="mt-2 mb-1">¡Registro exitoso!</h6>
          <p class="small text-muted mb-0">
            Hola <strong>{{ form.nombre }}</strong>, recibirás confirmación en <strong>{{ form.correo }}</strong>.
          </p>
          <div *ngIf="curso" class="rc-resumen mt-3">
            <div><i class="bi bi-calendar2 me-1 text-primary"></i>{{ fmtDate(curso.fechaInicio) }}
              <span *ngIf="curso.diasDuracion > 1"> al {{ fmtDate(curso.fechaFin) }}</span>
            </div>
            <div><i class="bi bi-clock me-1 text-primary"></i>{{ curso.horario }}</div>
            <div><i class="bi bi-tag me-1 text-primary"></i>
              {{ curso.esGratuito ? 'Gratuito' : ('$' + curso.precio + ' ' + curso.moneda) }}
            </div>
            <div *ngIf="curso.reunionUrl">
              <i class="bi bi-camera-video me-1 text-primary"></i>
              <a [href]="curso.reunionUrl" target="_blank" class="fw-semibold">Unirse a la reunión</a>
            </div>
          </div>
        </div>

        <!-- ERROR -->
        <div *ngIf="estado === 'error'" class="rc-state">
          <i class="bi bi-x-circle text-danger fs-3"></i>
          <p class="small mt-2 mb-2">No se pudo completar el registro.</p>
          <button class="btn btn-sm btn-outline-primary" (click)="estado = 'formulario'">Reintentar</button>
        </div>

        <!-- FORMULARIO -->
        <ng-container *ngIf="estado === 'formulario' && curso">

          <!-- Header -->
          <div class="rc-header">
            <img *ngIf="curso.logoUrl"  [src]="curso.logoUrl"  class="rc-logo">
            <div class="rc-header-info">
              <div class="rc-subtitulo">Curso de Inteligencia Artificial</div>
              <div class="rc-titulo">{{ curso.nombre }}</div>
            </div>
            <img *ngIf="curso.logo2Url" [src]="curso.logo2Url" class="rc-logo ms-auto">
          </div>

          <!-- Datos del curso -->
          <div class="rc-datos">
            <span><i class="bi bi-calendar2 me-1"></i>{{ fmtDate(curso.fechaInicio) }}
              <ng-container *ngIf="curso.diasDuracion > 1"> — {{ fmtDate(curso.fechaFin) }}</ng-container>
            </span>
            <span><i class="bi bi-clock me-1"></i>{{ curso.horario }}</span>
            <span><i class="bi bi-hourglass-split me-1"></i>{{ curso.diasDuracion }} día(s)</span>
            <span [class.text-success]="curso.esGratuito" [class.fw-bold]="curso.esGratuito">
              <i class="bi bi-tag me-1"></i>
              {{ curso.esGratuito ? 'GRATUITO' : ('$' + curso.precio + ' ' + curso.moneda) }}
            </span>
            <span *ngIf="curso.instructor"><i class="bi bi-person-badge me-1"></i>{{ curso.instructor }}</span>
            <span class="text-muted"><i class="bi bi-people me-1"></i>{{ curso.cupoMax - curso.cupoUsado }} lugar(es)</span>
          </div>

          <p *ngIf="curso.descripcion" class="rc-desc">{{ curso.descripcion }}</p>

          <!-- Form -->
          <div class="rc-form">
            <div class="row g-2">

              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nombre completo <span class="text-danger">*</span></label>
                <input class="form-control form-control-sm" [(ngModel)]="form.nombre"
                       placeholder="Tu nombre completo"
                       [class.is-invalid]="submitted && !form.nombre">
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Correo <span class="text-danger">*</span></label>
                <input type="email" class="form-control form-control-sm" [(ngModel)]="form.correo"
                       placeholder="correo@ejemplo.com"
                       [class.is-invalid]="submitted && !form.correo">
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Teléfono <span class="text-danger">*</span></label>
                <input class="form-control form-control-sm" [(ngModel)]="form.telefono"
                       placeholder="10 dígitos"
                       [class.is-invalid]="submitted && !form.telefono">
              </div>

              <!-- Cómo se enteró -->
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">¿Cómo te enteraste? <span class="text-danger">*</span></label>
                <div class="d-flex flex-wrap gap-1 mb-1">
                  <button *ngFor="let op of opcionesEntero" type="button"
                          class="btn btn-xs btn-sm"
                          [class.btn-primary]="form.comoSeEnteroOpcion === op"
                          [class.btn-outline-secondary]="form.comoSeEnteroOpcion !== op"
                          (click)="form.comoSeEnteroOpcion = op">{{ op }}</button>
                </div>
                <input *ngIf="form.comoSeEnteroOpcion"
                       class="form-control form-control-sm" [(ngModel)]="form.comoSeEnteroTexto"
                       placeholder="Cuéntanos más (opcional)">
                <div *ngIf="submitted && !form.comoSeEnteroOpcion" class="text-danger" style="font-size:12px">Selecciona una opción</div>
              </div>

              <!-- Experiencia -->
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nivel de experiencia en IA <span class="text-danger">*</span></label>
                <div class="d-flex flex-wrap gap-1 mb-1">
                  <button *ngFor="let op of opcionesExperiencia" type="button"
                          class="btn btn-xs btn-sm"
                          [class.btn-primary]="form.experienciaOpcion === op"
                          [class.btn-outline-secondary]="form.experienciaOpcion !== op"
                          (click)="form.experienciaOpcion = op">{{ op }}</button>
                </div>
                <input *ngIf="form.experienciaOpcion"
                       class="form-control form-control-sm" [(ngModel)]="form.experienciaTexto"
                       placeholder="Descríbela brevemente (opcional)">
                <div *ngIf="submitted && !form.experienciaOpcion" class="text-danger" style="font-size:12px">Selecciona una opción</div>
              </div>

              <div class="col-12 mt-1">
                <button class="btn btn-primary w-100" (click)="enviar()" [disabled]="enviando">
                  <span *ngIf="enviando" class="spinner-border spinner-border-sm me-1"></span>
                  <i *ngIf="!enviando" class="bi bi-send me-1"></i>
                  {{ enviando ? 'Registrando...' : 'Confirmar registro' }}
                </button>
                <p class="text-muted text-center mt-2 mb-0" style="font-size:11px">
                  <i class="bi bi-shield-check me-1"></i>Tu información es privada.
                </p>
              </div>

            </div>
          </div>

        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .rc-wrap {
      min-height: 100vh;
      background: #f0f4f8;
      display: flex; justify-content: center; align-items: flex-start;
      padding: 24px 12px;
    }
    .rc-box {
      width: 100%; max-width: 560px;
      background: #fff; border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,.1);
      overflow: hidden;
    }
    .rc-state { text-align: center; padding: 40px 20px; }
    .rc-header {
      background: #003366; color: #fff;
      padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    .rc-logo { height: 44px; object-fit: contain; }
    .rc-subtitulo { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: .75; }
    .rc-titulo { font-size: 1.05rem; font-weight: 700; }
    .rc-datos {
      background: #1a5a9a; color: #c8dff5;
      padding: 6px 16px;
      display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px;
    }
    .rc-desc { padding: 10px 16px 0; font-size: 13px; color: #555; margin: 0; }
    .rc-form { padding: 14px 16px 18px; }
    .rc-resumen { background: #f0f8ff; border-radius: 6px; padding: 10px 14px; font-size: 13px; text-align: left; }
    .rc-resumen > div { padding: 2px 0; }
  `],
})
export class RegistroCursosComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(CursosService);

  estado: Estado = 'cargando';
  curso: Curso | null = null;
  enviando  = false;
  submitted = false;

  opcionesEntero      = COMO_SE_ENTERO_OPCIONES;
  opcionesExperiencia = EXPERIENCIA_OPCIONES;

  form = {
    nombre: '', correo: '', telefono: '',
    comoSeEnteroOpcion: '', comoSeEnteroTexto: '',
    experienciaOpcion: '', experienciaTexto: '',
  };

  ngOnInit() {
    const slug = this.route.snapshot.queryParamMap.get('c') ?? '';
    if (!slug) { this.estado = 'no-encontrado'; return; }
    this.cargarCurso(slug);
  }

  async cargarCurso(slug: string) {
    try {
      const curso = await this.svc.getCursoBySlug(slug);
      if (!curso || !curso.activo) { this.estado = 'no-encontrado'; return; }
      if (curso.cupoUsado >= curso.cupoMax) { this.estado = 'lleno'; this.curso = curso; return; }
      this.curso  = curso;
      this.estado = 'formulario';
    } catch { this.estado = 'no-encontrado'; }
  }

  async enviar() {
    this.submitted = true;
    if (!this.form.nombre || !this.form.correo || !this.form.telefono ||
        !this.form.comoSeEnteroOpcion || !this.form.experienciaOpcion) return;
    this.enviando = true;
    try {
      const duplicado = await this.svc.correoYaRegistrado(this.curso!.id!, this.form.correo);
      if (duplicado) { this.estado = 'duplicado'; this.enviando = false; return; }
      await this.svc.crearRegistro(this.curso!.id!, { ...this.form, idCompany: this.curso!.idCompany });
      await this.svc.enviarConfirmacionAlumno(this.curso!, this.form);
      this.svc.notificarAdminTelegram(this.curso!.telegramChatId, this.curso!, this.form);
      this.estado = 'enviado';
    } catch { this.estado = 'error'; }
    finally   { this.enviando = false; }
  }

  fmtDate(ts: Timestamp): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts as any);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
