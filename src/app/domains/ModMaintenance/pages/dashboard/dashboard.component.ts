import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { EquipmentService } from 'app/services/equipment.service';
import { SignalsService } from 'app/services/signals.service';
import { WorkorderService } from 'app/services/workorder.service';
import { TrackingService } from 'app/services/tracking.service';
import { NgApexchartsModule } from 'ng-apexcharts';

interface Stat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface WorkOrder {
  id: string;
  asset: string;
  type: string;
  priority: string;
  status: string;
  technician: string;
}

interface UpcomingMaintenance {
  asset: string;
  date: string;
  type: string;
  hours: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private equipmentService = inject(EquipmentService);
  private workorderService = inject(WorkorderService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  idcompany: number = 0;
  idBranch: number = 0;
  loading: boolean = false;
  errorMessage: string = '';
  private initialized: boolean = false;
  private lastBranchId: number = 0;

  stats: Stat[] = [
    { label: 'Activos Totales', value: '0', icon: 'box', color: 'blue' },
    { label: 'OT Abiertas', value: '0', icon: 'clipboard-check', color: 'orange' },
    { label: 'Preventivos del Mes', value: '0', icon: 'calendar', color: 'green' },
    { label: 'Disponibilidad', value: '0.0%', icon: 'graph-up', color: 'purple' }
  ];

  recentOrders: WorkOrder[] = [];
  upcomingMaintenance: UpcomingMaintenance[] = [];

  // Charts
  chartTipo: any = null;
  chartEstado: any = null;
  chartTendencia: any = null;

  constructor() {
    effect(() => {
      this.updateContext();
      if (!this.initialized) {
        return;
      }

      if (this.idBranch !== this.lastBranchId) {
        this.lastBranchId = this.idBranch;
        this.loadDashboardData();
      }
    });
  }

  ngOnInit(): void {
    this.updateContext();
    this.lastBranchId = this.idBranch;
    this.initialized = true;
    this.loadDashboardData();
    this.trackingService.addLog(
      String(this.idcompany),
      'Acceso a Dashboard de Mantenimiento',
      'ModMaintenance/Dashboard',
      ''
    );
  }

  loadDashboardData(): void {
    if (!this.hasValidContext()) {
      this.errorMessage = 'No hay contexto activo (compañía/sucursal) para cargar el dashboard.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      assets: this.equipmentService.getEquipmentByBranch(this.idBranch),
      workOrders: this.workorderService.getAll(this.idBranch.toString())
    }).subscribe({
      next: (result: any) => {
        const assets = result.assets || [];
        const workOrders = result.workOrders || [];

        this.updateStats(assets, workOrders);
        this.recentOrders = this.buildRecentOrders(workOrders);
        this.upcomingMaintenance = this.buildUpcomingMaintenance(workOrders);
        this.buildCharts(workOrders);

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading maintenance dashboard:', error);
        this.errorMessage = 'No fue posible cargar la información del dashboard.';
        this.loading = false;
      }
    });
  }

  private updateStats(assets: any[], workOrders: any[]): void {
    const totalAssets = assets.length;
    const activeAssets = assets.filter((a: any) => !!a.active).length;
    const openWorkOrders = workOrders.filter((wo: any) =>
      ['pendiente', 'en-proceso', 'pausada'].includes((wo.status || '').toLowerCase())
    ).length;

    const now = new Date();
    const preventiveThisMonth = workOrders.filter((wo: any) => {
      if ((wo.type || '').toLowerCase() !== 'preventivo') {
        return false;
      }
      const dateValue = wo.scheduledDate || wo.createdDate;
      if (!dateValue) {
        return false;
      }
      const date = new Date(dateValue);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    }).length;

    const availability = totalAssets > 0 ? (activeAssets / totalAssets) * 100 : 0;

    this.stats = [
      { label: 'Activos Totales', value: String(totalAssets), icon: 'box', color: 'blue' },
      { label: 'OT Abiertas', value: String(openWorkOrders), icon: 'clipboard-list', color: 'orange' },
      { label: 'Preventivos del Mes', value: String(preventiveThisMonth), icon: 'calendar', color: 'green' },
      { label: 'Disponibilidad', value: `${availability.toFixed(1)}%`, icon: 'chart-line', color: 'purple' }
    ];
  }

  private buildRecentOrders(workOrders: any[]): WorkOrder[] {
    return [...workOrders]
      .sort((a: any, b: any) => this.getOrderDateTimestamp(b) - this.getOrderDateTimestamp(a))
      .slice(0, 5)
      .map((wo: any) => ({
        id: wo.folio || `OT-${wo.id}`,
        asset: wo.assetName || 'Sin activo',
        type: this.toLabel(wo.type),
        priority: this.toLabel(wo.priority),
        status: this.toLabel(wo.status),
        technician: wo.assignedTo || 'Sin asignar'
      }));
  }

  private buildCharts(workOrders: any[]): void {
    // Donut — OTs por tipo
    const tipoLabels = ['Preventivo', 'Correctivo', 'Predictivo', 'Inspección', 'Mejora'];
    const tipoKeys  = ['preventivo', 'correctivo', 'predictivo', 'inspeccion', 'mejora'];
    const tipoSeries = tipoKeys.map(k => workOrders.filter(w => (w.type || '').toLowerCase() === k).length);
    this.chartTipo = {
      series: tipoSeries,
      chart: { type: 'donut', height: 260 },
      labels: tipoLabels,
      colors: ['#22c55e', '#ef4444', '#8b5cf6', '#64748b', '#3b82f6'],
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { size: '60%' } } },
      dataLabels: { enabled: true, formatter: (v: number) => v > 0 ? v.toFixed(0) : '' },
      tooltip: { y: { formatter: (v: number) => `${v} OTs` } }
    };

    // Barras horizontales — por estado
    const estados = ['Pendiente', 'En Proceso', 'Pausada', 'Completada', 'Cancelada'];
    const estadoKeys = ['pendiente', 'en-proceso', 'pausada', 'completada', 'cancelada'];
    const estadoData = estadoKeys.map(k => workOrders.filter(w => (w.status || '').toLowerCase() === k).length);
    this.chartEstado = {
      series: [{ name: 'OTs', data: estadoData }],
      chart: { type: 'bar', height: 260 },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      colors: ['#f59e0b', '#3b82f6', '#94a3b8', '#22c55e', '#ef4444'],
      xaxis: { categories: estados },
      dataLabels: { enabled: true },
      tooltip: { y: { formatter: (v: number) => `${v} OTs` } }
    };

    // Línea — tendencia de OTs por mes (últimos 6 meses)
    const now = new Date();
    const months: string[] = [];
    const preventivos: number[] = [];
    const correctivos: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      months.push(d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }));
      const woMes = workOrders.filter(w => {
        const dt = new Date(w.scheduledDate || w.createdDate || '');
        return !isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === m;
      });
      preventivos.push(woMes.filter(w => (w.type || '').toLowerCase() === 'preventivo').length);
      correctivos.push(woMes.filter(w => (w.type || '').toLowerCase() === 'correctivo').length);
    }
    this.chartTendencia = {
      series: [
        { name: 'Preventivo', data: preventivos },
        { name: 'Correctivo', data: correctivos }
      ],
      chart: { type: 'line', height: 260, toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 2 },
      colors: ['#22c55e', '#ef4444'],
      xaxis: { categories: months },
      markers: { size: 4 },
      legend: { position: 'top' },
      tooltip: { y: { formatter: (v: number) => `${v} OTs` } }
    };
  }

  private buildUpcomingMaintenance(workOrders: any[]): UpcomingMaintenance[] {
    const now = new Date();
    return workOrders
      .filter((wo: any) => {
        if (!wo.scheduledDate) return false;
        const date = new Date(wo.scheduledDate);
        if (Number.isNaN(date.getTime())) return false;
        const status = (wo.status || '').toLowerCase();
        if (status === 'completada' || status === 'cancelada') return false;
        return date >= now;
      })
      .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 5)
      .map((wo: any) => ({
        asset: wo.assetName || 'Sin activo',
        date: this.formatDate(wo.scheduledDate),
        type: this.toLabel(wo.type),
        hours: wo.estimatedHours ? `${wo.estimatedHours}h` : 'N/D'
      }));
  }

  private getOrderDateTimestamp(workOrder: any): number {
    const value = workOrder.createdDate || workOrder.scheduledDate || '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return date.getTime();
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private toLabel(value: string | null | undefined): string {
    if (!value) return 'N/D';
    const normalized = value.replace('-', ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private updateContext(): void {
    const signalCompany = this.signalsService.getRootSelectedBySidebar()();
    if (signalCompany !== null && signalCompany !== undefined) {
      this.idcompany = Number(signalCompany);
    } else {
      const companyStorage = localStorage.getItem('company');
      if (companyStorage) {
        const parsedCompany = Number(companyStorage);
        if (!Number.isNaN(parsedCompany)) {
          this.idcompany = parsedCompany;
        }
      }
    }

    const signalBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = signalBranch !== null && signalBranch !== undefined ? Number(signalBranch) : 0;
  }

  private hasValidContext(): boolean {
    const hasCompany = this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany));
    const hasBranch = this.idBranch !== null && this.idBranch !== undefined && !Number.isNaN(Number(this.idBranch)) && Number(this.idBranch) > 0;
    return hasCompany && hasBranch;
  }

  getPriorityClass(priority: string): string {
    return priority.toLowerCase();
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(' ', '-');
  }
}
