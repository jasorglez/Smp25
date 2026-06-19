import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { AgendaService } from 'app/services/agenda.service';
import { environment } from '@env/environment';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  loading?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
})
export class ChatbotComponent {
  private http           = inject(HttpClient);
  private incomesService = inject(IncomesAndExpensesService);
  private adminService   = inject(AdministrationService);
  private agendaService  = inject(AgendaService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  isOpen    = false;
  inputText = '';
  messages: ChatMessage[] = [
    { role: 'bot', text: 'Hola! Soy tu asistente BI. Pregúntame lo que necesites: saldos, gastos, ingresos, citas, o cualquier cosa.' },
  ];

  private geminiHistory: { role: string; parts: { text: string }[] }[] = [];

  get isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  private get idCompany(): number {
    return Number(localStorage.getItem('company') || 0);
  }

  private isUserScrolledUp(): boolean {
    const el = this.messagesContainer?.nativeElement;
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight > 60;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        const el = this.messagesContainer?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      } catch {}
    }, 30);
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.scrollToBottom();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.send();
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text) return;

    this.messages.push({ role: 'user', text });
    this.inputText = '';
    this.scrollToBottom();

    const loadingMsg: ChatMessage = { role: 'bot', text: '', loading: true };
    this.messages.push(loadingMsg);

    const response = await this.processWithGemini(text);

    const idx = this.messages.indexOf(loadingMsg);
    if (idx !== -1) this.messages[idx] = { role: 'bot', text: response };

    if (!this.isUserScrolledUp()) this.scrollToBottom();
  }

  // ── Detecta si necesita datos, los jala y manda todo a Gemini ──────────

  private async processWithGemini(userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();
    const dataContext = await this.buildDataContext(lower);
    return this.callGemini(userMessage, dataContext);
  }

  private async buildDataContext(text: string): Promise<string> {
    const parts: string[] = [];
    const fetch = async (condition: boolean, label: string, fn: () => Promise<string>) => {
      if (!condition) return;
      try { const d = await fn(); if (d) parts.push(`${label}:\n${d}`); } catch {}
    };

    await Promise.all([
      fetch(
        this.matchesAny(text, ['saldo', 'banco', 'cuenta', 'efectivo', 'caja', 'dinero']),
        'SALDOS BANCARIOS', () => this.getSaldosRaw()
      ),
      fetch(
        this.matchesAny(text, ['gasto', 'egreso', 'pago', 'salida', 'compra']),
        'EGRESOS', () => this.getGastosRaw()
      ),
      fetch(
        this.matchesAny(text, ['ingreso', 'venta', 'cobro', 'entrada', 'factura']),
        'INGRESOS', () => this.getIngresosRaw()
      ),
      fetch(
        this.matchesAny(text, ['cita', 'agenda', 'reunion', 'visita', 'llamada', 'demo', 'semana', 'hoy', 'mañana']),
        'AGENDA SEMANA', () => this.getCitasRaw()
      ),
    ]);

    return parts.join('\n\n');
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }

  // ── Llamada a Gemini API ────────────────────────────────────────────────

  private buildSystemPrompt(dataContext: string): string {
    const fecha = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    let prompt = `Eres el asistente BI de la empresa. Hoy es ${fecha}. Responde siempre en español, de forma concisa, amigable y profesional. Máximo 4 líneas salvo que el usuario pida detalle.`;

    if (dataContext) {
      prompt += `\n\nDatos actuales de la empresa para responder:\n\n${dataContext}\n\nUsa estos datos para responder con precisión.`;
    } else {
      prompt += '\nSi el usuario pide datos de la empresa y no hay datos disponibles, indícalo amablemente.';
    }

    return prompt;
  }

  private async callGemini(userMessage: string, dataContext: string): Promise<string> {
    const apiKey = (environment as any).geminiApiKey;
    if (!apiKey) return 'Falta configurar geminiApiKey en environment.ts.\nObtén tu clave gratuita en: https://aistudio.google.com/app/apikey';

    this.geminiHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    if (this.geminiHistory.length > 20) this.geminiHistory = this.geminiHistory.slice(-20);

    const body = {
      system_instruction: { parts: [{ text: this.buildSystemPrompt(dataContext) }] },
      contents: this.geminiHistory,
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

    try {
      const res = await firstValueFrom(this.http.post<any>(url, body, { headers }));
      const text: string = res?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta de Gemini.';
      this.geminiHistory.push({ role: 'model', parts: [{ text }] });
      return text;
    } catch (err: any) {
      const msg = err?.error?.error?.message ?? err?.message ?? 'Error al conectar con Gemini.';
      return `Error Gemini: ${msg}`;
    }
  }

  // ── Obtener datos en formato texto para el contexto ─────────────────────

  private async getSaldosRaw(): Promise<string> {
    const data = await lastValueFrom(this.adminService.getAccountBanks(this.idCompany));
    const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (!arr.length) return '';
    const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
    const total = arr.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
    const lines = arr.map(c => `${c.nameAccount ?? c.numberAccount ?? 'Cuenta'}: $${fmt(c.saldo)}`).join('\n');
    return `${lines}\nTOTAL: $${fmt(total)}`;
  }

  private async getGastosRaw(): Promise<string> {
    const data = await lastValueFrom(this.incomesService.getExpensesxroot(this.idCompany));
    const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (!arr.length) return '';
    const total = arr.reduce((s, e) => s + (Number(e.total ?? e.importe ?? e.amount) || 0), 0);
    const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    return `Registros: ${arr.length}\nTotal acumulado: $${fmt(total)}`;
  }

  private async getIngresosRaw(): Promise<string> {
    const data = await lastValueFrom(this.incomesService.getIncomesxroot(this.idCompany));
    const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (!arr.length) return '';
    const total = arr.reduce((s, e) => s + (Number(e.total ?? e.importe ?? e.amount) || 0), 0);
    const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    return `Registros: ${arr.length}\nTotal acumulado: $${fmt(total)}`;
  }

  private async getCitasRaw(): Promise<string> {
    const data = await lastValueFrom(this.agendaService.getSemana(this.idCompany));
    if (!data?.length) return '';
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-MX', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    return data.slice(0, 8)
      .map((c: any) => `${c.titulo ?? 'Cita'} — ${c.fechaHora ? fmt(c.fechaHora) : ''} (${c.tipo ?? ''})`)
      .join('\n');
  }
}
