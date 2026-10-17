import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, addDoc, doc, onSnapshot } from '@angular/fire/firestore';
import { StoragesService } from './storages.service';
import { environment } from '@env/environment';

export interface PdfEmailOptions {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  pdfBlob: Blob;
  fileName: string;
}

export interface PdfEmailDeliveryStatus {
  state: 'SUCCESS' | 'ERROR' | 'PENDING' | 'PROCESSING' | 'UNKNOWN';
  error?: string;
}

export interface PdfWhatsAppOptions {
  phone: string;
  pdfBlob: Blob;
  fileName: string;
  message: string;
}

export interface PdfTelegramOptions {
  pdfBlob: Blob;
  fileName: string;
  caption?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfShareService {
  private http       = inject(HttpClient);
  private firestore  = inject(Firestore);
  private storages   = inject(StoragesService);

  // ── Email ──────────────────────────────────────────────────────────────────
  async sendByEmail(opts: PdfEmailOptions, onProgress?: (message: string) => void): Promise<string> {
    onProgress?.('Subiendo el PDF…');
    const safeFileName = opts.fileName.replace(/[\\/:*?"<>|]+/g, '-');
    const file = new File([opts.pdfBlob], safeFileName, { type: 'application/pdf' });
    const attachmentUrl = await this.storages.uploadFile(file, `pdf/email/${Date.now()}_${safeFileName}`);
    onProgress?.('Registrando el correo para envío…');
    const mailRef = collection(this.firestore, 'mail');
    const mailDoc = await addDoc(mailRef, {
      to: [opts.to],
      ...(opts.cc ? { cc: opts.cc } : {}),
      message: {
        subject: opts.subject,
        html: `${opts.body}<p>Se adjunta el reporte en PDF. <a href="${attachmentUrl}">Descargar PDF</a></p>`,
        text: 'Se adjunta el reporte en PDF. Descarga: ' + attachmentUrl,
        attachments: [{
          filename: opts.fileName,
          path: attachmentUrl,
          contentType: 'application/pdf',
        }],
      },
    });
    return mailDoc.id;
  }

  waitForEmailDelivery(mailId: string, timeoutMs = 20000): Promise<PdfEmailDeliveryStatus> {
    return new Promise(resolve => {
      let finished = false;
      let unsubscribe = () => {};
      const finish = (status: PdfEmailDeliveryStatus) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve(status);
      };
      const timeout = setTimeout(() => finish({ state: 'UNKNOWN' }), timeoutMs);
      const stop = onSnapshot(doc(this.firestore, 'mail', mailId), snapshot => {
        const delivery = snapshot.data()?.['delivery'] as { state?: string; error?: string } | undefined;
        const state = delivery?.state?.toUpperCase();
        if (state === 'SUCCESS' || state === 'ERROR') {
          finish({ state, error: delivery?.error });
        }
      }, () => finish({ state: 'UNKNOWN' }));
      unsubscribe = stop;
      if (finished) unsubscribe();
    });
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  async sendByWhatsApp(opts: PdfWhatsAppOptions): Promise<string> {
    const phone = this.normalizePhone(opts.phone);
    const file  = new File([opts.pdfBlob], opts.fileName, { type: 'application/pdf' });
    const url   = await this.storages.uploadFile(file, `pdf/share/${Date.now()}_${opts.fileName}`);
    const text  = `${opts.message}\n\n📎 Descarga aquí: ${url}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  // ── Telegram ───────────────────────────────────────────────────────────────
  async sendByTelegram(opts: PdfTelegramOptions): Promise<void> {
    const file = new File([opts.pdfBlob], opts.fileName, { type: 'application/pdf' });
    const url  = await this.storages.uploadFile(file, `pdf/share/${Date.now()}_${opts.fileName}`);
    const text = opts.caption ? `${opts.caption}\n\n📎 ${url}` : url;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(opts.caption ?? opts.fileName)}`, '_blank', 'noopener,noreferrer');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `52${digits}`;
    return digits;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
