import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { StoragesService } from './storages.service';
import { environment } from '@env/environment';

export interface PdfEmailOptions {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  pdfBase64: string;
  fileName: string;
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
  async sendByEmail(opts: PdfEmailOptions): Promise<void> {
    const mailRef = collection(this.firestore, 'mail');
    await addDoc(mailRef, {
      to: opts.to,
      ...(opts.cc ? { cc: opts.cc } : {}),
      message: {
        subject: opts.subject,
        html: opts.body,
        attachments: [{
          filename: opts.fileName,
          content:  opts.pdfBase64,
          encoding: 'base64',
        }],
      },
    });
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  async sendByWhatsApp(opts: PdfWhatsAppOptions): Promise<void> {
    const phone = this.normalizePhone(opts.phone);
    const file  = new File([opts.pdfBlob], opts.fileName, { type: 'application/pdf' });
    const url   = await this.storages.uploadFile(file, `pdf/share/${Date.now()}_${opts.fileName}`);
    const text  = `${opts.message}\n\n📎 Descarga aquí: ${url}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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
