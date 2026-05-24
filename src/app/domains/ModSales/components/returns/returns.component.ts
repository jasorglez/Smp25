import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReturnsService } from 'app/services/returns.service';
import { PosTicketService } from 'app/services/pos-ticket.service';
import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

type ReturnMode = 'reimpresion' | 'total' | 'parcial' | 'cambio';

interface ReturnItem {
  idConcept : number;
  description: string;
  quantity  : number;
  maxQty    : number;     // cantidad original en el ticket
  pu        : number;
  total     : number;
  selected  : boolean;
}

@Component({
  selector   : 'app-returns',
  standalone : true,
  imports    : [CommonModule, FormsModule],
  templateUrl: './returns.component.html',
  styleUrl   : './returns.component.scss',
})
export class ReturnsComponent {

  // ── Services ─────────────────────────────────────────────────────────────
  private returnsService = inject(ReturnsService);
  private ticketService  = inject(PosTicketService);
  private posService     = inject(PosService);
  private signalsService = inject(SignalsService);

  // ── Identity ──────────────────────────────────────────────────────────────
  idCompany : number = 0;
  idBranch  : number = 0;

  // ── Search ────────────────────────────────────────────────────────────────
  searchTicket  : string = '';
  searching     : boolean = false;
  searchError   : string = '';

  // ── Found sale ────────────────────────────────────────────────────────────
  sale          : any = null;  // raw API response
  previousReturns: any[] = [];

  // ── Mode ──────────────────────────────────────────────────────────────────
  activeMode    : ReturnMode = 'reimpresion';

  // ── Return items (parcial / cambio) ───────────────────────────────────────
  returnItems   : ReturnItem[] = [];

  // ── Form fields ───────────────────────────────────────────────────────────
  reason        : string = '';
  approvedBy    : string = '';
  exchangeNote  : string = '';   // Cambio: descripción del nuevo producto

  // ── Processing ────────────────────────────────────────────────────────────
  processing    : boolean = false;

  // ── Config (from posSetup) ────────────────────────────────────────────────
  returnDays       : number  = 30;
  requiresApproval : boolean = false;
  returnToInventory: boolean = true;
  configLoaded     : boolean = false;

  // ─────────────────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()() ?? 0;
      this.idBranch  = this.signalsService.getBranchSelectedBySidebar()() ?? 0;
      this.loadConfig();
    });
  }

  // ─── Config ───────────────────────────────────────────────────────────────
  loadConfig() {
    if (!this.idBranch) return;
    // Pull the first customer's setup for this branch
    this.posService.getPosSetup(this.idBranch, 0).subscribe({
      next: (data: any[]) => {
        if (data?.length) {
          const s = data[0];
          this.returnDays        = s.returnDays        ?? 30;
          this.requiresApproval  = s.requiresApproval  ?? false;
          this.returnToInventory = s.returnToInventory ?? true;
        }
        this.configLoaded = true;
      },
      error: () => { this.configLoaded = true; }
    });
  }

  // ─── Search ───────────────────────────────────────────────────────────────
  searchTicketFn() {
    const ticket = this.searchTicket?.trim().toUpperCase();
    if (!ticket) return;
    if (!this.idCompany) {
      this.searchError = 'Selecciona una empresa desde el menú lateral';
      return;
    }
    this.searching   = true;
    this.searchError = '';
    this.sale        = null;
    this.returnItems = [];

    this.returnsService.getSaleByTicketNumber(ticket, this.idCompany).subscribe({
      next: (data: any) => {
        this.sale            = data;
        this.previousReturns = data.previousReturns ?? [];
        this.searching       = false;
        this.buildReturnItems();
        this.validateReturnAge();
      },
      error: (err) => {
        this.searching   = false;
        this.searchError = err.status === 404
          ? `Ticket "${ticket}" no encontrado.`
          : 'Error al buscar el ticket. Intenta de nuevo.';
      }
    });
  }

  // ─── Validate age (days limit) ────────────────────────────────────────────
  validateReturnAge(): string | null {
    if (!this.sale || this.returnDays === 0) return null;
    const saleDate = new Date(this.sale.date);
    const diffDays = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > this.returnDays) {
      return `Este ticket tiene ${diffDays} días. El límite configurado es ${this.returnDays} días.`;
    }
    return null;
  }

  get ageWarning(): string | null { return this.validateReturnAge(); }

  // ─── Build selectable items ────────────────────────────────────────────────
  buildReturnItems() {
    if (!this.sale?.concepts) { this.returnItems = []; return; }

    // Compute already-returned quantities per concept
    const returnedQty: Record<number, number> = {};
    for (const ret of this.previousReturns) {
      for (const c of (ret.concepts ?? [])) {
        returnedQty[c.idConcept] = (returnedQty[c.idConcept] ?? 0) + Number(c.quantity);
      }
    }

    this.returnItems = this.sale.concepts
      .filter((c: any) => {
        const already = returnedQty[c.id] ?? 0;
        return Number(c.quantity) - already > 0;
      })
      .map((c: any) => {
        const already  = returnedQty[c.id] ?? 0;
        const available = Number(c.quantity) - already;
        return {
          idConcept  : c.id,
          description: c.description || `Prod. ${c.idProduct}`,
          quantity   : available,   // start with full available qty
          maxQty     : available,
          pu         : Number(c.pu),
          total      : available * Number(c.pu),
          selected   : true,
        } as ReturnItem;
      });
  }

  // ─── Item quantity update ─────────────────────────────────────────────────
  onQtyChange(item: ReturnItem) {
    if (item.quantity > item.maxQty) item.quantity = item.maxQty;
    if (item.quantity < 0)          item.quantity = 0;
    item.total = +(item.quantity * item.pu).toFixed(2);
  }

  // ─── Computed total ───────────────────────────────────────────────────────
  get selectedTotal(): number {
    if (this.activeMode === 'total') return Number(this.sale?.amount ?? 0);
    return this.returnItems
      .filter(i => i.selected && i.quantity > 0)
      .reduce((sum, i) => sum + i.total, 0);
  }

  get selectedCount(): number {
    return this.returnItems.filter(i => i.selected && i.quantity > 0).length;
  }

  get allSelected(): boolean { return this.returnItems.every(i => i.selected); }

  toggleAll(val: boolean) {
    this.returnItems.forEach(i => i.selected = val);
  }

  // ─── Mode tab ─────────────────────────────────────────────────────────────
  setMode(m: ReturnMode) {
    this.activeMode = m;
    this.reason     = '';
    this.approvedBy = '';
    this.exchangeNote = '';
    if (m === 'total') {
      this.returnItems.forEach(i => { i.selected = true; i.quantity = i.maxQty; i.total = i.maxQty * i.pu; });
    }
  }

  // ─── Reimpresión ─────────────────────────────────────────────────────────
  async printOriginal() {
    if (!this.sale) return;
    this.processing = true;
    try {
      const concepts = (this.sale.concepts ?? []).map((c: any) => ({
        idProduct  : c.idProduct,
        description: c.description,
        quantity   : Number(c.quantity),
        pu         : Number(c.pu),
      }));
      await this.ticketService.print(
        {
          numbernote  : this.sale.numberNote,
          date        : this.sale.date,
          amount      : Number(this.sale.amount),
          credit      : false,
          lector      : false,
          payment_type: this.sale.paymentType,
        },
        concepts,
        [],
        '',
        '',
        '',
        this.sale.paymentType,
        undefined,
        undefined,
        this.idCompany,
      );
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudo generar el PDF', 'error');
    } finally {
      this.processing = false;
    }
  }

  // ─── Validate before process ──────────────────────────────────────────────
  canProcess(): boolean {
    if (!this.sale) return false;
    if (this.processing) return false;
    if (this.requiresApproval && !this.approvedBy.trim()) return false;
    if (this.activeMode === 'reimpresion') return true;
    if (this.activeMode === 'total') return !!this.reason.trim();
    if (['parcial', 'cambio'].includes(this.activeMode)) {
      return this.selectedCount > 0 && !!this.reason.trim();
    }
    return false;
  }

  // ─── Process return ───────────────────────────────────────────────────────
  async processReturn() {
    if (!this.canProcess()) return;
    const ageWarn = this.ageWarning;
    if (ageWarn) {
      const ok = await this.confirmDialog(`⚠️ ${ageWarn}\n¿Deseas continuar de todos modos?`);
      if (!ok) return;
    }
    this.processing = true;

    const payload: any = {
      idCompany    : this.idCompany,
      idSale       : this.sale.id,
      idCashRegister: this.sale.idCashRegister ?? null,
      returnType   : this.activeMode,
      reason       : this.activeMode === 'cambio'
                       ? `${this.reason} | Cambio por: ${this.exchangeNote}`.trim()
                       : this.reason,
      amount       : this.selectedTotal,
      approvedBy   : this.approvedBy || null,
      concepts     : [],
    };

    if (['parcial', 'cambio'].includes(this.activeMode)) {
      payload.concepts = this.returnItems
        .filter(i => i.selected && i.quantity > 0)
        .map(i => ({
          idConcept  : i.idConcept,
          quantity   : i.quantity,
          pu         : i.pu,
          total      : i.total,
          description: i.description,
        }));
    } else if (this.activeMode === 'total') {
      payload.concepts = this.returnItems.map(i => ({
        idConcept  : i.idConcept,
        quantity   : i.maxQty,
        pu         : i.pu,
        total      : i.maxQty * i.pu,
        description: i.description,
      }));
    }

    this.returnsService.createReturn(payload).subscribe({
      next: async (res) => {
        // Print return receipt
        try {
          await this.ticketService.printReturn({
            originalTicket: this.sale.numberNote,
            returnType    : this.activeMode,
            reason        : payload.reason,
            amount        : this.selectedTotal,
            date          : new Date(),
            storeName     : '',
            items         : this.activeMode === 'reimpresion' ? [] : payload.concepts.map((c: any) => ({
              description: c.description,
              quantity   : c.quantity,
              pu         : c.pu,
              total      : c.total,
            })),
            approvedBy: this.approvedBy || undefined,
            idCompany : this.idCompany,
          });
        } catch { /* si falla el print no bloquear */ }

        this.processing = false;
        const typeMsg: Record<string, string> = {
          total  : 'Devolución total procesada',
          parcial: 'Devolución parcial procesada',
          cambio : 'Cambio registrado',
        };
        alerts.basicAlert('✅ Éxito', typeMsg[this.activeMode] ?? 'Procesado', 'success');
        // Reload to show updated state
        this.sale = null;
        this.returnItems = [];
        this.searchTicket = '';
        this.reason = '';
        this.approvedBy = '';
        this.exchangeNote = '';
      },
      error: (err) => {
        this.processing = false;
        alerts.basicAlert('Error', 'No se pudo procesar la devolución. Intenta de nuevo.', 'error');
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private confirmDialog(msg: string): Promise<boolean> {
    return new Promise(resolve => resolve(window.confirm(msg)));
  }

  fmtDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  fmtMXN(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
  }

  typeLabel(t: string): string {
    const map: Record<string, string> = {
      total: 'Dev. Total', parcial: 'Dev. Parcial',
      cambio: 'Cambio', reimpresion: 'Reimpresión',
    };
    return map[t] ?? t;
  }
}
