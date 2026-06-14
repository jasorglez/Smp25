import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule, ApexChart, ApexAxisChartSeries, ApexXAxis,
         ApexDataLabels, ApexStroke, ApexTooltip, ApexFill, ApexTitleSubtitle,
         ApexPlotOptions, ApexGrid, ChartComponent } from 'ng-apexcharts';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { ApiMonitorService, ApiResumen, ApiPorHora, ApiTopEndpoint,
         ApiLogItem, ApiUsuarioActivo, LoginLogItem } from '../../services/api-monitor.service';

@Component({
  selector: 'app-api-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, AgGridAngular],
  templateUrl: './api-monitor.component.html',
  styleUrls: ['./api-monitor.component.scss']
})
export class ApiMonitorComponent implements OnInit {
  private svc = inject(ApiMonitorService);

  activeTab: 'dashboard' | 'top' | 'logs' | 'servidor' = 'dashboard';
  activeServerTab: '66' | '76' = '66';
  loading = false;

  // ── Date range ────────────────────────────────────────────────────────────
  startDate: string = this.defaultStart();
  endDate:   string = this.defaultEnd();

  // ── Dashboard data ────────────────────────────────────────────────────────
  resumen: ApiResumen | null = null;
  usuariosActivos: ApiUsuarioActivo[] = [];

  // ── Charts ────────────────────────────────────────────────────────────────
  @ViewChild('chartHoras')    chartHoras!:    ChartComponent;
  @ViewChild('chartMetodos')  chartMetodos!:  ChartComponent;
  @ViewChild('chartStatuses') chartStatuses!: ChartComponent;

  chartHorasOpts:    any = { series: [], chart: { type: 'area', height: 220 }, xaxis: { categories: [] } };
  chartMetodosOpts:  any = { series: [], chart: { type: 'donut', height: 220 }, labels: [] };
  chartStatusesOpts: any = { series: [], chart: { type: 'donut', height: 220 }, labels: [] };

  // ── Top endpoints (AG Grid) ───────────────────────────────────────────────
  topData: ApiTopEndpoint[] = [];
  topColDefs: ColDef[] = [
    { field: 'method',        headerName: 'Método',    width: 90,  cellStyle: p => this.methodStyle(p.value) },
    { field: 'endpoint',      headerName: 'Endpoint',  flex: 1,    minWidth: 200 },
    { field: 'totalLlamadas', headerName: 'Llamadas',  width: 100, sort: 'desc' },
    { field: 'avgMs',         headerName: 'Avg ms',    width: 90,
      cellStyle: p => p.value > 2000 ? { color: 'red' } : p.value > 500 ? { color: 'orange' } : null },
    { field: 'maxMs',         headerName: 'Max ms',    width: 90 },
    { field: 'errores',       headerName: 'Errores',   width: 90,
      cellStyle: p => p.value > 0 ? { color: 'red', fontWeight: 'bold' } : null },
    { field: 'ultimaVez',     headerName: 'Última vez', width: 160,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleString('es-MX') : '' }
  ];
  topGridApi!: GridApi;

  // ── Logs (AG Grid) ────────────────────────────────────────────────────────
  logsData: ApiLogItem[] = [];
  logsTotalRows = 0;
  logsPage = 1;
  logsPageSize = 100;
  logsFilterEndpoint = '';
  logsFilterEmail    = '';
  logsFilterStatus   = '';
  logsFilterMethod   = '';

  logsColDefs: ColDef[] = [
    { field: 'fechaHora',   headerName: 'Fecha/Hora',  width: 165,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleString('es-MX') : '' },
    { field: 'method',      headerName: 'Método',      width: 80,  cellStyle: p => this.methodStyle(p.value) },
    { field: 'endpoint',    headerName: 'Endpoint',    flex: 1,    minWidth: 180 },
    { field: 'statusCode',  headerName: 'Status',      width: 80,
      cellStyle: p => p.value >= 500 ? { color: 'red', fontWeight: 'bold' }
                    : p.value >= 400 ? { color: 'orange', fontWeight: 'bold' } : null },
    { field: 'durationMs',  headerName: 'ms',          width: 80,
      cellStyle: p => p.value > 2000 ? { color: 'red' } : p.value > 500 ? { color: 'orange' } : null },
    { field: 'userEmail',   headerName: 'Usuario',     width: 170 },
    { field: 'idCompany',   headerName: 'Empresa',     width: 80 },
    { field: 'ipAddress',   headerName: 'IP',          width: 130 },
    { field: 'microservicio', headerName: 'API',        width: 100 }
  ];
  logsGridApi!: GridApi;

  // ── Login log ────────────────────────────────────────────────────────────
  loginsRecientes: LoginLogItem[] = [];

  // ── Server metrics (static placeholder until real data available) ─────────
  serverProd = {
    host: '66.179.240.10',
    cpu: null as number | null, ram: null as number | null,
    disk: null as number | null, uptime: null as string | null
  };
  serverTest = {
    host: '76.13.28.145',
    cpu: null as number | null, ram: null as number | null,
    disk: null as number | null, uptime: null as string | null
  };

  ngOnInit(): void {
    this.loadDashboard();
  }

  selectTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
    if (tab === 'top')     this.loadTop();
    if (tab === 'logs')    this.loadLogs();
    if (tab === 'dashboard') this.loadDashboard();
  }

  applyDateFilter(): void {
    if (this.activeTab === 'dashboard') this.loadDashboard();
    if (this.activeTab === 'top')       this.loadTop();
    if (this.activeTab === 'logs')      this.loadLogs();
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  loadDashboard(): void {
    this.loading = true;
    this.svc.getResumen(this.startDate, this.endDate).subscribe({
      next: r => {
        this.resumen = r;
        this.buildMetodosChart(r);
        this.buildStatusChart(r);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

    this.svc.getPorHora(this.startDate, this.endDate).subscribe({
      next: data => this.buildHorasChart(data)
    });

    this.svc.getUsuariosActivos().subscribe({
      next: d => { this.usuariosActivos = d; }
    });

    this.svc.getLoginsRecientes(this.startDate, this.endDate).subscribe({
      next: d => { this.loginsRecientes = d; }
    });
  }

  private buildHorasChart(data: ApiPorHora[]): void {
    const labels = data.map(d => `${d.fecha.substring(5, 10)} ${String(d.hora).padStart(2, '0')}h`);
    this.chartHorasOpts = {
      series: [
        { name: 'Solicitudes', data: data.map(d => d.total), type: 'area' },
        { name: 'Errores',     data: data.map(d => d.errores), type: 'bar' }
      ],
      chart: { type: 'line', height: 230, toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: [2, 0] },
      fill: { type: ['gradient', 'solid'], gradient: { opacityFrom: 0.4, opacityTo: 0 } },
      colors: ['#0d6efd', '#dc3545'],
      xaxis: { categories: labels, labels: { rotate: -45, style: { fontSize: '10px' } }, tickAmount: 12 },
      yaxis: { labels: { style: { fontSize: '10px' } } },
      legend: { position: 'top' },
      tooltip: { shared: true },
      grid: { borderColor: '#e7e7e7' }
    };
  }

  private buildMetodosChart(r: ApiResumen): void {
    if (!r.distribucionMetodos.length) return;
    this.chartMetodosOpts = {
      series: r.distribucionMetodos.map(m => m.total),
      chart: { type: 'donut', height: 200 },
      labels: r.distribucionMetodos.map(m => m.metodo),
      colors: ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1'],
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { size: '60%' } } }
    };
  }

  private buildStatusChart(r: ApiResumen): void {
    if (!r.distribucionStatus.length) return;
    const colorMap: Record<number, string> = { 200: '#198754', 201: '#20c997', 204: '#0dcaf0', 400: '#ffc107', 401: '#fd7e14', 403: '#e83e8c', 404: '#fd7e14', 500: '#dc3545' };
    this.chartStatusesOpts = {
      series: r.distribucionStatus.map(s => s.total),
      chart: { type: 'donut', height: 200 },
      labels: r.distribucionStatus.map(s => String(s.status)),
      colors: r.distribucionStatus.map(s => colorMap[s.status] ?? '#6c757d'),
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { size: '60%' } } }
    };
  }

  // ── Top endpoints ─────────────────────────────────────────────────────────
  loadTop(): void {
    this.loading = true;
    this.svc.getTopEndpoints(this.startDate, this.endDate, 50).subscribe({
      next: d => { this.topData = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  onTopGridReady(e: GridReadyEvent): void { this.topGridApi = e.api; }

  // ── Logs ──────────────────────────────────────────────────────────────────
  loadLogs(): void {
    this.loading = true;
    this.svc.getLogs({
      startDate: this.startDate, endDate: this.endDate,
      page: this.logsPage, pageSize: this.logsPageSize,
      endpoint: this.logsFilterEndpoint || undefined,
      email:    this.logsFilterEmail    || undefined,
      statusCode: this.logsFilterStatus ? Number(this.logsFilterStatus) : undefined,
      method:   this.logsFilterMethod   || undefined
    }).subscribe({
      next: r => {
        this.logsData      = r.items;
        this.logsTotalRows = r.total;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyLogsFilter(): void { this.logsPage = 1; this.loadLogs(); }

  prevPage(): void { if (this.logsPage > 1) { this.logsPage--; this.loadLogs(); } }
  nextPage(): void {
    if (this.logsPage * this.logsPageSize < this.logsTotalRows) { this.logsPage++; this.loadLogs(); }
  }

  onLogsGridReady(e: GridReadyEvent): void { this.logsGridApi = e.api; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private methodStyle(method: string): any {
    const m: Record<string, string> = { GET: '#0d6efd', POST: '#198754', PUT: '#fd7e14', PATCH: '#ffc107', DELETE: '#dc3545' };
    return method && m[method] ? { color: m[method], fontWeight: 'bold' } : null;
  }

  private defaultStart(): string {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().substring(0, 10);
  }

  private defaultEnd(): string {
    return new Date().toISOString().substring(0, 10);
  }

  get totalPages(): number {
    return Math.ceil(this.logsTotalRows / this.logsPageSize);
  }

  // KPI helpers
  kpiClass(val: number, warn: number, danger: number): string {
    if (val >= danger) return 'text-danger';
    if (val >= warn)   return 'text-warning';
    return 'text-success';
  }

  errorRate(): string {
    if (!this.resumen || !this.resumen.totalPeriodo) return '0';
    const errs = this.resumen.errores4xx + this.resumen.errores5xx;
    return ((errs / this.resumen.totalPeriodo) * 100).toFixed(1);
  }
}
