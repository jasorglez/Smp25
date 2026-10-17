import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfShareService } from 'app/services/pdf-share.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-pdf-share-buttons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pdf-share-toolbar">
      <div class="pdf-share-buttons">
      <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="busy" (click)="onPrint()" title="Imprimir PDF">
        <i class="bi bi-printer"></i>
      </button>
      <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="busy" (click)="togglePanel('email')" title="Enviar por Correo">
        <i class="bi bi-envelope"></i>
      </button>
      <button type="button" class="btn btn-sm btn-outline-success" [disabled]="busy" (click)="togglePanel('whatsapp')" title="Enviar por WhatsApp">
        <i class="bi bi-whatsapp"></i>
      </button>
      <button type="button" class="btn btn-sm btn-outline-info" [disabled]="busy" (click)="onTelegram()" title="Enviar por Telegram">
        <i class="bi bi-telegram"></i>
      </button>
      </div>

      <form *ngIf="activePanel === 'email'" class="pdf-share-inline-form" (submit)="$event.preventDefault(); onEmail()">
        <input class="form-control form-control-sm email-input" type="email" name="emailTo" [(ngModel)]="emailTo" placeholder="Correo destino" aria-label="Correo destino" [disabled]="busy" required>
        <input class="form-control form-control-sm cc-input" type="email" name="emailCc" [(ngModel)]="emailCc" placeholder="CC opcional" aria-label="Correo en copia" [disabled]="busy">
        <button type="submit" class="btn btn-sm btn-primary" [disabled]="busy || !emailTo.trim()"><i class="bi bi-send me-1"></i>Enviar</button>
        <button type="button" class="btn btn-sm btn-light" [disabled]="busy" (click)="closePanel()" aria-label="Cerrar envío de correo"><i class="bi bi-x-lg"></i></button>
      </form>

      <form *ngIf="activePanel === 'whatsapp'" class="pdf-share-inline-form" (submit)="$event.preventDefault(); onWhatsApp()">
        <input class="form-control form-control-sm phone-input" type="tel" name="whatsappPhone" [(ngModel)]="phone" placeholder="WhatsApp (10 dígitos)" aria-label="Número de WhatsApp" [disabled]="busy" required>
        <button type="submit" class="btn btn-sm btn-success" [disabled]="busy || !phone.trim()"><i class="bi bi-whatsapp me-1"></i>Compartir</button>
        <button type="button" class="btn btn-sm btn-light" [disabled]="busy" (click)="closePanel()" aria-label="Cerrar envío por WhatsApp"><i class="bi bi-x-lg"></i></button>
      </form>

      <span *ngIf="busy" class="pdf-share-feedback text-primary" role="status" aria-live="polite">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> {{ busyMessage }}
      </span>
      <div *ngIf="busy" class="pdf-share-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="busyMessage">
        <div class="pdf-share-progress-bar"></div>
      </div>
      <span *ngIf="feedback && !busy" class="pdf-share-feedback" [class.text-danger]="feedbackType === 'error'" [class.text-success]="feedbackType === 'success'" [class.text-muted]="feedbackType === 'info'" role="status" aria-live="polite">
        <i class="bi" [class.bi-exclamation-circle]="feedbackType === 'error'" [class.bi-check-circle]="feedbackType === 'success'" [class.bi-info-circle]="feedbackType === 'info'"></i>
        {{ feedback }}
        <a *ngIf="whatsappUrl" class="ms-1" [href]="whatsappUrl" target="_blank" rel="noopener">Abrir WhatsApp</a>
        <a *ngIf="printUrl" class="ms-1" [href]="printUrl" target="_blank" rel="noopener">Abrir PDF para imprimir</a>
      </span>
      </div>
  `,
  styles: [`
    .pdf-share-toolbar, .pdf-share-buttons, .pdf-share-inline-form { display: flex; align-items: center; gap: .35rem; }
    .pdf-share-toolbar { flex-wrap: wrap; }
    .pdf-share-buttons { flex: 0 0 auto; }
    .pdf-share-inline-form { flex-wrap: wrap; }
    .pdf-share-inline-form .email-input { width: 190px; }
    .pdf-share-inline-form .cc-input { width: 150px; }
    .pdf-share-inline-form .phone-input { width: 190px; }
    .pdf-share-feedback { display: inline-flex; align-items: center; gap: .3rem; font-size: .78rem; }
    .pdf-share-progress { flex: 0 1 130px; height: 5px; overflow: hidden; border-radius: 99px; background: #dce6f1; }
    .pdf-share-progress-bar { width: 40%; height: 100%; border-radius: inherit; background: #1680ad; animation: pdf-share-progress 1.2s ease-in-out infinite; }
    @keyframes pdf-share-progress { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
    @media (max-width: 600px) { .pdf-share-inline-form { flex: 1 1 100%; } }
  `],
})
export class PdfShareButtonsComponent {
  @Input() getPdfBlob!: () => Promise<Blob>;
  @Input() fileName: string = 'documento.pdf';
  @Input() subject: string  = 'Documento adjunto';
  @Input() emailBody: string = '<p>Adjunto el documento solicitado.</p>';

  busy = false;
  busyMessage = '';
  activePanel: 'email' | 'whatsapp' | null = null;
  emailTo = '';
  emailCc = '';
  phone = '';
  feedback = '';
  feedbackType: 'success' | 'error' | 'info' = 'info';
  whatsappUrl = '';
  printUrl = '';
  private svc = inject(PdfShareService);
  private signals = inject(SignalsService);
  private tracking = inject(TrackingService);
  private cdr = inject(ChangeDetectorRef);

  togglePanel(panel: 'email' | 'whatsapp'): void {
    this.activePanel = this.activePanel === panel ? null : panel;
    if (this.activePanel === 'email' && !this.emailTo.trim()) {
      this.emailTo = this.signals.profile.emailUser()?.trim()
        || this.signals.getemailChoose()?.trim()
        || this.tracking.getEmail()?.trim()
        || '';
    }
    this.feedback = '';
    this.whatsappUrl = '';
    this.printUrl = '';
  }

  closePanel(): void {
    this.activePanel = null;
    this.feedback = '';
    this.whatsappUrl = '';
    this.printUrl = '';
  }

  async onEmail(): Promise<void> {
    const to = this.emailTo.trim();
    const cc = this.emailCc.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(to)) {
      this.setFeedback('Escribe un correo destino válido.', 'error');
      return;
    }
    if (cc && !emailPattern.test(cc)) {
      this.setFeedback('Escribe un correo válido en CC.', 'error');
      return;
    }

    this.busy = true;
    this.feedback = '';
    this.setBusyMessage('Preparando el PDF para correo…');
    try {
      const blob = await this.getPdfBlob();
      const mailId = await this.svc.sendByEmail({
        to,
        cc:        cc || undefined,
        subject:   this.subject,
        body:      this.emailBody,
        pdfBlob:   blob,
        fileName:  this.fileName,
      }, message => this.setBusyMessage(message));
      this.setBusyMessage('Esperando confirmación del servicio de correo…');
      // The mail extension sends asynchronously; keep the viewer responsive after enqueue.
      const delivery = await this.svc.waitForEmailDelivery(mailId, 3000);
      if (delivery.state === 'SUCCESS') {
        this.setFeedback(`El servidor confirmó la entrega a ${to}.`, 'success');
      } else if (delivery.state === 'ERROR') {
        this.setFeedback(delivery.error || 'El servicio de correo rechazó el mensaje.', 'error');
      } else {
        this.setFeedback(`Correo registrado para ${to}; el servicio lo procesa en segundo plano.`, 'info');
      }
    } catch (error) {
      console.error('Error al preparar o enviar el PDF por correo:', error);
      this.setFeedback(this.emailErrorMessage(error), 'error');
    } finally {
      this.busy = false;
      this.busyMessage = '';
      this.cdr.detectChanges();
    }
  }

  async onWhatsApp(): Promise<void> {
    const normalizedPhone = this.phone.replace(/\D/g, '');
    if (normalizedPhone.length !== 10 && (normalizedPhone.length < 11 || normalizedPhone.length > 15)) {
      this.setFeedback('Usa 10 dígitos o el número completo con código de país.', 'error');
      return;
    }

    // Open the tab directly from the click so the browser does not block it after upload.
    const whatsappWindow = window.open('about:blank', '_blank');
    this.busy = true;
    this.feedback = '';
    this.whatsappUrl = '';
    this.setBusyMessage('Preparando el PDF para WhatsApp…');
    try {
      const blob = await this.getPdfBlob();
      this.setBusyMessage('Subiendo el PDF…');
      const whatsappUrl = await this.svc.sendByWhatsApp({ phone: this.phone, pdfBlob: blob, fileName: this.fileName, message: this.subject });
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = whatsappUrl;
        this.setFeedback('WhatsApp está listo en la pestaña abierta; confirma el envío ahí.', 'success');
      } else {
        this.whatsappUrl = whatsappUrl;
        this.setFeedback('El PDF está listo. Abre WhatsApp para confirmar el envío.', 'info');
      }
    } catch {
      whatsappWindow?.close();
      this.setFeedback('No se pudo preparar el PDF para WhatsApp.', 'error');
    } finally {
      this.busy = false;
      this.busyMessage = '';
      this.cdr.detectChanges();
    }
  }

  async onTelegram(): Promise<void> {
    const telegramWindow = window.open('about:blank', '_blank');
    this.busy = true;
    this.feedback = '';
    this.setBusyMessage('Preparando el PDF para Telegram…');
    try {
      const blob = await this.getPdfBlob();
      this.setBusyMessage('Subiendo el PDF…');
      const telegramUrl = await this.svc.sendByTelegram({ pdfBlob: blob, fileName: this.fileName, caption: this.subject }, false);
      if (telegramWindow && !telegramWindow.closed) {
        telegramWindow.location.href = telegramUrl;
        this.setFeedback('Telegram está listo en la pestaña abierta.', 'success');
      } else {
        this.setFeedback('El navegador bloqueó la pestaña de Telegram; vuelve a pulsar el botón.', 'error');
      }
    } catch (err: any) {
      telegramWindow?.close();
      this.setFeedback(err?.message || 'No se pudo subir el archivo a Telegram.', 'error');
    } finally {
      this.busy = false;
      this.busyMessage = '';
      this.cdr.detectChanges();
    }
  }

  async onPrint(): Promise<void> {
    // Reserve the tab on the user click so popup blockers do not prevent printing later.
    const printWindow = window.open('about:blank', '_blank');
    this.busy = true;
    this.feedback = '';
    this.printUrl = '';
    this.setBusyMessage('Preparando el PDF para imprimir…');
    try {
      const blob = await this.getPdfBlob();
      const objectUrl = URL.createObjectURL(blob);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
      if (!printWindow || printWindow.closed) {
        this.printUrl = objectUrl;
        this.setFeedback('El PDF está listo; ábrelo para imprimir.', 'info');
        return;
      }

      printWindow.location.href = objectUrl;
      printWindow.addEventListener('load', () => {
        printWindow.focus();
        printWindow.print();
      }, { once: true });
      this.setFeedback('El PDF está listo; se abrirá el diálogo de impresión.', 'success');
    } catch (error) {
      printWindow?.close();
      this.setFeedback((error as any)?.message || 'No se pudo preparar el PDF para imprimir.', 'error');
    } finally {
      this.busy = false;
      this.busyMessage = '';
      this.cdr.detectChanges();
    }
  }

  private setBusyMessage(message: string): void {
    this.busyMessage = message;
    this.cdr.detectChanges();
  }

  private setFeedback(message: string, type: 'success' | 'error' | 'info'): void {
    this.feedback = message;
    this.feedbackType = type;
    this.cdr.detectChanges();
  }

  private emailErrorMessage(error: any): string {
    const code = String(error?.code || '').toLowerCase();
    if (code.includes('storage/unauthorized') || code.includes('permission-denied')) {
      return 'Firebase rechazó el acceso para subir el PDF o registrar el correo. Revisa las reglas de Storage y Firestore.';
    }
    if (code.includes('storage/')) {
      return `No se pudo subir el PDF a Firebase Storage (${error?.code}). ${error?.message || ''}`.trim();
    }
    return error?.message || error?.code || 'Ocurrió un error inesperado al preparar el correo.';
  }
}
