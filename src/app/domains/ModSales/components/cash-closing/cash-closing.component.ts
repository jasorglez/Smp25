import { Component, OnInit, inject } from '@angular/core';

interface CajaGroup {
  idCashRegister: number;
  desc: string;
  rows: ResumenPorCaja[];
  subtotal: number;
}

interface StoreGroup {
  idStore: number;
  storeName: string;
  cajas: CajaGroup[];
  storeTotal: number;
}
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';
import { StoresService } from 'app/services/stores.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { CashClosingService, CorteResumen, MovimientoCaja, CorteDeCaja, ResumenPorCaja } from 'app/services/cash-closing.service';
import { forkJoin } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { PosDbService, PosSession } from 'app/services/pos-db.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-cash-closing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule],
  templateUrl: './cash-closing.component.html',
})
export class CashClosingComponent implements OnInit {
  private storesService        = inject(StoresService);
  private cashRegistersService = inject(CashRegistersService);
  private cashClosingService   = inject(CashClosingService);
  private signalsService   = inject(SignalsService);
  private posDb            = inject(PosDbService);
  private router           = inject(Router);

  // Selectores supervisor
  stores: any[]        = [];
  cashRegisters: any[] = [];
  selectedStoreId: number | null        = null;
  selectedCashRegisterId: number | null = null;

  // Fecha — por defecto hoy
  dateFrom = this.todayStr();
  dateTo   = this.todayStr();

  // Sesión activa en este dispositivo (badge informativo)
  activeSession: PosSession | null = null;

  // Estado
  loading  = false;
  saving   = false;
  consulted = false;
  errorMsg = '';

  // Datos
  resumen: CorteResumen[]    = [];
  movimientos: MovimientoCaja[] = [];

  // Totales
  totalEfectivo = 0;
  totalCheque   = 0;
  totalVales    = 0;
  totalTarjeta  = 0;
  totalVentas   = 0;
  numVentas     = 0;
  totalRetiros  = 0;
  apertura      = 0;

  // Retiro inline
  showRetiroForm = false;
  nuevoRetiro    = { monto: 0, descripcion: '' };

  // Corte
  cajero       = '';
  observaciones = '';

  // Vista consolidada por empresa
  activeTab: 'corte' | 'general' = 'general';
  resumenEmpresa: ResumenPorCaja[] = [];
  loadingGeneral = false;
  consultedGeneral = false;
  dateFromGeneral = this.todayStr();
  dateToGeneral   = this.todayStr();

  get saldoFinal(): number {
    return this.apertura + this.totalEfectivo - this.totalRetiros;
  }

  async ngOnInit() {
    this.activeSession = await this.posDb.getSession();
    this.loadStores();
  }

  private loadStores() {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.storesService.getStoreCompany(idCompany).subscribe({
      next: (data: any[]) => {
        this.stores = data.filter(s => s.active);
        // Si hay sesión activa, preseleccionar su tienda y caja
        if (this.activeSession) {
          this.selectedStoreId = this.activeSession.idStore;
          this.onStoreChange(this.stores.find(s => s.id === this.activeSession!.idStore));
        }
      },
      error: () => this.errorMsg = 'No se pudieron cargar las tiendas.',
    });
  }

  onStoreChange(store: any) {
    this.selectedCashRegisterId = null;
    this.cashRegisters = [];
    this.consulted = false;
    if (!store) return;
    this.cashRegistersService.getCashRegisterList(store.id).subscribe({
      next: (data: any[]) => {
        this.cashRegisters = data.filter(c => c.active);
        if (this.activeSession) {
          this.selectedCashRegisterId = this.activeSession.idCashRegister;
        }
      },
    });
  }

  async consultar() {
    if (!this.selectedCashRegisterId) return;
    this.loading  = true;
    this.consulted = false;
    this.errorMsg = '';
    try {
      const [resumen, movimientos] = await Promise.all([
        firstValueFrom(this.cashClosingService.getResumen(
          this.selectedCashRegisterId,
          this.dateFrom,
          this.dateTo,
        )),
        firstValueFrom(this.cashClosingService.getMovimientos(this.selectedCashRegisterId)),
      ]);
      this.resumen     = resumen;
      this.movimientos = movimientos;
      this.calcularTotales();
      this.consulted = true;
    } catch {
      this.errorMsg = 'No se pudieron cargar los datos. Verifica tu conexión.';
    } finally {
      this.loading = false;
    }
  }

  private calcularTotales() {
    this.totalEfectivo = this.totalCheque = this.totalVales = this.totalTarjeta = 0;
    this.totalVentas   = this.numVentas   = 0;

    for (const r of this.resumen) {
      this.totalVentas += r.total;
      this.numVentas   += r.numVentas;
      switch (r.paymentType) {
        case 'EFECTIVO': this.totalEfectivo += r.total; break;
        case 'CHEQUE':   this.totalCheque   += r.total; break;
        case 'VALES':    this.totalVales    += r.total; break;
        case 'TARJETA':  this.totalTarjeta  += r.total; break;
      }
    }

    this.apertura = this.movimientos
      .filter(m => m.tipo === 'APERTURA')
      .reduce((s, m) => s + m.monto, 0);

    this.totalRetiros = this.movimientos
      .filter(m => m.tipo === 'RETIRO')
      .reduce((s, m) => s + m.monto, 0);
  }

  async agregarRetiro() {
    if (!this.selectedCashRegisterId || !this.nuevoRetiro.monto || this.nuevoRetiro.monto <= 0) return;
    this.saving = true;
    try {
      await firstValueFrom(this.cashClosingService.saveMovimiento({
        idCashRegister: this.selectedCashRegisterId,
        tipo: 'RETIRO',
        monto: this.nuevoRetiro.monto,
        descripcion: this.nuevoRetiro.descripcion,
        cajero: this.cajero,
      }));
      this.nuevoRetiro   = { monto: 0, descripcion: '' };
      this.showRetiroForm = false;
      await this.consultar();
    } catch {
      this.errorMsg = 'Error al registrar el retiro.';
    } finally {
      this.saving = false;
    }
  }

  async realizarCorte() {
    if (!this.selectedCashRegisterId || !this.selectedStoreId) return;

    const result = await alerts.confirmAlert(
      '¿Realizar corte de caja?',
      'Se guardará el resumen del turno. Si hay sesión activa en este dispositivo también se cerrará.',
      'warning',
      'Sí, realizar corte',
    );
    if (!result.isConfirmed) return;

    this.saving = true;
    try {
      const corte: CorteDeCaja = {
        idCashRegister: this.selectedCashRegisterId,
        idStore: this.selectedStoreId,
        fechaApertura: this.dateFrom,
        apertura: this.apertura,
        totalEfectivo: this.totalEfectivo,
        totalCheque: this.totalCheque,
        totalVales: this.totalVales,
        totalTarjeta: this.totalTarjeta,
        totalRetiros: this.totalRetiros,
        totalVentas: this.totalVentas,
        saldoFinal: this.saldoFinal,
        numVentas: this.numVentas,
        cajero: this.cajero,
        observaciones: this.observaciones,
      };

      await firstValueFrom(this.cashClosingService.saveCorte(corte));

      // Si la sesión activa es de esta misma caja, la cerramos
      if (this.activeSession?.idCashRegister === this.selectedCashRegisterId) {
        await this.posDb.clearSession();
        this.activeSession = null;
      }

      alerts.basicAlert('Corte registrado', 'El corte de caja se guardó correctamente.', 'success');
      this.consulted = false;
      this.resumen   = [];
    } catch {
      this.errorMsg = 'Error al guardar el corte. Intenta de nuevo.';
    } finally {
      this.saving = false;
    }
  }

  async consultarGeneral() {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;
    this.loadingGeneral  = true;
    this.consultedGeneral = false;
    this.errorMsg = '';
    try {
      // 1. Tiendas y cajas de la empresa (endpoints existentes)
      const [allStores, allCashRegisters] = await Promise.all([
        firstValueFrom(this.storesService.getStoreCompany(idCompany)),
        firstValueFrom(this.cashRegistersService.getCashRegisterByCompany(idCompany)),
      ]);

      const stores: any[]        = (allStores        || []).filter((s: any) => s.active);
      // La vista CashRegisterXBranchs no tiene campo active — no filtrar por él
      const cashRegisters: any[] = (allCashRegisters || []);

      if (cashRegisters.length === 0) {
        this.resumenEmpresa   = [];
        this.consultedGeneral = true;
        return;
      }

      // 2. Resumen por caja en paralelo (un call por caja, todos a la vez)
      // El campo ID de la caja es idCaja (no id) — viene de la vista CashRegisterXBranchs
      const resumenCalls = cashRegisters.map((cr: any) =>
        this.cashClosingService.getResumen(cr.idCaja, this.dateFromGeneral, this.dateToGeneral)
      );

      const resultados = await firstValueFrom(forkJoin(resumenCalls));

      // 3. Aplanar en ResumenPorCaja[]
      const rows: ResumenPorCaja[] = [];
      cashRegisters.forEach((cr: any, i: number) => {
        const resumenCaja: CorteResumen[] = (resultados[i] as CorteResumen[]) || [];
        for (const r of resumenCaja) {
          rows.push({
            idStore:          cr.idStore               ?? 0,
            storeName:        cr.description           ?? `Tienda ${cr.idStore}`,
            idCashRegister:   cr.idCaja                ?? 0,
            cashRegisterDesc: cr.descCashRegister      ?? `Caja ${cr.idCaja}`,
            paymentType:      r.paymentType,
            numVentas:        r.numVentas,
            total:            r.total,
          });
        }
      });

      this.resumenEmpresa   = rows;
      this.consultedGeneral = true;
    } catch {
      this.errorMsg = 'No se pudo cargar el resumen. Verifica tu conexión.';
    } finally {
      this.loadingGeneral = false;
    }
  }

  // Agrupa resumenEmpresa por tienda para el template
  get storeGroups(): StoreGroup[] {
    const map = new Map<number, { idStore: number; storeName: string; cajas: Map<number, CajaGroup> }>();
    for (const r of this.resumenEmpresa) {
      if (!map.has(r.idStore)) {
        map.set(r.idStore, { idStore: r.idStore, storeName: r.storeName, cajas: new Map() });
      }
      const store = map.get(r.idStore)!;
      if (!store.cajas.has(r.idCashRegister)) {
        store.cajas.set(r.idCashRegister, { idCashRegister: r.idCashRegister, desc: r.cashRegisterDesc, rows: [], subtotal: 0 });
      }
      const caja = store.cajas.get(r.idCashRegister)!;
      caja.rows.push(r);
      caja.subtotal += r.total;
    }
    return Array.from(map.values()).map(s => {
      const cajas = Array.from(s.cajas.values());
      const storeTotal = cajas.reduce((sum, c) => sum + c.subtotal, 0);
      return { ...s, cajas, storeTotal };
    });
  }

  get grandTotal(): number { return this.resumenEmpresa.reduce((s, r) => s + r.total, 0); }
  get grandTickets(): number { return this.resumenEmpresa.reduce((s, r) => s + r.numVentas, 0); }

  formatCurrency(v: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
  }

  getPaymentLabel(type: string): string {
    return ({ EFECTIVO: 'Efectivo', CHEQUE: 'Cheque', VALES: 'Vales/Cupones', TARJETA: 'Tarjeta' })[type] ?? type;
  }

  getPaymentIcon(type: string): string {
    return ({ EFECTIVO: 'bi-cash-coin', CHEQUE: 'bi-file-earmark-text', VALES: 'bi-ticket-perforated', TARJETA: 'bi-credit-card' })[type] ?? 'bi-question';
  }

  private todayStr(): string {
    return new Date().toISOString().substring(0, 10);
  }

  get retiros() { return this.movimientos.filter(m => m.tipo === 'RETIRO'); }
}
