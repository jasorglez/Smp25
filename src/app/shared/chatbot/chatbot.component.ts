import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { AgendaService } from 'app/services/agenda.service';
import { ProjectsService } from 'app/services/projects.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { ContractsService } from 'app/services/contracts.service';
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
  private incomesService        = inject(IncomesAndExpensesService);
  private adminService          = inject(AdministrationService);
  private agendaService         = inject(AgendaService);
  private projectsService       = inject(ProjectsService);
  private workprogramService    = inject(WorkprogramsService);
  private followprojectsService = inject(FollowprojectsService);
  private dailyReportService    = inject(DailyReportService);
  private otService             = inject(OtService);
  private signalsService        = inject(SignalsService);
  private contractService       = inject(ContractsService);
  private http                  = inject(HttpClient);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  isOpen      = false;
  inputText   = '';
  generalMode = false;
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

  toggleGeneralMode(): void {
    this.generalMode = !this.generalMode;
    const msg = this.generalMode
      ? 'Modo libre activado. Puedo responder cualquier pregunta de conocimiento general.'
      : 'Modo negocio activado. Solo respondo sobre datos de tu empresa.';
    this.messages.push({ role: 'bot', text: msg });
    this.scrollToBottom();
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
      try {
        const d = await fn();
        parts.push(`${label}:\n${d || 'Sin datos disponibles'}`);
      } catch {
        parts.push(`${label}:\nError al obtener datos — no disponible`);
      }
    };

    const isSidebarQuery = this.matchesAny(text, [
      'proyecto', 'obra', 'contrato', 'convenio', 'convencion', 'sucursal',
      'cuantos proyecto', 'mis proyecto', 'proyectos activos', 'contratos activos',
    ]);

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
        this.matchesAny(text, ['atrasad', 'retraso', 'vencid', 'pendiente', 'actividad', 'actividades']),
        'ACTIVIDADES ATRASADAS', () => this.getActividadesAtrasadasRaw()
      ),
      fetch(
        this.matchesAny(text, ['avance', 'progreso', 'porcentaje', 'adelantado', 'cumplimiento', 'avanzado']),
        'AVANCE PROYECTOS', () => this.getAvanceProyectosRaw()
      ),
      fetch(
        this.matchesAny(text, ['campo', 'reporte', 'ayer', 'hoy se hizo', 'reportó', 'reportado', 'diario', 'semana']),
        'REPORTE CAMPO', () => this.getReporteCampoRaw()
      ),
      fetch(
        this.matchesAny(text, ['ot', 'orden de trabajo', 'ordenes', 'folio', 'reconexion', 'servicio']),
        'ÓRDENES DE TRABAJO (OTs)', () => this.getOTsRaw()
      ),
      // Contexto sidebar — snapshot sin llamada a DB
      fetch(
        isSidebarQuery,
        'CONTEXTO ACTUAL (Empresa → Sucursal → Contrato → Proyecto → Convenio)',
        async () => this.getSidebarCtxText()
      ),
      // Contratos de la sucursal seleccionada
      fetch(
        this.matchesAny(text, ['contrato', 'cartera', 'monto', 'importe contrato', 'contratos activos']),
        'CONTRATOS DE LA SUCURSAL', () => this.getContratosxSucursalRaw()
      ),
      // Proyectos del contrato seleccionado
      fetch(
        this.matchesAny(text, ['proyecto', 'obra', 'cuantos proyecto', 'mis proyecto', 'proyectos activos']),
        'PROYECTOS DEL CONTRATO', () => this.getProyectosxContratoRaw()
      ),
      // Convenio vigente del contrato seleccionado
      fetch(
        this.matchesAny(text, ['convenio', 'convencion', 'vigente', 'vigor']),
        'CONVENIO VIGENTE', async () => this.getConvenioRaw()
      ),
      // Noticias en tiempo real via GNews
      fetch(
        this.matchesAny(text, ['noticia', 'noticias', 'news', 'última hora', 'que paso', 'qué pasó']),
        'NOTICIAS', () => this.getNoticiasRaw(text)
      ),
    ]);

    return parts.join('\n\n');
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }

  // ── Llamada a Gemini API ────────────────────────────────────────────────

  private buildSystemPrompt(dataContext: string): string {
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const reglasNegocio = `
REGLAS PARA DATOS DEL NEGOCIO — NO NEGOCIABLES:
1. NUNCA inventes datos, proyectos, nombres, cantidades ni fechas del negocio. Si no hay datos reales en el contexto del sistema, di "No tengo esa información disponible en este momento."
2. Si el contexto dice "Sin reportes", "Sin datos" o "Error al obtener", responde exactamente eso.
3. Solo reporta datos del negocio que estén explícitamente en el contexto proporcionado.`;

    const reglaModo = this.generalMode
      ? `\nMODO LIBRE ACTIVADO: Puedes responder libremente sobre conocimiento general (noticias, cultura, ciencia, geografía, historia, etc.) usando tu conocimiento de entrenamiento. Si la información puede estar desactualizada por tu fecha de corte, avísalo brevemente.`
      : `\n4. Si la pregunta NO está relacionada con el negocio, responde SOLO: "Solo puedo ayudarte con información de tu empresa: saldos, gastos, ingresos, contratos, proyectos, convenios, OTs, agenda y reportes de campo."`;

    let prompt = `Eres el asistente BI de la empresa. Hoy es ${fecha}, son las ${hora} (hora local). Usa la hora real para saludar: buenos días (6-12h), buenas tardes (12-19h), buenas noches (19-6h). Responde siempre en español, de forma concisa, amigable y profesional. Máximo 4 líneas salvo que el usuario pida detalle.
${reglasNegocio}${reglaModo}`;

    if (dataContext) {
      prompt += `\n\nDatos actuales del sistema (ÚSALOS TAL CUAL para preguntas del negocio):\n\n${dataContext}`;
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

    const body = { model: 'llama-3.3-70b-versatile', messages, temperature: 0.1 };

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

  private async getOTsRaw(): Promise<string> {
    const data = await lastValueFrom(this.otService.getOtAllt(this.idCompany));
    const arr: any[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
    if (!arr.length) return '';

    const abiertas  = arr.filter(o => !o.closed && !o.closedApp && !o.Closed && !o.ClosedApp);
    const cerradas  = arr.filter(o =>  o.closed  ||  o.closedApp ||  o.Closed ||  o.ClosedApp);

    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    const ayer  = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    const recientes = arr
      .filter(o => { const d = new Date(o.date ?? o.Date ?? 0); return d >= ayer; })
      .slice(0, 8);

    const porArea: Record<string, number> = arr.reduce((acc: Record<string, number>, o) => {
      const a: string = o.area ?? o.Area ?? 'Sin área';
      acc[a] = (acc[a] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topAreas = (Object.entries(porArea) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area, cnt]) => `  ${area}: ${cnt}`)
      .join('\n');

    const recientesStr = recientes.length
      ? '\nRecientes (hoy/ayer):\n' + recientes.map(o =>
          `  • OT ${o.otNumber ?? o.OtNumber ?? o.ot_number ?? ''} — ${o.area ?? o.Area ?? ''} | ${o.description ?? o.Description ?? ''}`
        ).join('\n')
      : '';

    return `OTs totales: ${arr.length} | Abiertas: ${abiertas.length} | Cerradas: ${cerradas.length}\nPor tipo:\n${topAreas}${recientesStr}`;
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

  // ── Sidebar context (snapshot de signals, sin llamada a DB) ───────────────

  private getSidebarCtxText(): string {
    const empresa   = this.signalsService.getCompanyName()() ?? '';
    const sucursal  = this.signalsService.getBranchNameSelectedBySidebar()() ?? '';
    const contratoId = this.signalsService.getContractSelectedBySidebar()();
    const contratoNombre = this.signalsService.nameContract() ?? '';
    const proyecto  = this.signalsService.getProjectNameBySidebar()() ?? '';
    const convenio  = this.signalsService.getConventionVigente()();
    return [
      empresa         ? `Empresa: ${empresa}`                                        : '',
      sucursal        ? `Sucursal: ${sucursal}`                                      : '',
      contratoId      ? `Contrato: ${contratoNombre || '—'} (ID: ${contratoId})`     : 'Sin contrato seleccionado',
      proyecto        ? `Proyecto: ${proyecto}`                                       : 'Sin proyecto seleccionado',
      convenio?.name  ? `Convenio vigente: ${convenio.name}`                         : 'Sin convenio vigente',
    ].filter(Boolean).join('\n');
  }

  private getConvenioRaw(): string {
    const v = this.signalsService.getConventionVigente()();
    return v?.name
      ? `Convenio vigente: ${v.name}`
      : 'No hay convenio vigente para el contrato seleccionado.';
  }

  // ── Contratos de la sucursal actual ────────────────────────────────────────

  private async getContratosxSucursalRaw(): Promise<string> {
    const branchId = this.signalsService.getBranchSelectedBySidebar()();
    if (!branchId || branchId < 0) return 'No hay sucursal seleccionada.';
    const data = await lastValueFrom(
      this.contractService.getContractsByBranch(this.signalsService.idUser(), branchId)
    );
    const arr: any[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
    if (!arr.length) return 'Sin contratos para esta sucursal.';
    const sucursal = this.signalsService.getBranchNameSelectedBySidebar()() ?? 'sucursal';
    const lines = arr.slice(0, 10)
      .map(c => `• ${c.contract ?? c.description ?? 'Contrato'} — ${c.statecontract ?? c.state ?? ''}`)
      .join('\n');
    const resto = arr.length > 10 ? `\n...y ${arr.length - 10} más` : '';
    return `Contratos en ${sucursal} (${arr.length}):\n${lines}${resto}`;
  }

  // ── Proyectos del contrato actual ──────────────────────────────────────────

  private async getProyectosxContratoRaw(): Promise<string> {
    const contractId = this.signalsService.getContractSelectedBySidebar()();
    if (!contractId) return 'No hay contrato seleccionado.';
    const data = await lastValueFrom(
      this.projectsService.getProjectsByContract(this.signalsService.idUser(), contractId)
    );
    const arr: any[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
    if (!arr.length) return 'Sin proyectos para este contrato.';
    const contrato = this.signalsService.nameContract() ?? `contrato ${contractId}`;
    const lines = arr.slice(0, 10)
      .map(p => `• ${p.projectName ?? p.name ?? p.number ?? 'Proyecto'}`)
      .join('\n');
    const resto = arr.length > 10 ? `\n...y ${arr.length - 10} más` : '';
    return `Proyectos del ${contrato} (${arr.length}):\n${lines}${resto}`;
  }

  // ── Noticias en tiempo real (GNews API) ────────────────────────────────────

  private extractNewsTopic(text: string): string {
    const patterns = [
      /noticias?\s+(?:de|sobre|en|del?)\s+(.+?)(?:\s+(?:hoy|del?\s+d[ií]a|recientes?))?$/,
      /(?:qu[eé]\s+(?:pas[oó]|pasa|hay)\s+en)\s+(.+?)(?:\s+hoy)?$/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return 'México';
  }

  private async getNoticiasRaw(text: string): Promise<string> {
    const apiKey = (environment as any).gnewsApiKey;
    const topic  = this.extractNewsTopic(text);

    try {
      const params = { q: topic, lang: 'es', country: 'mx', max: '5', apikey: apiKey };
      const data   = await lastValueFrom(
        this.http.get<any>('https://gnews.io/api/v4/search', { params })
      );
      const articles: any[] = data?.articles ?? [];
      if (!articles.length) return `Sin noticias para "${topic}".`;

      const fmt = (iso: string) => iso
        ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';
      return `Noticias sobre "${topic}" (${articles.length}):\n\n` +
        articles.map((a: any, i: number) =>
          `${i + 1}. ${a.title}\n   ${a.description ?? ''}\n   ${a.source?.name ?? ''} — ${fmt(a.publishedAt)}`
        ).join('\n\n');

    } catch (err: any) {
      const status = err?.status ?? '?';
      const detail = err?.error?.errors?.[0] ?? err?.error?.message ?? err?.message ?? 'sin detalle';
      return `Error GNews [HTTP ${status}]: ${detail}`;
    }
  }
}
