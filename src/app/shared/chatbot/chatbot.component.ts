import { AfterViewChecked, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { AgendaService } from 'app/services/agenda.service';

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
export class ChatbotComponent implements AfterViewChecked {
  private incomesService = inject(IncomesAndExpensesService);
  private cashService    = inject(CashRegistersService);
  private agendaService  = inject(AgendaService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  isOpen    = false;
  inputText = '';
  messages: ChatMessage[] = [
    { role: 'bot', text: 'Hola! Soy tu asistente BI.\n\nEscribe: saldos, gastos, ingresos, citas o ayuda' },
  ];

  get isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  private get idCompany(): number {
    return Number(localStorage.getItem('company') || 0);
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.send();
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text) return;

    this.messages.push({ role: 'user', text });
    this.inputText = '';

    const loadingMsg: ChatMessage = { role: 'bot', text: '', loading: true };
    this.messages.push(loadingMsg);

    const response = await this.processCommand(text.toLowerCase());

    const idx = this.messages.indexOf(loadingMsg);
    if (idx !== -1) this.messages[idx] = { role: 'bot', text: response };
  }

  private async processCommand(text: string): Promise<string> {
    if (this.matchesAny(text, ['ayuda', 'help', 'comando', 'que puedes']))
      return this.getHelp();
    if (this.matchesAny(text, ['saldo', 'caja', 'efectivo', 'banco']))
      return await this.getSaldos();
    if (this.matchesAny(text, ['gasto', 'egreso']))
      return await this.getGastos();
    if (this.matchesAny(text, ['ingreso', 'venta', 'cobro']))
      return await this.getIngresos();
    if (this.matchesAny(text, ['cita', 'agenda', 'reunion', 'visita', 'llamada', 'demo']))
      return await this.getCitas();
    return 'No entendí la consulta.\n\nEscribe ayuda para ver los comandos disponibles.';
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }

  private getHelp(): string {
    return (
      'Comandos disponibles:\n\n' +
      '• saldos — Saldos de cajas\n' +
      '• gastos — Egresos registrados\n' +
      '• ingresos — Ingresos / ventas\n' +
      '• citas — Agenda de la semana\n' +
      '• ayuda — Esta pantalla'
    );
  }

  private async getSaldos(): Promise<string> {
    try {
      const data = await lastValueFrom(this.cashService.getCashRegisterByCompany(this.idCompany));
      const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
      if (!arr.length) return 'No hay cajas registradas para esta empresa.';
      const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
      const total = arr.reduce((s, c) => s + (c.balance ?? c.saldo ?? 0), 0);
      const lines = arr
        .map(c => `  • ${c.name ?? c.nombre ?? 'Caja'}: $${fmt(c.balance ?? c.saldo ?? 0)}`)
        .join('\n');
      return `Saldos de cajas:\n${lines}\n\nTotal: $${fmt(total)}`;
    } catch {
      return 'Error al obtener saldos. Verifica tu conexión.';
    }
  }

  private async getGastos(): Promise<string> {
    try {
      const data = await lastValueFrom(this.incomesService.getExpensesxroot(this.idCompany));
      const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
      if (!arr.length) return 'No hay egresos registrados.';
      const total = arr.reduce((s, e) => s + (e.total ?? e.importe ?? e.amount ?? 0), 0);
      const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
      return `Egresos registrados: ${arr.length}\nTotal acumulado: $${fmt(total)}`;
    } catch {
      return 'Error al obtener egresos.';
    }
  }

  private async getIngresos(): Promise<string> {
    try {
      const data = await lastValueFrom(this.incomesService.getIncomesxroot(this.idCompany));
      const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
      if (!arr.length) return 'No hay ingresos registrados.';
      const total = arr.reduce((s, e) => s + (e.total ?? e.importe ?? e.amount ?? 0), 0);
      const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
      return `Ingresos registrados: ${arr.length}\nTotal acumulado: $${fmt(total)}`;
    } catch {
      return 'Error al obtener ingresos.';
    }
  }

  private async getCitas(): Promise<string> {
    try {
      const data = await lastValueFrom(this.agendaService.getSemana(this.idCompany));
      if (!data?.length) return 'No hay citas esta semana.';
      const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString('es-MX', {
          weekday: 'short', day: '2-digit', month: 'short',
          hour: '2-digit', minute: '2-digit',
        });
      const shown = data.slice(0, 5);
      const lines = shown
        .map((c: any) => `  • ${c.titulo ?? 'Cita'} — ${c.fechaHora ? fmt(c.fechaHora) : ''}`)
        .join('\n');
      const extra = data.length > 5 ? `\n  ...y ${data.length - 5} más` : '';
      return `Próximas ${shown.length} citas:\n${lines}${extra}`;
    } catch {
      return 'Error al obtener agenda.';
    }
  }
}
