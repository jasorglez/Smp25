import { Component, DestroyRef, effect, inject, NgZone, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { debounceTime, filter } from 'rxjs';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { SignalrService } from 'app/services/signalr.service';

@Component({
  selector: 'app-dash-admon',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-2">

      <!-- ── FILA INGRESOS: Top | Barras | Pie ── -->
      <div class="row g-3 mb-3">

        <!-- Col 1: Top Clientes -->
        <div class="col-12 col-xl-3">
          <div class="chart-card h-100 d-flex flex-column">
            <div class="chart-header">
              <i class="bi bi-people-fill me-2 text-primary"></i>
              <span>Top Clientes</span>
            </div>
            <div class="date-range-bar">
              <input type="date" class="date-input" [(ngModel)]="clientStartDate" (change)="onClientDateChange()">
              <span class="date-sep">–</span>
              <input type="date" class="date-input" [(ngModel)]="clientEndDate" (change)="onClientDateChange()">
            </div>
            <div class="client-list-body flex-grow-1">
              <div *ngIf="!clientList?.length" class="text-center text-muted py-5">
                <i class="bi bi-hourglass-split fs-3"></i><br>Cargando clientes...
              </div>
              <div *ngFor="let c of clientList; let i = index" class="client-row">
                <span class="client-rank">{{ i + 1 }}</span>
                <div class="client-info">
                  <div class="client-name" [title]="c.name">{{ c.name }}</div>
                  <div class="client-bar-wrap">
                    <div class="client-bar" [style.width.%]="(c.total / clientList[0].total) * 100"></div>
                  </div>
                </div>
                <span class="client-total">\${{ c.total | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="list-footer" *ngIf="clientListTotal">
              <span class="footer-label"><i class="bi bi-calendar3 me-1"></i>{{ clientListLabel }}</span>
              <span class="footer-total">\${{ clientListTotal | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <!-- Col 2: Tendencia Ingresos -->
        <div class="col-12 col-xl-6">
          <div class="chart-card h-100">
            <div class="chart-header">
              <i class="bi bi-graph-up-arrow me-2 text-success"></i>
              <span>Tendencia de Ingresos por Año</span>
            </div>
            <div class="chart-body">
              <apx-chart *ngIf="ingresosSeries?.length"
                [series]="ingresosSeries"
                [chart]="ingresosChart"
                [xaxis]="ingresosXaxis"
                [yaxis]="ingresosYaxis"
                [stroke]="ingresosStroke"
                [colors]="ingresosColors"
                [fill]="ingresosFill"
                [plotOptions]="ingresosPlotOptions"
                [dataLabels]="ingresosDataLabels"
                [tooltip]="ingresosTooltip"
                [legend]="ingresosLegend">
              </apx-chart>
              <div *ngIf="!ingresosSeries?.length" class="text-center text-muted py-5">
                <i class="bi bi-hourglass-split fs-3"></i><br>Cargando ingresos...
              </div>
            </div>
          </div>
        </div>

        <!-- Col 3: Pie Clientes -->
        <div class="col-12 col-xl-3">
          <div class="chart-card h-100">
            <div class="chart-header">
              <i class="bi bi-pie-chart-fill me-2 text-primary"></i>
              <span>Distribución Clientes</span>
            </div>
            <div class="chart-body">
              <apx-chart *ngIf="ingPieSeries?.length"
                [series]="ingPieSeries"
                [chart]="ingPieChart"
                [labels]="ingPieLabels"
                [colors]="ingPieColors"
                [plotOptions]="ingPiePlotOptions"
                [dataLabels]="ingPieDataLabels"
                [legend]="ingPieLegend"
                [tooltip]="ingPieTooltip">
              </apx-chart>
              <div *ngIf="!ingPieSeries?.length" class="text-center text-muted py-5">
                <i class="bi bi-hourglass-split fs-3"></i><br>Sin datos...
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ── SALDO BANCARIO (solo Root) ── -->
      <div class="row g-2 mb-2" *ngIf="isRootUser && cuentasBanco.length">
        <div class="col-12">
          <div class="saldo-row-wrap">
            <span class="saldo-row-label"><i class="bi bi-bank2 me-1"></i>Saldo {{ hoyLabel }}</span>
            <span class="saldo-row-sep">|</span>
            <ng-container *ngFor="let c of cuentasBanco; let last = last">
              <span class="saldo-row-cuenta">{{ c.nameAccount }}</span>
              <span class="saldo-row-monto">\${{ c.saldo | number:'1.2-2' }}</span>
              <span class="saldo-row-sep" *ngIf="!last || cuentasBanco.length > 0">|</span>
            </ng-container>
            <span class="saldo-row-total-label">TOTAL {{ cuentasBanco.length }} cta{{ cuentasBanco.length !== 1 ? 's' : '' }}</span>
            <span class="saldo-row-total">\${{ saldoTotal | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>

      <!-- ── FILA EGRESOS: Top | Barras | Pie ── -->
      <div class="row g-3">

        <!-- Col 1: Top Proveedores / Empleados -->
        <div class="col-12 col-xl-3">
          <div class="chart-card h-100 d-flex flex-column">
            <div class="chart-header">
              <i class="bi bi-person-lines-fill me-2 text-danger"></i>
              <span>Top Proveedores / Emp.</span>
            </div>
            <div class="date-range-bar">
              <input type="date" class="date-input" [(ngModel)]="provStartDate" (change)="onProvDateChange()">
              <span class="date-sep">–</span>
              <input type="date" class="date-input" [(ngModel)]="provEndDate" (change)="onProvDateChange()">
            </div>
            <div class="client-list-body flex-grow-1">
              <div *ngIf="!topEntityList?.length" class="text-center text-muted py-5">
                <i class="bi bi-hourglass-split fs-3"></i><br>Cargando...
              </div>
              <div *ngFor="let e of topEntityList; let i = index" class="client-row">
                <span class="client-rank">{{ i + 1 }}</span>
                <div class="client-info">
                  <div class="client-name" [title]="e.name">
                    <span class="entity-badge" [class.badge-proveedor]="e.type==='PROVEEDOR'" [class.badge-empleado]="e.type==='EMPLEADO'">
                      {{ e.type === 'PROVEEDOR' ? 'P' : e.type === 'EMPLEADO' ? 'E' : 'O' }}
                    </span>
                    {{ e.name }}
                  </div>
                  <div class="client-bar-wrap">
                    <div class="client-bar" [style.width.%]="(e.total / topEntityList[0].total) * 100"
                         [style.background]="BAR_PALETTE[i % BAR_PALETTE.length]"></div>
                  </div>
                </div>
                <span class="client-total" [style.color]="BAR_PALETTE[i % BAR_PALETTE.length]">\${{ e.total | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="list-footer egreso-footer" *ngIf="topEntityTotal">
              <span class="footer-label"><i class="bi bi-calendar3 me-1"></i>{{ topEntityLabel }}</span>
              <span class="footer-total egreso-total">\${{ topEntityTotal | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <!-- Col 2: Egresos por día -->
        <div class="col-12 col-xl-6">
          <div class="chart-card h-100">
            <div class="chart-header d-flex justify-content-between align-items-center">
              <span>
                <i class="bi bi-graph-down-arrow me-2 text-danger"></i>
                Egresos por Día — {{ egresosRangeLabel }}
                <span class="ms-2 fw-bold text-danger" style="font-size:13px">\${{ egresosTotal | number:'1.2-2' }}</span>
              </span>
              <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn" [class.btn-danger]="egresosRange===1" [class.btn-outline-danger]="egresosRange!==1" (click)="setEgresosRange(1)">1 Mes</button>
                <button type="button" class="btn" [class.btn-danger]="egresosRange===3" [class.btn-outline-danger]="egresosRange!==3" (click)="setEgresosRange(3)">3 Meses</button>
                <button type="button" class="btn" [class.btn-danger]="egresosRange===6" [class.btn-outline-danger]="egresosRange!==6" (click)="setEgresosRange(6)">6 Meses</button>
              </div>
            </div>
            <div class="chart-body">
              <apx-chart *ngIf="egresosSeries?.length"
                [series]="egresosSeries"
                [chart]="egresosChart"
                [xaxis]="egresosXaxis"
                [yaxis]="egresosYaxis"
                [plotOptions]="egresosPlotOptions"
                [dataLabels]="egresosDataLabels"
                [tooltip]="egresosTooltip"
                [colors]="egresosColors"
                [legend]="egresosLegend">
              </apx-chart>
              <div *ngIf="!egresosSeries?.length" class="text-center text-muted py-5">
                <i class="bi bi-hourglass-split fs-3"></i><br>Cargando egresos...
              </div>
            </div>
          </div>
        </div>

        <!-- Col 3: Pie Proveedores/Empleados -->
        <div class="col-12 col-xl-3">
          <div class="chart-card h-100">
            <div class="chart-header">
              <i class="bi bi-pie-chart-fill me-2 text-danger"></i>
              <span>Distribución Egresos</span>
            </div>
            <div class="chart-body">
              <apx-chart *ngIf="egrPieSeries?.length"
                [series]="egrPieSeries"
                [chart]="egrPieChart"
                [labels]="egrPieLabels"
                [colors]="egrPieColors"
                [plotOptions]="egrPiePlotOptions"
                [dataLabels]="egrPieDataLabels"
                [legend]="egrPieLegend"
                [tooltip]="egrPieTooltip">
              </apx-chart>
              <div *ngIf="!egrPieSeries?.length" class="text-center text-muted py-5">
                <i class="bi bi-hourglass-split fs-3"></i><br>Sin datos...
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `,
  styles: [`
    .chart-card {
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.07);
      overflow: hidden;
    }
    .chart-header {
      padding: 8px 14px;
      font-weight: 700;
      font-size: 12px;
      color: #1a237e;
      border-bottom: 1px solid #f0f0f0;
      background: #fafbff;
    }
    .chart-body {
      padding: 10px;
    }
    .client-list-body {
      overflow-y: auto;
      max-height: 270px;
      padding: 6px 10px;
    }
    .client-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .client-row:last-child { border-bottom: none; }
    .client-rank {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      width: 18px;
      text-align: right;
      flex-shrink: 0;
    }
    .client-info {
      flex: 1;
      min-width: 0;
    }
    .client-name {
      font-size: 11px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .client-bar-wrap {
      height: 4px;
      background: #e2e8f0;
      border-radius: 2px;
      margin-top: 3px;
    }
    .client-bar {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      border-radius: 2px;
      min-width: 2px;
    }
    .client-total {
      font-size: 11px;
      font-weight: 700;
      color: #0f766e;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .egreso-bar   { background: linear-gradient(90deg, #e74c3c, #c0392b); }
    .egreso-total { color: #c0392b; }
    .entity-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 800;
      color: #fff;
      margin-right: 4px;
      flex-shrink: 0;
    }
    .badge-proveedor { background: #3b82f6; }
    .badge-empleado  { background: #10b981; }
    .list-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-top: 2px solid #e2e8f0;
      background: #f8fafc;
    }
    .footer-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: capitalize;
    }
    .footer-total {
      font-size: 13px;
      font-weight: 800;
      color: #0f766e;
    }
    .egreso-footer { border-top-color: #fecaca; background: #fff5f5; }
    .egreso-footer .footer-total { color: #c0392b; }

    /* ── Saldo Bancario Root ── */
    .saldo-row-wrap {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 11px;
    }
    .saldo-row-label {
      font-weight: 700;
      color: #0f766e;
      white-space: nowrap;
    }
    .saldo-row-sep {
      color: #94a3b8;
      font-size: 10px;
    }
    .saldo-row-cuenta {
      color: #334155;
      font-weight: 600;
      white-space: nowrap;
    }
    .saldo-row-monto {
      color: #0f766e;
      font-weight: 700;
      white-space: nowrap;
    }
    .saldo-row-total-label {
      color: #64748b;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }
    .saldo-row-total {
      color: #0f172a;
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
    }
    /* estilos viejos eliminados — mantener línea para evitar error */
    .saldo-card-name {
      font-size: 10px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .saldo-card-amount {
      font-size: 12px;
      font-weight: 800;
      color: #0d9488;
    }
    .saldo-card-total {
      background: #f0fdf4;
      border-left: 2px solid #16a34a;
    }
    .saldo-card-total .saldo-card-bank { color: #15803d; }
    .saldo-total-amount { color: #15803d; font-size: 13px; }

    .date-range-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
    }
    .date-input {
      flex: 1;
      font-size: 11px;
      padding: 3px 6px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      color: #1e293b;
      background: #fff;
    }
    .date-sep { font-size: 11px; color: #94a3b8; font-weight: 700; }
  `]
})
export class DashAdmonComponent implements OnInit {

  private incomesService  = inject(IncomesAndExpensesService);
  private adminService    = inject(AdministrationService);
  private signalsService  = inject(SignalsService);
  private signalrService  = inject(SignalrService);
  private destroyRef      = inject(DestroyRef);
  private zone            = inject(NgZone);
  private cdr             = inject(ChangeDetectorRef);

  // ── Saldo Bancario (solo Root) ──
  isRootUser:   boolean = false;
  cuentasBanco: any[]   = [];
  saldoTotal:   number  = 0;
  hoyLabel:     string  = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // ── Clientes ──
  clientList: { name: string; total: number }[] = [];
  clientListTotal: number = 0;
  clientListLabel: string = '';
  clientStartDate: string = '';
  clientEndDate: string   = '';
  private allIngresosData: any[] = [];

  // ── Pie Ingresos ──
  ingPieSeries:      number[] = [];
  ingPieLabels:      string[] = [];
  ingPieColors:      string[] = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6'];
  ingPieChart:       any = { type: 'pie', height: 240, dropShadow: { enabled: true, top: 4, left: 4, blur: 6, opacity: 0.25 }, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
  ingPiePlotOptions: any = { pie: { customScale: 0.9, expandOnClick: true, dataLabels: { offset: -5, minAngleToShowLabel: 8 } } };
  ingPieDataLabels:  any = { enabled: true, formatter: (val: number) => val.toFixed(1) + '%', style: { fontSize: '10px', fontWeight: '700' }, dropShadow: { enabled: false } };
  ingPieLegend:      any = { show: true, position: 'bottom', fontSize: '10px', itemMargin: { horizontal: 4, vertical: 2 } };
  ingPieTooltip:     any = { y: { formatter: (v: number) => '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 0 }) } };

  // ── Pie Egresos ──
  egrPieSeries:      number[] = [];
  egrPieLabels:      string[] = [];
  egrPieColors:      string[] = ['#e74c3c','#e67e22','#9b59b6','#1abc9c','#3498db','#e91e63','#ff5722','#607d8b'];
  egrPieChart:       any = { type: 'pie', height: 240, dropShadow: { enabled: true, top: 4, left: 4, blur: 6, opacity: 0.25 }, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
  egrPiePlotOptions: any = { pie: { customScale: 0.9, expandOnClick: true, dataLabels: { offset: -5, minAngleToShowLabel: 8 } } };
  egrPieDataLabels:  any = { enabled: true, formatter: (val: number) => val.toFixed(1) + '%', style: { fontSize: '10px', fontWeight: '700' }, dropShadow: { enabled: false } };
  egrPieLegend:      any = { show: true, position: 'bottom', fontSize: '10px', itemMargin: { horizontal: 4, vertical: 2 } };
  egrPieTooltip:     any = { y: { formatter: (v: number) => '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 0 }) } };

  // ── Ingresos ──
  ingresosSeries:      any[]   = [];
  ingresosChart:       any     = { type: 'line', height: 280, width: '100%', stacked: true, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
  ingresosXaxis:       any     = { categories: [], labels: { rotate: -45, rotateAlways: true, style: { fontSize: '10px', colors: '#64748b' } } };
  ingresosYaxis:       any     = { labels: { formatter: (v: number) => v >= 1_000_000 ? '$' + (v/1_000_000).toFixed(1)+'M' : '$'+(v/1000).toFixed(0)+'K', style: { colors: '#64748b', fontSize: '11px' } } };
  ingresosStroke:      any     = { width: [], curve: 'straight' };
  ingresosColors:      string[]= [];
  ingresosFill:        any     = { opacity: 1 };
  ingresosPlotOptions: any     = { bar: { horizontal: false, columnWidth: '70%', borderRadius: 3 } };
  ingresosDataLabels:  any     = { enabled: false };
  ingresosTooltip:     any     = { shared: true, intersect: false, y: { formatter: (v: number) => v ? '$'+v.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' } };
  ingresosLegend:      any     = { show: true, position: 'top', horizontalAlign: 'right', fontSize: '12px' };

  // ── Egresos por día ──
  egresosSeries:      any[]   = [];
  egresosChart:       any     = { type: 'bar', height: 250, width: '100%', toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif', legend: { show: false } };
  egresosXaxis:       any     = { categories: [] };
  egresosYaxis:       any     = { labels: { formatter: (v: number) => '$'+(v/1000).toFixed(0)+'K', style: { colors: '#64748b', fontSize: '11px' } } };
  egresosPlotOptions: any     = { bar: { horizontal: false, columnWidth: '60%', borderRadius: 3, distributed: true } };
  egresosDataLabels:  any     = { enabled: true, formatter: (v: number) => v > 0 ? '$'+(v/1000).toFixed(1)+'K' : '', offsetY: -18, style: { fontSize: '10px', colors: ['#555'] } };
  egresosTooltip:     any     = { y: { formatter: (v: number) => '$'+v.toLocaleString('es-MX', { minimumFractionDigits: 2 }) } };
  egresosColors:      string[]= ['#e74c3c'];
  egresosLegend:      any     = { show: false };

  egresosRange: number = 1;
  egresosRangeLabel: string = '';
  egresosTotal: number = 0;
  topEntityList: { name: string; total: number; type: string }[] = [];
  topEntityTotal: number = 0;
  topEntityLabel: string = '';
  provStartDate: string = '';
  provEndDate: string   = '';
  private allEgresosData: any[] = [];

  constructor() {
    const now = new Date();
    const todayIso = now.toISOString().substring(0, 10);
    this.clientStartDate = `${now.getFullYear()}-01-01`;
    this.clientEndDate   = todayIso;
    this.provStartDate   = `${now.getFullYear()}-01-01`;
    this.provEndDate     = todayIso;

    effect(() => {
      const rootId = this.signalsService.getRootSelectedBySidebar()();
      this.isRootUser = !!this.signalsService.getUserRoot()();
      if (rootId) {
        this.loadIngresos(rootId);
        this.loadEgresos(rootId);
        if (this.isRootUser) this.loadCuentasBanco(rootId);
      }
    });
    this.updateEgresosRangeLabel();
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token') || '';
    this.signalrService.startAdmonConnection(token);

    this.signalrService.admonUpdate$.pipe(
      filter(data => data !== null),
      debounceTime(800),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(data => {
      this.zone.run(() => {
        const rootId = this.signalsService.getRootSelectedBySidebar()();
        if (!rootId) return;
        if (!data?.idRoot || data.idRoot === rootId) {
          this.loadIngresos(rootId);
          this.loadEgresos(rootId);
          if (this.isRootUser) this.loadCuentasBanco(rootId);
        }
      });
    });
  }

  onClientDateChange(): void {
    if (this.clientStartDate && this.clientEndDate)
      this.buildClientList(this.allIngresosData);
  }

  onProvDateChange(): void {
    if (this.provStartDate && this.provEndDate)
      this.buildTopEntityList(this.allEgresosData);
  }

  setEgresosRange(months: number): void {
    this.egresosRange = months;
    this.updateEgresosRangeLabel();
    this.buildEgresosChart(this.allEgresosData);
  }

  private updateEgresosRangeLabel(): void {
    const now = new Date();
    if (this.egresosRange === 1) {
      this.egresosRangeLabel = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    } else {
      const from = new Date(now.getFullYear(), now.getMonth() - this.egresosRange + 1, 1);
      const fromLabel = from.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
      const toLabel   = now.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
      this.egresosRangeLabel = `${fromLabel} – ${toLabel}`;
    }
  }

  private loadIngresos(rootId: number): void {
    this.allIngresosData = [];
    this.incomesService.getIncomesxroot(rootId).subscribe((data: any[]) => {
      if (!data?.length) return;
      this.allIngresosData = data;
      this.buildIngresosChart(data);
      this.buildClientList(data);
      this.cdr.markForCheck();
    });
  }

  private buildClientList(data: any[]): void {
    const from = this.clientStartDate ? new Date(this.clientStartDate + 'T00:00:00') : null;
    const to   = this.clientEndDate   ? new Date(this.clientEndDate   + 'T23:59:59') : null;

    const filtered = data.filter(s => {
      if (!from && !to) return true;
      const d = new Date(s.fechaingreso);
      return (!from || d >= from) && (!to || d <= to);
    });

    const byClient: { [key: string]: number } = {};
    filtered.forEach(s => {
      const name = (s.company || 'Sin cliente').trim().replace(/\s+/g, ' ').toUpperCase();
      byClient[name] = (byClient[name] || 0) + (Number(s.totalconcepto) || 0);
    });
    this.clientList = Object.entries(byClient)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    this.clientListTotal = this.clientList.reduce((s, c) => s + c.total, 0);

    const topN = this.clientList.slice(0, 8);
    const resto = this.clientListTotal - topN.reduce((s, c) => s + c.total, 0);
    this.ingPieLabels = [...topN.map(c => c.name.length > 18 ? c.name.substring(0, 18) + '…' : c.name), ...(resto > 0 ? ['Otros'] : [])];
    this.ingPieSeries = [...topN.map(c => c.total), ...(resto > 0 ? [resto] : [])];

    const fmt = (iso: string) => new Date(iso + 'T00:00:00')
      .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    if (from && to)
      this.clientListLabel = `${fmt(this.clientStartDate)} – ${fmt(this.clientEndDate)}`;
    else
      this.clientListLabel = 'Todo el período';
  }

  private loadEgresos(rootId: number): void {
    this.allEgresosData = [];
    this.incomesService.getConceptsDailyByRoot(rootId).subscribe((data: any[]) => {
      if (!data?.length) return;
      this.allEgresosData = data;
      this.buildEgresosChart(data);
      this.buildTopEntityList(data);
      this.cdr.markForCheck();
    });
  }

  private buildTopEntityList(data: any[]): void {
    const from = this.provStartDate ? new Date(this.provStartDate + 'T00:00:00') : null;
    const to   = this.provEndDate   ? new Date(this.provEndDate   + 'T23:59:59') : null;

    const byEntity: { [key: string]: { total: number; type: string } } = {};
    data.forEach(e => {
      const d = new Date(e.dateExpend);
      if ((from && d < from) || (to && d > to)) return;
      const name = e.entityName || 'Sin nombre';
      const type = e.entityType || 'OTRO';
      const key  = `${type}||${name}`;
      if (!byEntity[key]) byEntity[key] = { total: 0, type };
      byEntity[key].total += Number(e.totalFinal) || 0;
    });

    this.topEntityList = Object.entries(byEntity)
      .map(([key, val]) => ({ name: key.split('||')[1], total: val.total, type: val.type }))
      .sort((a, b) => b.total - a.total);
    this.topEntityTotal = this.topEntityList.reduce((s, e) => s + e.total, 0);

    const topNe = this.topEntityList.slice(0, 8);
    const restoE = this.topEntityTotal - topNe.reduce((s, e) => s + e.total, 0);
    this.egrPieLabels = [...topNe.map(e => e.name.length > 18 ? e.name.substring(0, 18) + '…' : e.name), ...(restoE > 0 ? ['Otros'] : [])];
    this.egrPieSeries = [...topNe.map(e => e.total), ...(restoE > 0 ? [restoE] : [])];

    const fmt = (iso: string) => new Date(iso + 'T00:00:00')
      .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    this.topEntityLabel = (from && to)
      ? `${fmt(this.provStartDate)} – ${fmt(this.provEndDate)}`
      : 'Todo el período';
  }

  private loadCuentasBanco(rootId: number): void {
    this.adminService.getAccountBanks(rootId).subscribe({
      next: (data: any[]) => {
        this.cuentasBanco = (data || []).filter(c => (Number(c.saldo) || 0) > 0);
        this.saldoTotal   = this.cuentasBanco.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  // Tendencia multianual: barras por mes por año + línea de tendencia
  private buildIngresosChart(data: any[]): void {
    const YEAR_COLORS: { [y: number]: string } = {
      2022: '#9ca3af', 2023: '#f59e0b', 2024: '#3b82f6', 2025: '#10b981', 2026: '#8b5cf6', 2027: '#ec4899'
    };
    const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    // Agrupar por año-mes
    const byYearMonth: { [k: string]: { year: number; month: number; total: number } } = {};
    data.forEach(s => {
      const d = new Date(s.fechaingreso);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
      if (!byYearMonth[key]) byYearMonth[key] = { year: d.getFullYear(), month: d.getMonth(), total: 0 };
      byYearMonth[key].total += s.totalconcepto;
    });

    const sortedKeys   = Object.keys(byYearMonth).sort();
    const allTotals    = sortedKeys.map(k => byYearMonth[k].total);
    const uniqueYears  = [...new Set(sortedKeys.map(k => parseInt(k.split('-')[0])))].sort();
    const labels       = sortedKeys.map(k => { const [y,m] = k.split('-'); return `${MONTHS[+m]}'${y.slice(2)}`; });

    // Serie de barras por año
    const barSeries = uniqueYears.map(yr => ({
      name: String(yr),
      type: 'bar',
      data: sortedKeys.map(k => parseInt(k.split('-')[0]) === yr ? byYearMonth[k].total : null)
    }));

    // Línea de tendencia (regresión lineal)
    const n = allTotals.length;
    const sumX  = allTotals.reduce((_,__,i) => _ + i, 0);
    const sumY  = allTotals.reduce((a,b) => a + b, 0);
    const sumXY = allTotals.reduce((a,b,i) => a + i*b, 0);
    const sumX2 = allTotals.reduce((a,_,i) => a + i*i, 0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    const trendData = allTotals.map((_,i) => Math.max(0, Math.round(intercept + slope*i)));

    this.ingresosColors  = [...uniqueYears.map(y => YEAR_COLORS[y] || '#64748b'), '#ff6b6b'];
    this.ingresosStroke  = { width: [...uniqueYears.map(() => 0), 3], curve: 'straight' };
    this.ingresosXaxis   = { ...this.ingresosXaxis, categories: labels };
    this.ingresosSeries  = [...barSeries, { name: 'Tendencia', type: 'line', data: trendData }];
  }

  readonly BAR_PALETTE = [
    '#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e63',
    '#ff5722','#607d8b','#00bcd4','#8bc34a','#ff9800','#795548','#673ab7','#03a9f4',
    '#4caf50','#ffc107','#f44336','#9c27b0','#009688','#ffeb3b','#2196f3','#ff6f00',
    '#76ff03','#ea80fc','#40c4ff','#69f0ae','#ff6d00','#b0bec5'
  ];

  private buildEgresosChart(data: any[]): void {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── Filtrar por rango seleccionado ──────────────────────────────────────
    let filtered: any[];
    if (this.egresosRange === 1) {
      const yr = now.getFullYear(), mo = now.getMonth();
      filtered = data.filter(e => {
        const d = new Date(e.dateExpend);
        return d.getFullYear() === yr && d.getMonth() === mo;
      });
    } else {
      const fromDate = new Date(now.getFullYear(), now.getMonth() - this.egresosRange + 1, 1);
      filtered = data.filter(e => {
        const d = new Date(e.dateExpend);
        return d >= fromDate && d <= today;
      });
    }

    // ── Agrupar: día → entidad → total (mismo proveedor mismo día = suma) ──
    const dayEntityMap = new Map<string, Map<string, number>>();
    const entityTotals = new Map<string, number>();

    filtered.forEach(e => {
      const d = new Date(e.dateExpend);
      const dayKey = this.egresosRange === 1
        ? String(d.getDate())
        : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      const entity = (e.entityName || 'Sin nombre').toString().trim();
      const amount = Number(e.totalFinal) || 0;

      if (!dayEntityMap.has(dayKey)) dayEntityMap.set(dayKey, new Map());
      const em = dayEntityMap.get(dayKey)!;
      em.set(entity, (em.get(entity) || 0) + amount);
      entityTotals.set(entity, (entityTotals.get(entity) || 0) + amount);
    });

    // ── Total del período ────────────────────────────────────────────────────
    this.egresosTotal = filtered.reduce((sum, e) => sum + (Number(e.totalFinal) || 0), 0);

    // ── Ordenar días ────────────────────────────────────────────────────────
    let sortedDays: string[];
    if (this.egresosRange === 1) {
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      sortedDays = Array.from({ length: days }, (_, i) => String(i + 1));
    } else {
      sortedDays = Array.from(dayEntityMap.keys()).sort((a, b) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
      });
    }

    // ── Ordenar entidades: mayor gasto total = primer color ─────────────────
    const sortedEntities = Array.from(entityTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // ── Construir series (una por proveedor/empleado) ───────────────────────
    const series = sortedEntities.map(entity => ({
      name: entity,
      data: sortedDays.map(day => +(dayEntityMap.get(day)?.get(entity) || 0).toFixed(2))
    }));

    this.egresosSeries      = series;
    this.egresosColors      = sortedEntities.map((_, i) => this.BAR_PALETTE[i % this.BAR_PALETTE.length]);
    this.egresosChart       = { type: 'bar', height: 250, width: '100%', stacked: true, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
    this.egresosPlotOptions = { bar: { horizontal: false, columnWidth: '60%', borderRadius: 2 } };
    this.egresosDataLabels  = { enabled: false };
    this.egresosLegend      = { show: false };
    this.egresosXaxis       = {
      categories: sortedDays,
      labels: {
        rotate: this.egresosRange === 1 ? 0 : -45,
        rotateAlways: this.egresosRange !== 1,
        style: { fontSize: '9px', colors: '#64748b' }
      }
    };
    this.egresosTooltip     = {
      shared: true,
      intersect: false,
      y: {
        formatter: (v: number) => v > 0
          ? '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 2 })
          : (null as any)
      }
    };
  }
}
