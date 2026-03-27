import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CursosService, Curso, COMO_SE_ENTERO_OPCIONES, EXPERIENCIA_OPCIONES } from 'app/services/cursos.service';
import { Timestamp } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

type Estado = 'cargando' | 'no-encontrado' | 'lleno' | 'formulario' | 'enviado' | 'duplicado' | 'error';

/** Cursos de pago: 1 = maqueta pago (primero), 2 = formulario de registro. Gratuitos: solo paso 1 = formulario. */
type PasoRegistro = 1 | 2;

@Component({
  selector: 'app-registro-cursos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rc-wrap">
      <div
        class="rc-box"
        [class.rc-box--narrow]="esCursoDePago() && pasoRegistro === 1"
        [class.rc-box--wide]="!esCursoDePago() || pasoRegistro === 2"
      >
        <!-- CARGANDO -->
        <div *ngIf="estado === 'cargando'" class="rc-state rc-reveal">
          <div class="rc-loader" aria-hidden="true"></div>
          <span class="rc-state-text">Cargando…</span>
        </div>

        <!-- NO ENCONTRADO -->
        <div *ngIf="estado === 'no-encontrado'" class="rc-state rc-reveal">
          <div class="rc-icon rc-icon--warn"><i class="bi bi-link-45deg"></i></div>
          <p class="rc-state-title">Enlace no válido</p>
          <p class="rc-state-sub">El curso no está disponible o el enlace es incorrecto.</p>
        </div>

        <!-- LLENO -->
        <div *ngIf="estado === 'lleno'" class="rc-state rc-reveal">
          <div class="rc-icon rc-icon--muted"><i class="bi bi-people"></i></div>
          <p class="rc-state-title">{{ curso?.nombre }}</p>
          <p class="rc-state-sub">Cupo completo. Contáctanos para lista de espera.</p>
        </div>

        <!-- DUPLICADO -->
        <div *ngIf="estado === 'duplicado'" class="rc-state rc-reveal">
          <div class="rc-icon rc-icon--warn"><i class="bi bi-envelope-check"></i></div>
          <p class="rc-state-title">Ya estás registrado</p>
          <p class="rc-state-sub">El correo <strong>{{ form.correo }}</strong> ya tiene un registro en este curso.</p>
        </div>

        <!-- ENVIADO -->
        <div *ngIf="estado === 'enviado'" class="rc-state rc-reveal">
          <div class="rc-success-ring">
            <i class="bi bi-check-lg"></i>
          </div>
          <p class="rc-state-title">¡Listo!</p>
          <p class="rc-state-sub">
            Hola <strong>{{ form.nombre }}</strong>, enviamos confirmación a <strong>{{ form.correo }}</strong>.
          </p>
          <div *ngIf="curso" class="rc-resumen rc-reveal-delay">
            <div class="rc-resumen-row">
              <i class="bi bi-calendar3"></i>
              <span>{{ fmtDate(curso.fechaInicio) }}<ng-container *ngIf="curso.diasDuracion > 1"> — {{ fmtDate(curso.fechaFin) }}</ng-container></span>
            </div>
            <div class="rc-resumen-row"><i class="bi bi-clock"></i><span>{{ curso.horario }}</span></div>
            <div class="rc-resumen-row"><i class="bi bi-tag"></i><span>{{ curso.esGratuito ? 'Gratuito' : precioFormateado() }}</span></div>
            <a *ngIf="curso.reunionUrl" class="rc-resumen-link" [href]="curso.reunionUrl" target="_blank" rel="noopener">
              <i class="bi bi-camera-video"></i> Unirse a la reunión
            </a>
          </div>
        </div>

        <!-- ERROR -->
        <div *ngIf="estado === 'error'" class="rc-state rc-reveal">
          <div class="rc-icon rc-icon--danger"><i class="bi bi-exclamation-triangle"></i></div>
          <p class="rc-state-title">Algo salió mal</p>
          <p class="rc-state-sub">No pudimos completar el registro.</p>
          <button type="button" class="rc-btn rc-btn--ghost" (click)="reintentar()">Reintentar</button>
        </div>

        <!-- Flujo principal -->
        <ng-container *ngIf="estado === 'formulario' && curso">
          <header class="rc-hero rc-reveal">
            <div class="rc-hero-logos">
              <img *ngIf="curso.logoUrl" [src]="curso.logoUrl" class="rc-logo" alt="">
              <img *ngIf="curso.logo2Url" [src]="curso.logo2Url" class="rc-logo rc-logo--end" alt="">
            </div>
            <p class="rc-hero-kicker">Inteligencia artificial</p>
            <h1 class="rc-hero-title">{{ curso.nombre }}</h1>
          </header>

          <div class="rc-meta rc-reveal-delay-sm">
            <div class="rc-meta-scroll">
              <span class="rc-meta-pill"><i class="bi bi-calendar2"></i>{{ fmtDate(curso.fechaInicio) }}<ng-container *ngIf="curso.diasDuracion > 1"> — {{ fmtDate(curso.fechaFin) }}</ng-container></span>
              <span class="rc-meta-pill"><i class="bi bi-clock"></i>{{ curso.horario }}</span>
              <span class="rc-meta-pill"><i class="bi bi-hourglass-split"></i>{{ curso.diasDuracion }} día(s)</span>
              <span class="rc-meta-pill" [class.rc-meta-pill--accent]="curso.esGratuito">
                <i class="bi bi-tag"></i>{{ curso.esGratuito ? 'Gratis' : precioFormateado() }}
              </span>
              <span class="rc-meta-pill" *ngIf="curso.instructor"><i class="bi bi-person"></i>{{ curso.instructor }}</span>
              <span class="rc-meta-pill rc-meta-pill--soft"><i class="bi bi-people"></i>{{ curso.cupoMax - curso.cupoUsado }} lugares</span>
            </div>
          </div>

          <p *ngIf="curso.descripcion" class="rc-desc rc-reveal-delay">{{ curso.descripcion }}</p>

          <!-- PASO 1 pago -->
          <section *ngIf="esCursoDePago() && pasoRegistro === 1" class="rc-panel rc-panel-enter">
            <div class="rc-step-label"><span class="rc-step-dot">1</span> Pago</div>

            <div class="rc-mp-top">
              <span class="rc-mp-pill">Cobro real</span>
              <span class="rc-mp-name">Mercado Pago</span>
            </div>

            <div class="rc-mp-card">
              <div class="rc-mp-card-inner">
                <div class="rc-mp-summary">
                  <p class="rc-mp-note">
                    <i class="bi bi-lock"></i>
                    Cobro en esta misma página con Mercado Pago.
                  </p>
                  <div class="rc-mp-totalbox">
                    <span class="rc-mp-total-label">Total</span>
                    <span class="rc-mp-total-val">{{ precioFormateado() }}</span>
                  </div>
                </div>
                <div class="rc-mp-realpay">
                  <div id="rc-mp-payment-brick"></div>
                  <p class="rc-mp-privacy-footnote" style="margin-top: 0.6rem; font-size: 0.8rem; color: var(--rc-muted);">
                    Tus datos de pago se procesan de forma segura con Mercado Pago.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Formulario -->
          <section *ngIf="!esCursoDePago() || pasoRegistro === 2" class="rc-panel rc-form-panel rc-panel-enter">
            <div *ngIf="esCursoDePago()" class="rc-step-row">
              <div class="rc-step-label"><span class="rc-step-dot">2</span> Tus datos</div>
              <button type="button" class="rc-link-back" (click)="volverAlPago()">
                <i class="bi bi-arrow-left"></i> Volver al pago
              </button>
            </div>

            <div class="rc-fields">
              <div class="rc-field">
                <label class="rc-label">Nombre completo <span class="rc-req">*</span></label>
                <input class="rc-input" [(ngModel)]="form.nombre" placeholder="Tu nombre" [class.rc-input--invalid]="submitted && !form.nombre">
              </div>

              <div class="rc-field rc-field--half">
                <label class="rc-label">Correo <span class="rc-req">*</span></label>
                <input class="rc-input" type="email" [(ngModel)]="form.correo" placeholder="correo@ejemplo.com" [class.rc-input--invalid]="submitted && !form.correo">
              </div>
              <div class="rc-field rc-field--half">
                <label class="rc-label">Teléfono <span class="rc-req">*</span></label>
                <input class="rc-input" [(ngModel)]="form.telefono" placeholder="10 dígitos" [class.rc-input--invalid]="submitted && !form.telefono">
              </div>

              <div class="rc-field-split">
                <div class="rc-field">
                  <label class="rc-label">¿Cómo te enteraste? <span class="rc-req">*</span></label>
                  <div class="rc-chips">
                    <button *ngFor="let op of opcionesEntero" type="button" class="rc-chip" [class.rc-chip--on]="form.comoSeEnteroOpcion === op" (click)="form.comoSeEnteroOpcion = op">{{ op }}</button>
                  </div>
                  <input *ngIf="form.comoSeEnteroOpcion" class="rc-input rc-input--mt" [(ngModel)]="form.comoSeEnteroTexto" placeholder="Detalle (opcional)">
                  <p *ngIf="submitted && !form.comoSeEnteroOpcion" class="rc-hint rc-hint--err">Elige una opción</p>
                </div>

                <div class="rc-field">
                  <label class="rc-label">Experiencia en IA <span class="rc-req">*</span></label>
                  <div class="rc-chips">
                    <button *ngFor="let op of opcionesExperiencia" type="button" class="rc-chip" [class.rc-chip--on]="form.experienciaOpcion === op" (click)="form.experienciaOpcion = op">{{ op }}</button>
                  </div>
                  <input *ngIf="form.experienciaOpcion" class="rc-input rc-input--mt" [(ngModel)]="form.experienciaTexto" placeholder="Cuéntanos más (opcional)">
                  <p *ngIf="submitted && !form.experienciaOpcion" class="rc-hint rc-hint--err">Elige una opción</p>
                </div>
              </div>

              <button type="button" class="rc-btn rc-btn--primary" (click)="confirmarRegistro()" [disabled]="enviando">
                <span *ngIf="enviando" class="rc-spinner rc-spinner--light"></span>
                <i *ngIf="!enviando" class="bi bi-send-fill"></i>
                <span>{{ enviando ? 'Guardando…' : 'Confirmar registro' }}</span>
              </button>
              <p class="rc-privacy"><i class="bi bi-shield-lock"></i> Tu información es privada</p>
            </div>
          </section>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --rc-bg: #eef1f6;
      --rc-card: #ffffff;
      --rc-text: #0f172a;
      --rc-muted: #64748b;
      --rc-line: rgba(15, 23, 42, 0.08);
      --rc-accent: #2563eb;
      --rc-accent-soft: rgba(37, 99, 235, 0.12);
      --rc-mp: #009ee3;
      --rc-success: #059669;
      --rc-radius: 16px;
      --rc-font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      display: block;
      font-family: var(--rc-font);
      color: var(--rc-text);
    }

    @keyframes rc-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes rc-scale-in {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes rc-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes rc-pulse-soft {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .rc-reveal { animation: rc-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .rc-reveal-delay { animation: rc-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both; }
    .rc-reveal-delay-sm { animation: rc-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both; }
    .rc-panel-enter { animation: rc-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }

    @media (prefers-reduced-motion: reduce) {
      .rc-reveal, .rc-reveal-delay, .rc-reveal-delay-sm, .rc-panel-enter {
        animation: none;
      }
    }

    .rc-wrap {
      min-height: 100vh;
      background: radial-gradient(1200px 600px at 50% -20%, #dbeafe 0%, transparent 55%), var(--rc-bg);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: clamp(16px, 4vw, 32px) clamp(12px, 3vw, 20px);
      box-sizing: border-box;
    }

    .rc-box {
      width: 100%;
      max-width: min(680px, 100%);
      background: var(--rc-card);
      border-radius: var(--rc-radius);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 40px rgba(15, 23, 42, 0.08);
      border: 1px solid var(--rc-line);
      overflow: hidden;
      transition: box-shadow 0.3s ease, max-width 0.35s ease;
    }
    .rc-box--narrow { max-width: min(980px, 100%); }
    .rc-box--wide { max-width: min(960px, 100%); }

    .rc-state {
      text-align: center;
      padding: clamp(2rem, 6vw, 3rem) clamp(1.25rem, 4vw, 1.75rem);
    }
    .rc-state-text { font-size: 0.9rem; color: var(--rc-muted); margin-top: 0.75rem; display: block; }
    .rc-state-title { font-size: 1.15rem; font-weight: 600; margin: 0.5rem 0 0.35rem; letter-spacing: -0.02em; }
    .rc-state-sub { font-size: 0.875rem; color: var(--rc-muted); margin: 0; line-height: 1.5; }

    .rc-loader {
      width: 36px; height: 36px;
      margin: 0 auto;
      border: 3px solid var(--rc-accent-soft);
      border-top-color: var(--rc-accent);
      border-radius: 50%;
      animation: rc-spin 0.7s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .rc-loader { animation: rc-pulse-soft 1.2s ease infinite; border-top-color: var(--rc-accent-soft); }
    }

    .rc-icon {
      width: 56px; height: 56px; margin: 0 auto;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 1.35rem;
    }
    .rc-icon--warn { background: #fef3c7; color: #b45309; }
    .rc-icon--muted { background: #f1f5f9; color: var(--rc-muted); }
    .rc-icon--danger { background: #fee2e2; color: #b91c1c; }

    .rc-success-ring {
      width: 72px; height: 72px; margin: 0 auto;
      border-radius: 50%;
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      color: var(--rc-success);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.75rem;
      animation: rc-scale-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .rc-success-ring { animation: none; }
    }

    .rc-resumen {
      margin-top: 1.25rem;
      text-align: left;
      background: #f8fafc;
      border-radius: 12px;
      padding: 1rem 1.1rem;
      border: 1px solid var(--rc-line);
      font-size: 0.875rem;
    }
    .rc-resumen-row {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.35rem 0; color: var(--rc-text);
    }
    .rc-resumen-row i { color: var(--rc-accent); margin-top: 2px; flex-shrink: 0; }
    .rc-resumen-link {
      display: inline-flex; align-items: center; gap: 0.35rem;
      margin-top: 0.5rem; font-weight: 600; color: var(--rc-accent); text-decoration: none;
    }
    .rc-resumen-link:hover { text-decoration: underline; }

    .rc-hero {
      padding: clamp(1.25rem, 4vw, 1.75rem) clamp(1.1rem, 3vw, 1.5rem) 1rem;
      background: linear-gradient(145deg, #1e3a5f 0%, #0f172a 100%);
      color: #fff;
    }
    .rc-hero-logos {
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.75rem; margin-bottom: 0.75rem;
    }
    .rc-logo { height: clamp(36px, 8vw, 44px); object-fit: contain; }
    .rc-logo--end { margin-left: auto; }
    .rc-hero-kicker {
      font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em;
      opacity: 0.72; margin: 0 0 0.35rem;
    }
    .rc-hero-title {
      font-size: clamp(1.15rem, 4vw, 1.45rem);
      font-weight: 700; margin: 0; line-height: 1.25; letter-spacing: -0.02em;
    }

    .rc-meta {
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--rc-line);
      background: #fafbfc;
    }
    .rc-meta-scroll {
      display: flex; flex-wrap: nowrap;
      gap: 0.5rem;
      padding: 0 clamp(0.75rem, 2vw, 1rem);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
    }
    .rc-meta-pill {
      flex: 0 0 auto;
      display: inline-flex; align-items: center; gap: 0.35rem;
      font-size: 0.72rem; color: var(--rc-muted);
      background: #fff;
      border: 1px solid var(--rc-line);
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      white-space: nowrap;
      transition: border-color 0.2s ease, color 0.2s ease;
    }
    .rc-meta-pill i { font-size: 0.85rem; opacity: 0.85; }
    .rc-meta-pill--accent { border-color: #bbf7d0; color: var(--rc-success); background: #f0fdf4; }
    .rc-meta-pill--soft { background: #f1f5f9; }

    @media (min-width: 640px) {
      .rc-meta-scroll { flex-wrap: wrap; overflow-x: visible; justify-content: center; }
    }

    .rc-desc {
      margin: 0;
      padding: 1rem clamp(1rem, 3vw, 1.25rem) 0;
      font-size: 0.875rem; color: var(--rc-muted); line-height: 1.55;
    }

    .rc-panel { padding: 0 0 1.25rem; }

    .rc-step-label {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--rc-muted);
      padding: 0.75rem clamp(1rem, 3vw, 1.25rem) 0.5rem;
    }
    .rc-step-dot {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--rc-accent); color: #fff;
      font-size: 0.7rem; display: inline-flex; align-items: center; justify-content: center;
    }
    .rc-step-row {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.5rem;
      padding: 0.5rem clamp(1rem, 3vw, 1.25rem) 0;
    }
    .rc-step-row .rc-step-label { padding: 0; }

    .rc-link-back {
      border: none; background: none; color: var(--rc-accent);
      font-size: 0.8rem; font-weight: 500; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.25rem 0;
      transition: opacity 0.2s ease;
    }
    .rc-link-back:hover { opacity: 0.8; }

    .rc-mp-top {
      display: flex; align-items: center; justify-content: center; gap: 0.75rem;
      padding: 0.65rem 1rem;
      background: var(--rc-mp);
      color: #fff;
    }
    .rc-mp-pill {
      font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em;
      background: rgba(255,255,255,.22);
      padding: 0.2rem 0.5rem; border-radius: 4px;
    }
    .rc-mp-name { font-weight: 600; font-size: 0.95rem; letter-spacing: -0.02em; }

    .rc-mp-card {
      margin: 0 clamp(0.75rem, 2.5vw, 1.25rem);
      margin-top: 0.75rem;
      margin-bottom: 0.5rem;
      padding: 1.1rem;
      border: 1px solid var(--rc-line);
      border-radius: 12px;
      background: #fafbfc;
    }
    .rc-mp-card-inner {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .rc-mp-layout {
      display: grid;
      gap: 1rem;
      align-items: start;
    }
    @media (min-width: 992px) {
      .rc-mp-layout {
        grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
        gap: 1.25rem 1.5rem;
      }
    }
    .rc-mp-preview-col {
      background: #fff;
      border: 1px solid var(--rc-line);
      border-radius: 10px;
      padding: 0.85rem;
    }
    .rc-mp-preview-title {
      margin: 0 0 0.6rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--rc-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .rc-mp-preview-note {
      margin: 0.75rem 0 0;
    }
    .rc-mp-realpay {
      margin-top: 0.2rem;
      min-width: 0;
    }
    @media (min-width: 768px) {
      .rc-mp-card-inner {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        align-items: stretch;
      }
      .rc-mp-summary {
        padding-right: 0;
        border-right: none;
      }
      .rc-mp-totalbox {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }
      .rc-mp-fields { margin-bottom: 0; }
      .rc-mp-paycol {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        min-width: 0;
      }
    }
    .rc-mp-note {
      font-size: 0.78rem; color: var(--rc-muted); margin: 0 0 1rem;
      padding: 0.65rem 0.75rem;
      background: #e0f2fe;
      border-radius: 8px;
      border: 1px solid #bae6fd;
      display: flex; gap: 0.4rem; align-items: flex-start;
      line-height: 1.45;
    }
    .rc-mp-note i { flex-shrink: 0; color: #0284c7; margin-top: 2px; }

    .rc-mp-totalbox {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 0.75rem 0; margin-bottom: 1rem;
      border-bottom: 1px dashed var(--rc-line);
    }
    @media (max-width: 767px) {
      .rc-mp-summary, .rc-mp-paycol { min-width: 0; }
    }
    .rc-mp-total-label { font-size: 0.8rem; color: var(--rc-muted); }
    .rc-mp-total-val { font-size: 1.35rem; font-weight: 700; color: var(--rc-mp); letter-spacing: -0.03em; }

    .rc-mp-fields { margin-bottom: 0; min-width: 0; }
    .rc-mp-payrow {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 1.25rem;
    }
    @media (min-width: 640px) {
      .rc-mp-payrow {
        display: grid;
        grid-template-columns: minmax(0, 300px) minmax(0, 300px);
        align-items: start;
        gap: 1.25rem 1.5rem;
        justify-content: center;
      }
      .rc-mp-fields { width: 100%; }
      .rc-cc-scene { margin: 0; }
      .rc-mp-fields { max-width: 300px; }
    }
    .rc-label--mt { margin-top: 0.65rem; }
    .rc-mp-field-hint {
      font-size: 0.72rem; color: #94a3b8; margin: 0.3rem 0 0;
    }
    .rc-mp-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-top: 0.5rem;
    }

    /* Tarjeta 3D (demo) */
    .rc-cc-scene {
      perspective: 1100px;
      width: 100%;
      max-width: 300px;
      flex-shrink: 0;
    }
    .rc-cc-pivot {
      position: relative;
      width: 100%;
      padding-bottom: 62.5%;
      transform-style: preserve-3d;
      transition: transform 0.65s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .rc-cc-scene--flip .rc-cc-pivot {
      transform: rotateY(180deg);
    }
    @media (prefers-reduced-motion: reduce) {
      .rc-cc-pivot { transition: none; }
    }
    .rc-cc-face {
      position: absolute;
      inset: 0;
      border-radius: 14px;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .rc-cc-front {
      background: linear-gradient(145deg, #334155 0%, #1e293b 45%, #0f172a 100%);
      color: #f8fafc;
      padding: 1rem 1rem 0.9rem;
      display: flex;
      flex-direction: column;
    }
    .rc-cc-waves {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 120% 80% at 100% -20%, rgba(56, 189, 248, 0.35), transparent 45%),
        radial-gradient(ellipse 90% 70% at 0% 110%, rgba(99, 102, 241, 0.25), transparent 50%);
      pointer-events: none;
    }
    .rc-cc-waves--back {
      opacity: 0.85;
      background:
        radial-gradient(ellipse 100% 60% at 80% 0%, rgba(56, 189, 248, 0.2), transparent 50%),
        radial-gradient(ellipse 80% 50% at 10% 100%, rgba(99, 102, 241, 0.18), transparent 45%);
    }
    .rc-cc-chip {
      position: relative;
      width: 40px;
      height: 30px;
      border-radius: 6px;
      background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 50%, #cbd5e1 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
      margin-bottom: 1.75rem;
    }
    .rc-cc-contactless {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid rgba(248, 250, 252, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      color: rgba(248, 250, 252, 0.75);
      transform: rotate(90deg);
    }
    .rc-cc-contactless i { line-height: 1; }
    .rc-cc-number {
      position: relative;
      font-family: ui-monospace, 'Cousine', monospace;
      font-size: clamp(0.85rem, 2.8vw, 1rem);
      letter-spacing: 0.12em;
      margin-top: auto;
      margin-bottom: 0.65rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    }
    .rc-cc-bottom {
      position: relative;
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: end;
      gap: 0.5rem 0.65rem;
      font-size: 0.6rem;
    }
    .rc-cc-lab {
      display: block;
      opacity: 0.55;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.15rem;
    }
    .rc-cc-val {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .rc-cc-holder .rc-cc-val {
      font-size: 0.68rem;
      letter-spacing: 0.06em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .rc-cc-brand {
      position: relative;
      width: 42px;
      height: 26px;
      justify-self: end;
    }
    .rc-cc-brand-circle {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      bottom: 0;
    }
    .rc-cc-brand-circle--r {
      right: 0;
      background: #ef4444;
      opacity: 0.95;
    }
    .rc-cc-brand-circle--o {
      right: 14px;
      background: #f97316;
      opacity: 0.95;
    }
    .rc-cc-back {
      transform: rotateY(180deg);
      background: linear-gradient(145deg, #3b4a63 0%, #1e293b 100%);
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .rc-cc-stripe {
      height: 22%;
      min-height: 2.25rem;
      background: #0a0a0a;
      margin-top: 12%;
    }
    .rc-cc-sign {
      position: relative;
      margin: 0.85rem 1rem 0.5rem;
      background: repeating-linear-gradient(
        0deg,
        #f1f5f9,
        #f1f5f9 2px,
        #e2e8f0 2px,
        #e2e8f0 4px
      );
      border-radius: 6px;
      min-height: 2.35rem;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 0.6rem;
    }
    .rc-cc-sign-lines { flex: 1; min-height: 1.5rem; }
    .rc-cc-cvv-box {
      background: #fff;
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      font-weight: 700;
      color: #0f172a;
      min-width: 2.25rem;
      text-align: center;
    }
    .rc-cc-back-hint {
      position: relative;
      margin: 0.35rem 1rem 0;
      font-size: 0.58rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.65;
      color: #e2e8f0;
    }

    .rc-form-panel { padding-bottom: clamp(1.25rem, 3vw, 1.75rem); }

    .rc-fields {
      padding: 0.25rem clamp(1rem, 3vw, 1.25rem) 0;
      display: flex; flex-direction: column; gap: 1rem;
    }

    .rc-field { animation: rc-fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .rc-fields > .rc-field:nth-child(1) { animation-delay: 0.02s; }
    .rc-fields > .rc-field:nth-child(2) { animation-delay: 0.05s; }
    .rc-fields > .rc-field:nth-child(3) { animation-delay: 0.08s; }
    .rc-field-split .rc-field:nth-child(1) { animation-delay: 0.1s; }
    .rc-field-split .rc-field:nth-child(2) { animation-delay: 0.11s; }

    .rc-field-split {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
    }
    @media (min-width: 576px) {
      .rc-field-split {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem 1rem;
        align-items: start;
      }
    }
    .rc-field-split .rc-field { min-width: 0; }
    @media (prefers-reduced-motion: reduce) {
      .rc-field { animation: none; }
    }

    @media (min-width: 576px) {
      .rc-fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem 1rem;
      }
      .rc-field--half { grid-column: span 1; }
      .rc-field:not(.rc-field--half) { grid-column: 1 / -1; }
      .rc-btn--primary { grid-column: 1 / -1; }
      .rc-privacy { grid-column: 1 / -1; }
    }

    .rc-label {
      display: block; font-size: 0.72rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--rc-muted); margin-bottom: 0.35rem;
    }
    .rc-label-muted { font-weight: 400; text-transform: none; letter-spacing: 0; color: #94a3b8; }
    .rc-req { color: #ef4444; }

    .rc-input {
      width: 100%; box-sizing: border-box;
      padding: 0.65rem 0.85rem;
      font-size: 0.9rem;
      border: 1px solid var(--rc-line);
      border-radius: 10px;
      background: #fff;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .rc-input:focus {
      outline: none;
      border-color: var(--rc-accent);
      box-shadow: 0 0 0 3px var(--rc-accent-soft);
    }
    .rc-input--invalid { border-color: #f87171; }
    .rc-input--mt { margin-top: 0.5rem; }
    .rc-input:disabled { opacity: 0.55; cursor: not-allowed; }

    .rc-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .rc-chip {
      border: 1px solid var(--rc-line);
      background: #fff;
      color: var(--rc-text);
      font-size: 0.78rem;
      padding: 0.4rem 0.75rem;
      border-radius: 999px;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    }
    .rc-chip:hover { border-color: #cbd5e1; }
    .rc-chip:active { transform: scale(0.97); }
    .rc-chip--on {
      background: var(--rc-accent);
      border-color: var(--rc-accent);
      color: #fff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }

    .rc-hint { font-size: 0.72rem; margin: 0.35rem 0 0; color: var(--rc-muted); }
    .rc-hint--err { color: #dc2626; }

    .rc-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      border: none; border-radius: 12px; font-weight: 600; font-size: 0.9rem;
      font-family: inherit; cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease;
    }
    .rc-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
    .rc-btn--primary {
      width: 100%;
      padding: 0.85rem 1rem;
      background: linear-gradient(135deg, var(--rc-accent) 0%, #1d4ed8 100%);
      color: #fff;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
      margin-top: 0.25rem;
    }
    .rc-btn--primary:hover:not(:disabled) {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }
    .rc-btn--mp {
      width: 100%;
      padding: 0.9rem 1rem;
      background: var(--rc-mp);
      color: #fff;
      box-shadow: 0 4px 16px rgba(0, 158, 227, 0.35);
    }
    .rc-btn--mp:hover:not(:disabled) {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }
    .rc-btn--ghost {
      margin-top: 0.75rem;
      padding: 0.5rem 1rem;
      background: transparent;
      color: var(--rc-accent);
      border: 1px solid var(--rc-line);
    }
    .rc-btn--ghost:hover { background: #f8fafc; }

    .rc-spinner {
      width: 1rem; height: 1rem;
      border: 2px solid rgba(255,255,255,.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: rc-spin 0.6s linear infinite;
    }
    .rc-spinner--light {
      border-color: rgba(255,255,255,.4);
      border-top-color: #fff;
    }

    .rc-privacy {
      text-align: center; font-size: 0.7rem; color: var(--rc-muted);
      margin: 0.75rem 0 0;
      display: flex; align-items: center; justify-content: center; gap: 0.35rem;
    }
  `],
})
export class RegistroCursosComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(CursosService);

  estado: Estado = 'cargando';
  curso: Curso | null = null;
  enviando  = false;
  submitted = false;
  pasoRegistro: PasoRegistro = 1;
  /** Solo para cursos de pago: true después de un pago aprobado en Mercado Pago. */
  pagoSimuladoOk = false;

  // Datos que Mercado Pago regresa en la URL de retorno.
  private mpReturnStatus: string | null = null;
  private mpReturnExternalReference: string | null = null;
  private mpReturnPaymentId: string | null = null;
  private mpExpectedIntentId: string | null = null;
  private mpBrickController: any = null;
  private mpBrickContainerId = 'rc-mp-payment-brick';
  private mpSdkLoading = false;

  /** Maqueta: datos de tarjeta solo en pantalla (no se envían). */
  mockPago = { numero: '', titular: '', vence: '', cvv: '' };
  /** Reverso visible al enfocar el CVV. */
  tarjetaVolteada = false;

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

    // Estos campos vienen del redirect de Mercado Pago.
    this.mpReturnStatus = this.route.snapshot.queryParamMap.get('status');
    this.mpReturnExternalReference = this.route.snapshot.queryParamMap.get('external_reference');
    this.mpReturnPaymentId = this.route.snapshot.queryParamMap.get('payment_id');
    this.mpExpectedIntentId = sessionStorage.getItem('mp_intent_id');

    this.cargarCurso(slug);
  }

  setTarjetaCara(cara: 'frente' | 'reverso'): void {
    this.tarjetaVolteada = cara === 'reverso';
  }

  onCvvBlur(): void {
    queueMicrotask(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el?.id === 'mockTarjetaCvv') return;
      this.tarjetaVolteada = false;
    });
  }

  onNumeroTarjetaChange(raw: string): void {
    this.mockPago.numero = (raw ?? '').replace(/\D/g, '').slice(0, 16);
  }

  numeroTarjetaMaskedInput(): string {
    const d = this.mockPago.numero;
    return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  onVenceChange(val: string): void {
    let v = (val ?? '').replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
    this.mockPago.vence = v;
  }

  onCvvChange(val: string): void {
    this.mockPago.cvv = (val ?? '').replace(/\D/g, '').slice(0, 4);
  }

  tarjetaNumeroDisplayFrente(): string {
    const d = (this.mockPago.numero || '').replace(/\D/g, '').slice(0, 16);
    const parts: string[] = [];
    for (let i = 0; i < 4; i++) {
      const seg = d.slice(i * 4, i * 4 + 4);
      if (seg.length === 0) parts.push('••••');
      else if (seg.length === 4) parts.push(seg);
      else parts.push(seg + '•'.repeat(4 - seg.length));
    }
    return parts.join(' ');
  }

  tarjetaTitularDisplay(): string {
    const t = (this.mockPago.titular || '').trim();
    if (!t) return 'TITULAR DE LA TARJETA';
    return t.toUpperCase().slice(0, 26);
  }

  tarjetaCvvDisplayReverso(): string {
    const c = (this.mockPago.cvv || '').replace(/\D/g, '');
    if (!c) return '•••';
    return c + '•'.repeat(Math.max(0, 3 - c.length));
  }

  private resetMockTarjeta(): void {
    this.mockPago = { numero: '', titular: '', vence: '', cvv: '' };
    this.tarjetaVolteada = false;
  }

  esCursoDePago(): boolean {
    return !!this.curso && !this.curso.esGratuito;
  }

  precioFormateado(): string {
    const c = this.curso;
    if (!c || c.esGratuito) return 'Gratuito';
    const m = (c.moneda ?? 'MXN').toUpperCase();
    const simbolo = m === 'USD' ? 'US$' : '$';
    return `${simbolo}${c.precio} ${m}`;
  }

  async cargarCurso(slug: string) {
    try {
      const curso = await this.svc.getCursoBySlug(slug);
      if (!curso || !curso.activo) { this.estado = 'no-encontrado'; return; }
      if (curso.cupoUsado >= curso.cupoMax) { this.estado = 'lleno'; this.curso = curso; return; }
      this.curso  = curso;
      this.pasoRegistro = 1;
      this.pagoSimuladoOk = false;
      this.resetMockTarjeta();
      this.estado = 'formulario';
      await this.aplicarResultadoMercadoPagoSiAplica();
      await this.inicializarPagoEmbebidoSiAplica();
    } catch { this.estado = 'no-encontrado'; }
  }

  private async inicializarPagoEmbebidoSiAplica(): Promise<void> {
    if (!this.curso || !this.esCursoDePago() || this.pasoRegistro !== 1) return;

    const publicKey = (environment as any)?.mercadoPago?.publicKey;
    if (!publicKey || String(publicKey).includes('<PEGAR_')) {
      console.error('Falta configurar environment.mercadoPago.publicKey');
      return;
    }

    try {
      await this.ensureMercadoPagoSdkLoaded();

      const MercadoPagoCtor = (window as any).MercadoPago;
      if (!MercadoPagoCtor) {
        throw new Error('SDK Mercado Pago no disponible en window');
      }

      if (this.mpBrickController?.unmount) {
        try { this.mpBrickController.unmount(); } catch {}
      }

      const container = document.getElementById(this.mpBrickContainerId);
      if (!container) return;
      container.innerHTML = '';

      const mp = new MercadoPagoCtor(publicKey, { locale: 'es-MX' });
      const bricksBuilder = mp.bricks();
      const intentId = crypto.randomUUID();
      sessionStorage.setItem('mp_intent_id', intentId);
      const initEmail = (this.form.correo || '').trim();

      this.mpBrickController = await bricksBuilder.create('cardPayment', this.mpBrickContainerId, {
        initialization: {
          amount: Number(this.curso.precio || 0),
          payer: {
            email: initEmail || undefined,
          },
        },
        customization: {
          paymentMethods: {
            maxInstallments: 12,
          },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async ({ formData }: any) => {
            const payerEmail = (formData?.payer?.email || this.form.correo || '').trim();
            if (!payerEmail) {
              throw new Error('Correo requerido para procesar el pago');
            }
            const payload = {
              transaction_amount: Number(this.curso?.precio || 0),
              token: formData?.token,
              description: this.curso?.nombre ?? 'Curso',
              installments: Number(formData?.installments || 1),
              payment_method_id: formData?.payment_method_id,
              issuer_id: formData?.issuer_id,
              external_reference: intentId,
              payer: {
                email: payerEmail,
                identification: formData?.payer?.identification
                  ? {
                      type: formData.payer.identification.type,
                      number: formData.payer.identification.number,
                    }
                  : undefined,
              },
            };

            const result = await firstValueFrom(this.svc.procesarMercadoPagoPago(payload));
            if (result?.status === 'approved' || result?.status === 'in_process') {
              if (!this.form.correo) this.form.correo = payerEmail;
              this.pagoSimuladoOk = true;
              this.pasoRegistro = 2;
              sessionStorage.removeItem('mp_intent_id');
              if (this.mpBrickController?.unmount) {
                try { this.mpBrickController.unmount(); } catch {}
              }
              return result;
            }
            throw new Error(`Pago no aprobado (${result?.status ?? 'desconocido'})`);
          },
          onError: (error: any) => {
            console.error('Error en Payment Brick Mercado Pago', error, JSON.stringify(error));
          },
        },
      });
    } catch (e) {
      console.error('No se pudo inicializar el pago embebido de Mercado Pago', e);
    }
  }

  private async ensureMercadoPagoSdkLoaded(): Promise<void> {
    if ((window as any).MercadoPago) return;
    if (this.mpSdkLoading) {
      await new Promise((r) => setTimeout(r, 300));
      if ((window as any).MercadoPago) return;
    }

    this.mpSdkLoading = true;
    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-mp-sdk="true"]') as HTMLScriptElement | null;
        if (existing) {
          if ((window as any).MercadoPago) return resolve();
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Error cargando SDK Mercado Pago')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-mp-sdk', 'true');
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar SDK Mercado Pago'));
        document.body.appendChild(script);
      });
    } finally {
      this.mpSdkLoading = false;
    }
  }

  private async aplicarResultadoMercadoPagoSiAplica(): Promise<void> {
    if (!this.curso) return;
    if (!this.esCursoDePago()) return;

    if (this.mpReturnStatus !== 'approved') return;
    if (!this.mpReturnPaymentId) return;

    // Si todavía tenemos un intent esperado y no coincide, lo ignoramos.
    if (this.mpExpectedIntentId &&
        this.mpReturnExternalReference &&
        this.mpReturnExternalReference !== this.mpExpectedIntentId) {
      return;
    }

    try {
      this.enviando = true;
      const verificacion = await firstValueFrom(
        this.svc.verificarMercadoPagoPayment(this.mpReturnPaymentId)
      );

      if (verificacion?.status === 'approved') {
        this.pagoSimuladoOk = true;
        this.pasoRegistro = 2;
        sessionStorage.removeItem('mp_intent_id');
      }
    } catch (e) {
      console.error('Error verificando pago Mercado Pago', e);
    } finally {
      this.enviando = false;
    }
  }

  /** Fallback para flujo previo por preferencia (se mantiene por compatibilidad). */
  async simularPagoYAvanzar() {
    if (!this.curso) return;
    if (!this.esCursoDePago()) return;

    const slug = this.route.snapshot.queryParamMap.get('c') ?? this.curso.slug;
    if (!slug) return;

    const intentId = crypto.randomUUID();
    sessionStorage.setItem('mp_intent_id', intentId);

    this.enviando = true;
    try {
      const resp = await firstValueFrom(
        this.svc.crearMercadoPagoPreference({
          externalReference: intentId,
          courseSlug: slug,
          title: this.curso.nombre,
          amount: this.curso.precio,
          currency: (this.curso.moneda ?? 'MXN').toUpperCase(),
        })
      );

      // Redirección fuera del SPA (Mercado Pago captura los datos de pago).
      window.location.href = resp.init_point;
    } catch (e) {
      console.error('Error creando preferencia Mercado Pago', e);
      this.estado = 'error';
    } finally {
      this.enviando = false;
    }
  }

  volverAlPago() {
    this.pasoRegistro = 1;
    this.pagoSimuladoOk = false;
    this.submitted = false;
    this.resetMockTarjeta();
    setTimeout(() => this.inicializarPagoEmbebidoSiAplica());
  }

  /** Valida formulario y persiste (tras pago simulado si aplica). */
  async confirmarRegistro() {
    this.submitted = true;
    if (!this.form.nombre || !this.form.correo || !this.form.telefono ||
        !this.form.comoSeEnteroOpcion || !this.form.experienciaOpcion) {
      return;
    }
    if (this.esCursoDePago() && (!this.pagoSimuladoOk || this.pasoRegistro !== 2)) {
      return;
    }
    await this.completarRegistro();
  }

  reintentar() {
    this.estado = 'formulario';
    this.pasoRegistro = 1;
    this.pagoSimuladoOk = false;
    this.resetMockTarjeta();
  }

  private async completarRegistro() {
    this.enviando = true;
    try {
      const duplicado = await this.svc.correoYaRegistrado(this.curso!.id!, this.form.correo);
      if (duplicado) { this.estado = 'duplicado'; this.enviando = false; return; }

      const registroId = await this.svc.crearRegistro(this.curso!.id!, {
        ...this.form,
        idCompany: this.curso!.idCompany,
      });

      // Si el curso requiere pago y Mercado Pago lo aprobó, marcamos el registro como pagado.
      if (this.esCursoDePago() && this.pagoSimuladoOk) {
        await this.svc.marcarPagado(this.curso!.id!, registroId, true);
      }

      await this.svc.enviarConfirmacionAlumno(this.curso!, this.form);
      this.svc.notificarAdminTelegram(this.curso!.telegramChatId, this.curso!, this.form);
      this.estado = 'enviado';
      this.pasoRegistro = 1;
      this.pagoSimuladoOk = false;
    } catch { this.estado = 'error'; }
    finally { this.enviando = false; }
  }

  fmtDate(ts: Timestamp): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts as any);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
