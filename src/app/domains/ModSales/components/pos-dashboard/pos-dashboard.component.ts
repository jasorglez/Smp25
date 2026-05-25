import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-pos-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './pos-dashboard.component.html',
})
export class PosDashboardComponent {
  private posService    = inject(PosService);
  private signalsService = inject(SignalsService);

  idCompany    = 0;
  selectedDate = new Date().toISOString().substring(0, 10); // hoy
  loading      = false;
  sales: any[] = [];

  // ── KPIs ──────────────────────────────────────────────────────────────────
  totalVentas    = 0;
  numTickets     = 0;
  ticketPromedio = 0;
  ventaMasAlta   = 0;

  // ── Charts ────────────────────────────────────────────────────────────────
  horaChartOptions: any  = {};
  pagoChartOptions: any  = {};
  chartsReady            = false;

  // ── Top 5 productos ───────────────────────────────────────────────────────
  top5: { description: string; qty: number; amount: number }[] = [];

  // ── Recent tickets ────────────────────────────────────────────────────────
  recentTickets: any[] = [];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()() ?? 0;
      if (this.idCompany) this.loadData();
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.loading     = false;
    this.chartsReady = false;
    this.loading     = true;

    const from = `${this.selectedDate}T00:00:00`;
    const to   = `${this.selectedDate}T23:59:59`;

    this.posService.getSalesReport(this.idCompany, from, to).subscribe({
      next: (data: any[]) => {
        this.sales = data ?? [];
        this.computeAll();
        this.loading     = false;
        this.chartsReady = true;
      },
      error: () => { this.loading = false; }
    });
  }

  private computeAll() {
    this.computeKPIs();
    this.computeHoraChart();
    this.computePagoChart();
    this.computeTop5();
    this.recentTickets = [...this.sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }

  private computeKPIs() {
    this.numTickets     = this.sales.length;
    this.totalVentas    = this.sales.reduce((s, x) => s + Number(x.amount ?? 0), 0);
    this.ticketPromedio = this.numTickets ? this.totalVentas / this.numTickets : 0;
    this.ventaMasAlta   = this.sales.length
      ? Math.max(...this.sales.map(x => Number(x.amount ?? 0)))
      : 0;
  }

  private computeHoraChart() {
    const byHour = Array(24).fill(0);
    for (const s of this.sales) {
      const h = new Date(s.date).getHours();
      byHour[h] = +(byHour[h] + Number(s.amount ?? 0)).toFixed(2);
    }
    this.horaChartOptions = {
      series: [{ name: 'Ventas', data: byHour }],
      chart : { type: 'bar', height: 220, toolbar: { show: false }, fontFamily: 'inherit' },
      colors: ['#0d6efd'],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '65%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
      xaxis: {
        categories: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`),
        labels: { style: { fontSize: '9px', colors: '#64748b' } },
        axisBorder: { show: false }, axisTicks: { show: false },
      },
      yaxis: {
        labels: { formatter: (v: number) => this.fmtShort(v), style: { fontSize: '9px', colors: '#64748b' } },
      },
      tooltip: { y: { formatter: (v: number) => this.fmtMXN(v) } },
    };
  }

  private computePagoChart() {
    const map: Record<string, number> = {};
    for (const s of this.sales) {
      const pt = s.paymentType ?? 'EFECTIVO';
      map[pt] = +(((map[pt] ?? 0) + Number(s.amount ?? 0)).toFixed(2));
    }
    const labels  = Object.keys(map);
    const series  = labels.map(k => map[k]);
    const palette = ['#198754', '#0d6efd', '#ffc107', '#0dcaf0', '#6c757d'];

    this.pagoChartOptions = {
      series,
      chart : { type: 'donut', height: 220, fontFamily: 'inherit' },
      labels,
      colors: palette.slice(0, labels.length),
      legend: { position: 'bottom', fontSize: '11px' },
      dataLabels: { formatter: (val: number) => `${val.toFixed(1)}%`, style: { fontSize: '10px' } },
      tooltip: { y: { formatter: (v: number) => this.fmtMXN(v) } },
      plotOptions: { pie: { donut: { size: '60%' } } },
    };
  }

  private computeTop5() {
    const map: Record<string, { qty: number; amount: number }> = {};
    for (const s of this.sales) {
      for (const c of (s.concepts ?? [])) {
        const key = c.description || `Prod. ${c.idProduct}`;
        if (!map[key]) map[key] = { qty: 0, amount: 0 };
        map[key].qty    = +(map[key].qty    + Number(c.quantity ?? 0)).toFixed(3);
        map[key].amount = +(map[key].amount + Number(c.total ?? 0)).toFixed(2);
      }
    }
    this.top5 = Object.entries(map)
      .map(([description, v]) => ({ description, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fmtMXN(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
  }

  fmtShort(n: number): string {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
  }

  fmtTime(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  paymentIcon(pt: string): string {
    const m: Record<string, string> = {
      EFECTIVO: 'bi-cash-coin text-success',
      TARJETA : 'bi-credit-card text-primary',
      CHEQUE  : 'bi-file-earmark-text text-warning',
      VALES   : 'bi-ticket-perforated text-info',
      MIXTO   : 'bi-layers text-secondary',
    };
    return m[pt] ?? 'bi-question-circle text-muted';
  }

  get progressWidth(): string {
    const max = this.ventaMasAlta || 1;
    return `${(this.totalVentas / max) * 100}%`;
  }
}
