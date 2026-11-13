import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';

interface DueRow { customerId: number; customer: string; loanId: number; installment: number; due: string; amount: number; paid: number; balance: number; days: number; }

@Component({
  selector: 'app-cobranza-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NgApexchartsModule],
  templateUrl: './cobranza-dashboard.component.html',
  styleUrl: './cobranza-dashboard.component.scss'
})
export class CobranzaDashboardComponent {
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  rootId = 0;
  loading = false;
  error = '';
  loans: any[] = [];
  rows: DueRow[] = [];
  totalLoaned = 0;
  totalCollected = 0;
  totalBalance = 0;
  overdue = 0;
  dueThisMonth = 0;
  dueNextSeven = 0;
  collectedThisMonth = 0;
  activeCustomers = 0;
  recoveryRate = 0;
  monthlySeries: any[] = [];
  monthlyCategories: string[] = [];
  portfolioSeries: number[] = [];
  portfolioLabels = ['Cobrado', 'Vencido', 'Por vencer'];
  monthlyChart: any = { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'inherit' };
  monthlyPlot: any = { bar: { borderRadius: 5, columnWidth: '48%' } };
  monthlyColors = ['#2563eb', '#16a34a'];
  donutChart: any = { type: 'donut', height: 280, fontFamily: 'inherit' };
  donutColors = ['#16a34a', '#ef4444', '#60a5fa'];
  chartLegend: any = { position: 'bottom', fontSize: '12px' };
  chartNoData: any = { text: 'Sin movimientos todavía' };
  money = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount || 0);

  constructor() {
    effect(() => {
      const rootId = Number(this.signalsService.getRootSelectedBySidebar()());
      if (rootId && rootId !== this.rootId) { this.rootId = rootId; this.reload(); }
    });
  }

  get urgentRows(): DueRow[] { return this.rows.filter(row => row.balance > 0 && row.days < 0).sort((a, b) => a.days - b.days).slice(0, 6); }
  get upcomingRows(): DueRow[] { return this.rows.filter(row => row.balance > 0 && row.days >= 0 && row.days <= 30).sort((a, b) => a.days - b.days).slice(0, 6); }
  get collectionProgress(): number { return this.totalLoaned > 0 ? Math.min(100, Math.round(this.totalCollected / this.totalLoaned * 100)) : 0; }

  reload(): void {
    if (!this.rootId) return;
    this.loading = true;
    this.error = '';
    this.customersService.getCobranzaDashboard(this.rootId).subscribe({
      next: loans => { this.loans = loans || []; this.calculate(); this.loading = false; },
      error: err => { console.error('Error al cargar dashboard de cobranza:', err); this.error = 'No se pudo cargar el resumen de Cobranza.'; this.loading = false; }
    });
  }

  private calculate(): void {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayKey = this.key(today);
    const monthKey = todayKey.slice(0, 7);
    this.totalLoaned = this.loans.reduce((sum, loan) => sum + Number(loan.montoTotal || 0), 0);
    this.activeCustomers = new Set(this.loans.map(loan => loan.idCustomer)).size;
    this.rows = [];
    this.totalCollected = 0;
    this.collectedThisMonth = 0;
    for (const loan of this.loans) {
      for (const cuota of loan.cuotas || []) {
        const payments = cuota.abonos || [];
        const paid = payments.reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
        this.totalCollected += paid;
        this.collectedThisMonth += payments.filter((payment: any) => String(payment.fechaPago).slice(0, 7) === monthKey).reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
        const due = String(cuota.fechaProgramada || '').slice(0, 10);
        const dueDate = new Date(`${due}T00:00:00`);
        const days = Number.isFinite(dueDate.getTime()) ? Math.round((dueDate.getTime() - today.getTime()) / 86400000) : 0;
        const amount = Number(cuota.montoProgramado || 0);
        this.rows.push({ customerId: loan.idCustomer, customer: loan.cliente, loanId: loan.id, installment: cuota.numeroCuota, due, amount, paid, balance: Math.max(0, amount - paid), days });
      }
    }
    this.totalBalance = Math.max(0, this.totalLoaned - this.totalCollected);
    this.overdue = this.rows.filter(row => row.days < 0).reduce((sum, row) => sum + row.balance, 0);
    this.dueThisMonth = this.rows.filter(row => row.due.slice(0, 7) === monthKey).reduce((sum, row) => sum + row.balance, 0);
    this.dueNextSeven = this.rows.filter(row => row.days >= 0 && row.days <= 7).reduce((sum, row) => sum + row.balance, 0);
    const dueToDate = this.rows.filter(row => row.due <= todayKey).reduce((sum, row) => sum + row.amount, 0);
    this.recoveryRate = dueToDate > 0 ? Math.min(100, Math.round(this.totalCollected / dueToDate * 100)) : 0;
    this.portfolioSeries = [this.totalCollected, this.overdue, Math.max(0, this.totalBalance - this.overdue)];
    const months = Array.from({ length: 6 }, (_, i) => { const date = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1); return this.key(date).slice(0, 7); });
    this.monthlyCategories = months.map(month => new Date(`${month}-01T00:00:00`).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }));
    this.monthlySeries = [
      { name: 'Programado', data: months.map(month => this.rows.filter(row => row.due.slice(0, 7) === month).reduce((sum, row) => sum + row.amount, 0)) },
      { name: 'Cobrado', data: months.map(month => this.loans.reduce((sum, loan) => sum + (loan.cuotas || []).reduce((part: number, cuota: any) => part + (cuota.abonos || []).filter((payment: any) => String(payment.fechaPago).slice(0, 7) === month).reduce((paid: number, payment: any) => paid + Number(payment.monto || 0), 0), 0), 0)) }
    ];
  }

  formatDue(value: string): string { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  private key(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
}
