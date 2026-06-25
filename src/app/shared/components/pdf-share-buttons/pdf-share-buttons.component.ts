import { Component, Input, inject } from '@angular/core';
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
  `,
})
export class PdfShareButtonsComponent {
  @Input() getPdfBlob!: () => Promise<Blob>;
  @Input() fileName: string = 'documento.pdf';
  @Input() subject: string  = 'Documento adjunto';
  @Input() emailBody: string = '<p>Adjunto el documento solicitado.</p>';

  busy = false;
  private svc = inject(PdfShareService);

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
    try {
      const blob      = await this.getPdfBlob();
      const pdfBase64 = await this.blobToBase64(blob);
      await this.svc.sendByEmail({
        to:        formValues.to,
        cc:        formValues.cc || undefined,
        subject:   this.subject,
        body:      this.emailBody,
        pdfBase64,
        fileName:  this.fileName,
      });
      Swal.fire({ icon: 'success', title: 'Correo enviado', timer: 1800, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo enviar el correo.', 'error');
    } finally {
      this.busy = false;
    }
  }

  async onWhatsApp(): Promise<void> {
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
    });
    if (!isConfirmed || !phone) return;

    this.busy = true;
    try {
      const blob = await this.getPdfBlob();
      await this.svc.sendByWhatsApp({ phone, pdfBlob: blob, fileName: this.fileName, message: this.subject });
      Swal.fire({ icon: 'success', title: 'WhatsApp preparado', timer: 1800, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo preparar WhatsApp.', 'error');
    } finally {
      this.busy = false;
    }
  }

  async onTelegram(): Promise<void> {
    const { value: email, isConfirmed } = await Swal.fire({
      title: 'Enviar por Telegram',
      input: 'email',
      inputLabel: 'Correo registrado en el sistema',
      inputPlaceholder: 'usuario@empresa.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      footer: 'El destinatario debe haber iniciado sesión en el bot de Telegram al menos una vez.',
      inputValidator: (v) => {
        if (!v || !v.includes('@')) return 'Correo inválido.';
        return null;
      },
    });
    if (!isConfirmed || !email) return;

    this.busy = true;
    Swal.fire({ title: 'Enviando por Telegram...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const blob = await this.getPdfBlob();
      await this.svc.sendByTelegram({ email, pdfBlob: blob, fileName: this.fileName, caption: this.subject });
      Swal.fire({ icon: 'success', title: 'Enviado por Telegram', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      const msg = err?.error?.error ?? 'No se pudo enviar por Telegram.';
      Swal.fire('Error', msg, 'error');
    } finally {
      this.busy = false;
    }
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
