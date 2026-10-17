import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfShareService } from 'app/services/pdf-share.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-pdf-share-buttons',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex gap-1 flex-wrap">
      <button class="btn btn-sm btn-outline-primary" [disabled]="busy" (click)="onEmail()" title="Enviar por Correo">
        <i class="bi bi-envelope"></i>
      </button>
      <button class="btn btn-sm btn-outline-success" [disabled]="busy" (click)="onWhatsApp()" title="Enviar por WhatsApp">
        <i class="bi bi-whatsapp"></i>
      </button>
      <button class="btn btn-sm btn-outline-info" [disabled]="busy" (click)="onTelegram()" title="Enviar por Telegram">
        <i class="bi bi-telegram"></i>
      </button>
    </div>
    <div *ngIf="busy" class="pdf-share-loading-backdrop" role="status" aria-live="polite">
      <div class="pdf-share-loading-card">
        <div class="spinner-border text-primary" aria-hidden="true"></div>
        <div class="pdf-share-loading-title">{{ busyMessage }}</div>
        <div class="pdf-share-loading-track"><div class="pdf-share-loading-bar"></div></div>
        <div class="small text-muted">Espera mientras termina el proceso.</div>
      </div>
    </div>
  `,
  styles: [`
    .pdf-share-loading-backdrop { position: fixed; inset: 0; z-index: 20000; display: grid; place-items: center; background: rgba(0,0,0,.42); }
    .pdf-share-loading-card { width: min(360px, calc(100vw - 32px)); padding: 28px 24px; border-radius: 12px; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,.28); text-align: center; }
    .pdf-share-loading-title { margin: 14px 0 16px; font-size: 1.05rem; font-weight: 600; }
    .pdf-share-loading-track { height: 7px; margin-bottom: 12px; overflow: hidden; border-radius: 99px; background: #e9ecef; }
    .pdf-share-loading-bar { width: 40%; height: 100%; border-radius: inherit; background: #0d6efd; animation: pdf-share-progress 1.2s ease-in-out infinite; }
    @keyframes pdf-share-progress { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
  `],
})
export class PdfShareButtonsComponent {
  @Input() getPdfBlob!: () => Promise<Blob>;
  @Input() fileName: string = 'documento.pdf';
  @Input() subject: string  = 'Documento adjunto';
  @Input() emailBody: string = '<p>Adjunto el documento solicitado.</p>';

  busy = false;
  busyMessage = '';
  private svc = inject(PdfShareService);
  private cdr = inject(ChangeDetectorRef);

  async onEmail(): Promise<void> {
    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Enviar por Correo',
      html: `
        <input id="swal-email-to" class="swal2-input" placeholder="Para (correo destino)" type="email">
        <input id="swal-email-cc" class="swal2-input" placeholder="CC (opcional)" type="email">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const to = (document.getElementById('swal-email-to') as HTMLInputElement).value.trim();
        if (!to) { Swal.showValidationMessage('El correo destino es requerido'); return false; }
        return { to, cc: (document.getElementById('swal-email-cc') as HTMLInputElement).value.trim() };
      },
    });
    if (!isConfirmed || !formValues) return;

    this.busy = true;
    this.setBusyMessage('Preparando el PDF para correo…');
    try {
      const blob      = await this.getPdfBlob();
      this.setBusyMessage('Adjuntando PDF y registrando el envío…');
      const pdfBase64 = await this.blobToBase64(blob);
      await this.svc.sendByEmail({
        to:        formValues.to,
        cc:        formValues.cc || undefined,
        subject:   this.subject,
        body:      this.emailBody,
        pdfBase64,
        fileName:  this.fileName,
      });
      Swal.fire({ icon: 'success', title: 'Solicitud registrada', text: 'El correo quedó en la cola de envío.', timer: 2600, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo enviar el correo.', 'error');
    } finally {
      this.busy = false;
      this.busyMessage = '';
      this.cdr.detectChanges();
    }
  }

  async onWhatsApp(): Promise<void> {
    let whatsappWindow: Window | null = null;
    const { value: phone, isConfirmed } = await Swal.fire({
      title: 'Enviar por WhatsApp',
      input: 'text',
      inputLabel: 'Número destino',
      inputPlaceholder: 'Ej. 5512345678 o 525512345678',
      showCancelButton: true,
      confirmButtonText: 'Preparar',
      cancelButtonText: 'Cancelar',
      footer: 'Si escribes 10 dígitos se agrega +52 (México) automáticamente.',
      inputValidator: (v) => {
        const d = v.replace(/\D/g, '');
        if (!d || (d.length !== 10 && (d.length < 11 || d.length > 15)))
          return 'Número inválido. Usa 10 dígitos o número completo con código de país.';
        return null;
      },
      preConfirm: (value) => {
        // Open while the confirmation click still has browser user activation.
        whatsappWindow = window.open('about:blank', '_blank');
        return value;
      },
    });
    if (!isConfirmed || !phone) {
      whatsappWindow?.close();
      return;
    }

    this.busy = true;
    this.setBusyMessage('Preparando el PDF para WhatsApp…');
    try {
      const blob = await this.getPdfBlob();
      this.setBusyMessage('Subiendo el PDF…');
      const whatsappUrl = await this.svc.sendByWhatsApp({ phone, pdfBlob: blob, fileName: this.fileName, message: this.subject });
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = whatsappUrl;
        Swal.fire({ icon: 'success', title: 'WhatsApp listo', text: 'El PDF ya está disponible para compartir.', timer: 2200, showConfirmButton: false });
      } else {
        Swal.fire({
          icon: 'success', title: 'PDF listo para compartir',
          html: `<a class="btn btn-success" href="${whatsappUrl}" target="_blank" rel="noopener">Abrir WhatsApp</a>`,
          confirmButtonText: 'Cerrar',
        });
      }
    } catch {
      whatsappWindow?.close();
      Swal.fire('Error', 'No se pudo preparar WhatsApp.', 'error');
    } finally {
      this.busy = false;
      this.busyMessage = '';
      this.cdr.detectChanges();
    }
  }

  async onTelegram(): Promise<void> {
    this.busy = true;
    this.setBusyMessage('Preparando el PDF para Telegram…');
    try {
      const blob = await this.getPdfBlob();
      this.setBusyMessage('Subiendo el PDF…');
      await this.svc.sendByTelegram({ pdfBlob: blob, fileName: this.fileName, caption: this.subject });
      Swal.close();
    } catch (err: any) {
      Swal.fire('Error', 'No se pudo subir el archivo.', 'error');
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

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve((r.result as string).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
}
