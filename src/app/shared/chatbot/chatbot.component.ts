import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { AgendaService } from 'app/services/agenda.service';
import { ProjectsService } from 'app/services/projects.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { DailyReportService } from 'app/services/daily-report.service';
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
  private incomesService  = inject(IncomesAndExpensesService);
  private adminService    = inject(AdministrationService);
  private agendaService   = inject(AgendaService);
  private projectsService    = inject(ProjectsService);
  private workprogramService    = inject(WorkprogramsService);
  private followprojectsService = inject(FollowprojectsService);
  private dailyReportService    = inject(DailyReportService);

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
      fetch(
        this.matchesAny(text, ['proyecto', 'obra', 'contrato', 'cuantos proyecto', 'mis proyecto', 'proyectos activos']),
        'PROYECTOS', () => this.getProyectosRaw()
      ),
      fetch(
        this.matchesAny(text, ['atrasad', 'retraso', 'vencid', 'pendiente', 'actividad', 'actividades']),
        'ACTIVIDADES ATRASADAS', () => this.getActividadesAtrasadasRaw()
      ),
      fetch(
        this.matchesAny(text, ['avance', 'progreso', 'porcentaje', 'adelantado', 'cumplimiento', 'avanzado']),
        'AVANCE PROYECTOS', () => this.getAvanceProyectosRaw()
      ),
      fetch(
        this.matchesAny(text, ['contrato', 'cartera', 'monto', 'importe contrato', 'contratos activos']),
        'CONTRATOS', () => this.getContratosRaw()
      ),
      fetch(
        this.matchesAny(text, ['campo', 'reporte', 'ayer', 'hoy se hizo', 'reportó', 'reportado', 'diario', 'semana']),
        'REPORTE CAMPO', () => this.getReporteCampoRaw()
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
      prompt += `\n\nDatos actuales de la empresa:\n\n${dataContext}\n\nUsa estos datos para responder con precisión.`;
    }
    return prompt;
  }

  private async callGemini(userMessage: string, dataContext: string): Promise<string> {
    const apiKey = (environment as any).geminiApiKey;
    if (!apiKey) return 'Falta configurar geminiApiKey en environment.ts.\nObtén tu clave en: https://console.groq.com';

    // Historial en formato OpenAI (compatible con Groq)
    this.geminiHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    if (this.geminiHistory.length > 20) this.geminiHistory = this.geminiHistory.slice(-20);

    const messages = [
      { role: 'system', content: this.buildSystemPrompt(dataContext) },
      ...this.geminiHistory.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.parts[0]?.text ?? '',
      })),
    ];

    const body = { model: 'llama-3.3-70b-versatile', messages, temperature: 0.7 };

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message ?? `HTTP ${res.status}`;
        return `Error: ${msg}`;
      }
      const text: string = data?.choices?.[0]?.message?.content ?? 'Sin respuesta.';
      this.geminiHistory.push({ role: 'model', parts: [{ text }] });
      return text;
    } catch (err: any) {
      return `Error: ${err?.message ?? 'Sin conexión.'}`;
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

  private async getActividadesAtrasadasRaw(): Promise<string> {
    const data = await lastValueFrom(this.workprogramService.getDelayedActivities(this.idCompany));
    const total: number = data?.total ?? data?.Total ?? 0;
    const lista: any[]  = data?.actividades ?? data?.Actividades ?? [];
    if (!total) return 'No hay actividades atrasadas.';

    const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const lines = lista.slice(0, 10).map((a: any) =>
      `• [${a.daysLate ?? a.DaysLate ?? 0} días] ${a.projectName ?? a.ProjectName} — ${a.description ?? a.Description} (fin: ${fmt(a.endDate ?? a.EndDate)})`
    ).join('\n');
    const resto = total > 10 ? `\n...y ${total - 10} más` : '';
    return `Total atrasadas: ${total}\n${lines}${resto}`;
  }

  private async getReporteCampoRaw(): Promise<string> {
    const dias = 7;
    const data = await lastValueFrom(this.dailyReportService.getResumenCampo(this.idCompany, dias));
    const total: number    = data?.totalReportes ?? data?.TotalReportes ?? 0;
    const porDia: any[]    = data?.porDia        ?? data?.PorDia        ?? [];
    if (!total) return 'Sin reportes de campo en los últimos 7 días.';

    const fmtFecha = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
    const fmtMx   = (n: number)   => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const lineas = porDia.slice(0, 7).map((d: any) => {
      const proyectos = (d.proyectos ?? d.Proyectos ?? []).join(', ');
      return `• ${fmtFecha(d.fecha ?? d.Fecha)}: ${d.reportes ?? d.Reportes} reportes | ${fmtMx(d.totalPay ?? d.TotalPay)} | Proyectos: ${proyectos || 'N/D'}`;
    }).join('\n');

    return `Reportes de campo (últimos ${dias} días): ${total} en total\n${lineas}`;
  }

  private async getAvanceProyectosRaw(): Promise<string> {
    const data = await lastValueFrom(this.workprogramService.getAvanceProyectos(this.idCompany));
    const promedio: number    = data?.promedioGlobal ?? data?.PromedioGlobal ?? 0;
    const total: number       = data?.totalProyectos ?? data?.TotalProyectos ?? 0;
    const atrasados: any[]    = data?.masAtrasados   ?? data?.MasAtrasados   ?? [];
    const avanzados: any[]    = data?.masAvanzados   ?? data?.MasAvanzados   ?? [];
    if (!total) return '';

    const fmtProy = (p: any) => `  • ${p.projectName ?? p.ProjectName} — ${p.avancePct ?? p.AvancePct}% (${p.totalActividades ?? p.TotalActividades} activ.)`;
    const bloqAtras  = atrasados.length ? `\nMenos avanzados:\n${atrasados.map(fmtProy).join('\n')}` : '';
    const bloqAvanz  = avanzados.length ? `\nMás avanzados:\n${avanzados.map(fmtProy).join('\n')}` : '';
    return `Avance global: ${promedio}% (${total} proyectos)${bloqAtras}${bloqAvanz}`;
  }

  private async getContratosRaw(): Promise<string> {
    const data = await lastValueFrom(this.followprojectsService.getContract(-this.idCompany));
    const arr: any[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
    if (!arr.length) return '';

    const activos   = arr.filter(c => c.active === 1 || c.active === true);
    const ejecucion = activos.filter(c => (c.statecontract ?? '').toLowerCase().includes('ejecuci'));
    const fmtMx = (n: number) => n ? `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 })}` : '';
    const totalMx   = activos.reduce((s, c) => s + (Number(c.amountmx) || 0), 0);
    const totalDll  = activos.reduce((s, c) => s + (Number(c.amountdll) || 0), 0);
    const lista     = ejecucion.slice(0, 8).map(c =>
      `• ${c.descripsmall ?? c.description ?? c.contract} — ${c.statecontract} ${c.amountmx ? '(' + fmtMx(c.amountmx) + ' MXN)' : ''}`
    ).join('\n');
    const resto = ejecucion.length > 8 ? `\n...y ${ejecucion.length - 8} más` : '';
    return `Total contratos activos: ${activos.length}\nEn ejecución: ${ejecucion.length}\nCartera MXN: ${fmtMx(totalMx)}${totalDll ? ' | USD: $' + Number(totalDll).toLocaleString('es-MX') : ''}\n${lista}${resto}`;
  }

  private async getProyectosRaw(): Promise<string> {
    const data = await lastValueFrom(this.projectsService.getProjectListByCompany(this.idCompany));
    const arr: any[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
    if (!arr.length) return '';

    const activos   = arr.filter(p => p.active === 1 || p.active === true);
    const ejecucion = activos.filter(p => (p.state ?? '').toLowerCase().includes('ejecucion'));
    const nombres   = ejecucion.slice(0, 10).map(p => `• ${p.name ?? p.number ?? 'Sin nombre'}`).join('\n');
    const resto     = ejecucion.length > 10 ? `\n...y ${ejecucion.length - 10} más` : '';

    return `Total proyectos activos: ${activos.length}\nEn ejecución: ${ejecucion.length}\n${nombres}${resto}`;
  }
}
