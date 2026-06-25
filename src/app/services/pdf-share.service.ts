import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { StoragesService } from './storages.service';
import { environment } from '@env/environment';
import { lastValueFrom } from 'rxjs';

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
  email?: string;   // preferred: looks up idtelegram in security DB
  phone?: string;   // fallback: looks up in conversationStates
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
  async sendByTelegram(opts: PdfTelegramOptions): Promise<{ chatId: string }> {
    const pdfBase64 = await this.blobToBase64(opts.pdfBlob);
    const file      = new File([opts.pdfBlob], opts.fileName, { type: 'application/pdf' });
    let cloudUrl: string | undefined;
    try {
      cloudUrl = await this.storages.uploadFile(file, `pdf/share/${Date.now()}_${opts.fileName}`);
    } catch { /* no bloquear si falla el upload */ }

    const res = await lastValueFrom(
      this.http.post<{ status: string; chatId: string }>(
        `${environment.urlChatBot}/telegram/send-pdf`,
        {
          email:     opts.email,
          phone:     opts.phone,
          pdfBase64,
          fileName:  opts.fileName,
          caption:   opts.caption ?? opts.fileName,
          cloudUrl,
        }
      )
    );
    return res;
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
