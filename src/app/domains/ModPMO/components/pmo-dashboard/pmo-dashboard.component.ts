import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { NgApexchartsModule }   from 'ng-apexcharts';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { AdvanceService }       from 'app/services/advance.service';
import { SignalsService }       from 'app/services/signals.service';

export interface EVM {
  bac:  number;  // Budget at Completion (%)
  pv:   number;  // Planned Value (%)
  ev:   number;  // Earned Value (%)
  ac:   number;  // Actual Cost (manual)
  spi:  number;  // EV / PV
  cpi:  number;  // EV / AC
  eac:  number;  // BAC / CPI
  etc:  number;  // EAC - AC
  sv:   number;  // Schedule Variance = EV - PV
  cv:   number;  // Cost Variance    = EV - AC
}

@Component({
  selector: 'app-pmo-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './pmo-dashboard.component.html',
})
export class PmoDashboardComponent implements OnInit {
  private _projectsService    = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _advanceService     = inject(AdvanceService);
  private _signalsService     = inject(SignalsService);

  // ── Selección ────────────────────────────────────────────────────────────
  projects:        any[]  = [];
  selectedProject: any    = null;
  idCompany:       number = 0;

  // ── Estado ───────────────────────────────────────────────────────────────
  isLoading = false;

  // ── EVM inputs/outputs ────────────────────────────────────────────────────
  acManual    = 0;     // Costo real manual (hasta tener tabla de recursos)
  budgetTotal = 100;   // BAC en unidades monetarias (% por defecto = 100)
  evm: EVM = { bac:100, pv:0, ev:0, ac:0, spi:0, cpi:0, eac:0, etc:0, sv:0, cv:0 };

  // ── Curva S ───────────────────────────────────────────────────────────────
  sCurveOptions: any  = {};
  sCurveSeries:  any[] = [];

  // ── KPI cards ─────────────────────────────────────────────────────────────
  kpiCards: { label: string; value: string; color: string; icon: string; help: string }[] = [];

  // ── Entregables ────────────────────────────────────────────────────────────
  deliverables: any[] = [];

  constructor() {
    effect(() => {
      const id = this._signalsService.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) {
        this.idCompany = id;
        this.loadProjects();
      }
    });
  }

  ngOnInit(): void {
    this.idCompany = this._signalsService.getRootSelectedBySidebar()() ?? 0;
    if (this.idCompany) this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    try {
      const res: any = await lastValueFrom(
        this._projectsService.getProjectListByCompany(this.idCompany)
      );
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  async onProjectChange(): Promise<void> {
    if (!this.selectedProject) return;
    await this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;

      // 1. Programa de trabajo (tareas hoja con ponderado)
      const tasks: any[] = await lastValueFrom(
        this._workprogramsService.getWorkPrograms(idProject, 'Project')
      );

      // 2. Curva S (avances diarios)
      const advancesRes: any = await lastValueFrom(
        this._advanceService.getAdvancesByProject(idProject, 'Project')
      );
      const advances: any[] = Array.isArray(advancesRes?.data) ? advancesRes.data
        : (Array.isArray(advancesRes) ? advancesRes : []);

      this.buildEVM(tasks, advances);
      this.buildSCurve(advances);
      this.buildDeliverables(tasks);
    } catch (e) {
      console.error('PMO Dashboard load error', e);
    } finally {
      this.isLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  buildEVM(tasks: any[], advances: any[]): void {
    const parentSet = new Set(tasks.map(t => String(t.parent)));
    const leafTasks = tasks.filter(t =>
      !parentSet.has(String(t.idTask)) && Number(t.ponderado ?? 0) > 0
    );

    // PV: avance programado ponderado (usando startDate/endDate vs hoy)
    const today = new Date();
    let pvSum = 0;
    leafTasks.forEach(t => {
      const start = t.startDate ? new Date(t.startDate) : null;
      const end   = t.endDate   ? new Date(t.endDate)   : null;
      const ponderado = Number(t.ponderado ?? 0);
      if (!start || !end) return;
      const duration = end.getTime() - start.getTime();
      if (duration <= 0) { pvSum += ponderado; return; }
      if (today >= end) { pvSum += ponderado; return; }
      if (today >= start) {
        const elapsed = today.getTime() - start.getTime();
        pvSum += ponderado * (elapsed / duration);
      }
    });

    // EV: avance físico real ponderado
    let evSum = 0;
    leafTasks.forEach(t => {
      const prog = Math.min(1, Number(t.progress ?? 0));
      evSum += Number(t.ponderado ?? 0) * prog;
    });

    // AC: manual (hasta tener tabla de recursos)
    const ac = this.acManual;

    const pv  = Math.round(pvSum * 100) / 100;
    const ev  = Math.round(evSum * 100) / 100;
    const bac = this.budgetTotal;
    const spi = pv > 0 ? Math.round((ev / pv) * 1000) / 1000 : 0;
    const cpi = ac > 0 ? Math.round((ev / ac) * 1000) / 1000 : 0;
    const eac = cpi > 0 ? Math.round((bac / cpi) * 100) / 100 : bac;
    const etc = Math.round((eac - ac) * 100) / 100;
    const sv  = Math.round((ev  - pv) * 100) / 100;
    const cv  = Math.round((ev  - ac) * 100) / 100;

    this.evm = { bac, pv, ev, ac, spi, cpi, eac, etc, sv, cv };
    this.buildKpiCards();
  }

  buildKpiCards(): void {
    const { spi, cpi, eac, etc, sv, cv } = this.evm;
    this.kpiCards = [
      {
        label: 'SPI — Índice Rendimiento Cronograma',
        value: spi.toFixed(3),
        color: spi >= 1 ? 'success' : spi >= 0.8 ? 'warning' : 'danger',
        icon:  'bi-clock-history',
        help:  spi >= 1 ? 'Adelantado o en tiempo' : spi >= 0.8 ? 'Leve retraso' : 'Retraso crítico',
      },
      {
        label: 'CPI — Índice Rendimiento Costo',
        value: this.evm.ac > 0 ? cpi.toFixed(3) : 'N/A (ingresa AC)',
        color: cpi >= 1 ? 'success' : cpi >= 0.8 ? 'warning' : 'danger',
        icon:  'bi-currency-dollar',
        help:  cpi >= 1 ? 'Bajo presupuesto' : cpi >= 0.8 ? 'Sobre presupuesto leve' : 'Sobre presupuesto crítico',
      },
      {
        label: 'EAC — Estimado al Terminar',
        value: this.evm.ac > 0 ? eac.toFixed(2) : 'N/A',
        color: 'primary',
        icon:  'bi-calculator-fill',
        help:  'Proyección del costo total al terminar (BAC / CPI)',
      },
      {
        label: 'ETC — Estimado para Completar',
        value: this.evm.ac > 0 ? etc.toFixed(2) : 'N/A',
        color: 'info',
        icon:  'bi-bar-chart-steps',
        help:  'Costo restante proyectado (EAC − AC)',
      },
      {
        label: 'SV — Variación Cronograma',
        value: sv.toFixed(2) + '%',
        color: sv >= 0 ? 'success' : 'danger',
        icon:  'bi-speedometer2',
        help:  sv >= 0 ? 'Adelantado respecto al plan' : 'Atrasado respecto al plan',
      },
      {
        label: 'CV — Variación Costo',
        value: this.evm.ac > 0 ? cv.toFixed(2) + '%' : 'N/A',
        color: cv >= 0 ? 'success' : 'danger',
        icon:  'bi-cash-stack',
        help:  cv >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto',
      },
    ];
  }

  buildSCurve(advances: any[]): void {
    // Ordenar por fecha
    const sorted = [...advances].sort((a, b) =>
      new Date(a.date ?? a.fecha ?? '').getTime() - new Date(b.date ?? b.fecha ?? '').getTime()
    );

    const dates    = sorted.map(a => (a.date ?? a.fecha ?? '').substring(0, 10));
    const physical = sorted.map(a => Number(a.accumulatePhysical ?? a.accumulatefisico ?? a.advancePhysical ?? 0));
    const program  = sorted.map(a => Number(a.accumulateProgram  ?? a.advanceProgram  ?? a.accumulateprogramado ?? 0));

    this.sCurveSeries  = [
      { name: 'Avance Físico Acum. (%)',   data: physical },
      { name: 'Avance Programado Acum. (%)', data: program },
    ];
    this.sCurveOptions = {
      chart: { type: 'line', height: 280, toolbar: { show: true } },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: dates, labels: { rotate: -45, style: { fontSize: '10px' } } },
      yaxis: { min: 0, max: 100, labels: { formatter: (v: number) => v.toFixed(1) + '%' } },
      colors: ['#f39c12', '#2980b9'],
      legend: { position: 'top' },
      tooltip: { y: { formatter: (v: number) => v.toFixed(2) + '%' } },
      title: { text: 'Curva S — Avance Acumulado', align: 'left', style: { fontSize: '13px' } },
    };
  }

  buildDeliverables(tasks: any[]): void {
    // Agrupar por nivel 1 (padres raíz)
    const roots = tasks.filter(t => !t.parent || t.parent === '0' || t.parent === 0);
    this.deliverables = roots.slice(0, 20).map(t => {
      const children = tasks.filter(c => String(c.parent) === String(t.idTask ?? t.id));
      const total    = children.length || 1;
      const done     = children.filter(c => Number(c.progress ?? 0) >= 1).length;
      const progAvg  = children.length
        ? children.reduce((s, c) => s + Number(c.progress ?? 0), 0) / children.length
        : Number(t.progress ?? 0);
      return {
        name:     t.text || t.activity || t.description || 'Entregable',
        total,
        done,
        progress: Math.round(progAvg * 100),
        status:   progAvg >= 1 ? 'Terminado' : progAvg > 0.7 ? 'En Progreso' : progAvg > 0 ? 'Iniciado' : 'No Iniciado',
      };
    });
  }

  onAcChange(): void { this.buildKpiCards(); }

  get progressClass(): (pct: number) => string {
    return (pct: number) =>
      pct >= 90 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger';
  }

  statusBadge(s: string): string {
    const map: Record<string,string> = {
      'Terminado': 'bg-success', 'En Progreso': 'bg-warning text-dark',
      'Iniciado': 'bg-info text-dark', 'No Iniciado': 'bg-secondary'
    };
    return map[s] ?? 'bg-secondary';
  }
}
