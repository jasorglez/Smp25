import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { NgApexchartsModule }   from 'ng-apexcharts';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { AdvanceService }       from 'app/services/advance.service';
import { ConventionsService }   from 'app/services/conventions.service';
import { SignalsService }       from 'app/services/signals.service';

// ════════════════════════════════════════════════════════════════════════════
// Interfaces
// ════════════════════════════════════════════════════════════════════════════
export interface EVM {
  bac: number;   // Budget at Completion  — Σ total de tareas (MXN)
  pv:  number;   // Planned Value          — de la Curva S programada
  ev:  number;   // Earned Value           — Σ (task.total × task.progress)
  ac:  number;   // Actual Cost            — manual (hasta tener tabla recursos)
  spi: number;   // Schedule Performance Index = EV / PV
  cpi: number;   // Cost Performance Index     = EV / AC
  eac: number;   // Estimate At Completion     = BAC / CPI
  etc: number;   // Estimate To Complete       = EAC – AC
  sv:  number;   // Schedule Variance = EV – PV
  cv:  number;   // Cost Variance     = EV – AC
  pvPct: number; // PV como % del BAC (para mostrar en UI)
  evPct: number; // EV como % del BAC
}

export interface CriticalMilestone {
  id:         number;
  activity:   string;
  description: string;
  endDate:    string;
  progress:   number;   // 0-100
  slackDays:  number;   // días de holgura (0 = ruta crítica)
  delayDays:  number;   // negativo = atrasado
  isMilestone: boolean;
  predecessorId: number;
  status:     'Terminado' | 'En Riesgo' | 'Atrasado' | 'En Tiempo' | 'Pendiente';
}

// ════════════════════════════════════════════════════════════════════════════
// CPM — Calcula holgura total por tarea usando predecesoras
//   Si no hay predecesoras definidas, usa holgura por fecha (fallback)
// ════════════════════════════════════════════════════════════════════════════
function computeCPM(tasks: any[]): Map<number, number> {
  // Retorna: Map<id, totalFloat (días)>
  const slackMap = new Map<number, number>();
  const byId     = new Map<number, any>();
  tasks.forEach(t => byId.set(Number(t.id), t));

  const hasPredecessors = tasks.some(t => Number(t.predecesor ?? 0) > 0);
  const today = Date.now();

  if (!hasPredecessors) {
    // ── Fallback: holgura = días hasta el fin planificado ──────────────────
    tasks.forEach(t => {
      const endMs = t.endate ? new Date(t.endate).getTime() : 0;
      const prog  = Number(t.progress ?? 0);
      if (!endMs || prog >= 1) { slackMap.set(Number(t.id), 9999); return; }
      const slack = Math.ceil((endMs - today) / 86400000);
      slackMap.set(Number(t.id), Math.max(0, slack));
    });
    return slackMap;
  }

  // ── CPM Forward + Backward Pass ───────────────────────────────────────────
  // ES/EF en milisegundos
  const ES  = new Map<number, number>();
  const EF  = new Map<number, number>();
  const LF  = new Map<number, number>();
  const LS  = new Map<number, number>();

  // Duración en ms
  function dur(t: any): number {
    const s = t.startdate ? new Date(t.startdate).getTime() : 0;
    const e = t.endate    ? new Date(t.endate).getTime()    : 0;
    return (s && e && e > s) ? (e - s) : 86400000; // mínimo 1 día
  }

  // Forward pass (topológico sencillo — iteramos hasta convergencia)
  for (let pass = 0; pass < tasks.length; pass++) {
    tasks.forEach(t => {
      const id    = Number(t.id);
      const predId = Number(t.predecesor ?? 0);
      const predEF = predId > 0 ? (EF.get(predId) ?? 0) : 0;
      const startMs = t.startdate ? new Date(t.startdate).getTime() : today;
      const es = Math.max(startMs, predEF);
      ES.set(id, es);
      EF.set(id, es + dur(t));
    });
  }

  // Fecha de fin del proyecto = max EF
  const projectEnd = Math.max(...Array.from(EF.values()));

  // Backward pass
  tasks.forEach(t => LF.set(Number(t.id), projectEnd));
  for (let pass = 0; pass < tasks.length; pass++) {
    tasks.slice().reverse().forEach(t => {
      const id    = Number(t.id);
      const succLs = tasks
        .filter(s => Number(s.predecesor ?? 0) === id)
        .map(s => LS.get(Number(s.id)) ?? projectEnd);
      const lf = succLs.length ? Math.min(...succLs) : projectEnd;
      LF.set(id, lf);
      LS.set(id, lf - dur(t));
    });
  }

  // Float = LF – EF
  tasks.forEach(t => {
    const id  = Number(t.id);
    const ef  = EF.get(id) ?? 0;
    const lf  = LF.get(id) ?? 0;
    const days = Math.round((lf - ef) / 86400000);
    slackMap.set(id, Math.max(0, days));
  });

  return slackMap;
}

// ════════════════════════════════════════════════════════════════════════════
// Componente
// ════════════════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-pmo-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './pmo-dashboard.component.html',
})
export class PmoDashboardComponent implements OnInit {
  private _projectsService     = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _advanceService      = inject(AdvanceService);
  private _convService         = inject(ConventionsService);
  private _signalsService      = inject(SignalsService);

  // ── Selección ─────────────────────────────────────────────────────────────
  projects:           any[] = [];
  selectedProject:    any   = null;
  conventions:        any[] = [];
  selectedConvention: any   = null;
  isLoadingConv             = false;
  idCompany:          number = 0;
  isLoading           = false;

  // ── EVM ───────────────────────────────────────────────────────────────────
  acManual = 0;   // Costo real — manual hasta tener módulo Recursos
  evm: EVM = {
    bac:0, pv:0, ev:0, ac:0,
    spi:0, cpi:0, eac:0, etc:0, sv:0, cv:0,
    pvPct:0, evPct:0,
  };
  hasPredecessors = false;  // indica si el proyecto usa predecesoras

  // ── KPI cards ─────────────────────────────────────────────────────────────
  kpiCards: { label:string; value:string; color:string; icon:string; help:string }[] = [];

  // ── Ruta Crítica / Hitos (Punto 10 integrado) ────────────────────────────
  criticalMilestones: CriticalMilestone[] = [];
  showAllMilestones = false;

  // ── Curva S ───────────────────────────────────────────────────────────────
  sCurveOptions: any  = {};
  sCurveSeries:  any[] = [];

  // ── Entregables ────────────────────────────────────────────────────────────
  deliverables: any[] = [];

  constructor() {
    effect(() => {
      const id = this._signalsService.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) { this.idCompany = id; this.loadProjects(); }
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
    this.selectedConvention = null;
    this.conventions        = [];
    await this.loadConventions();
  }

  async loadConventions(): Promise<void> {
    const idContrato = this.selectedProject?.idContrato ?? this.selectedProject?.id_contrato ?? 0;
    if (!idContrato) { await this.loadDashboard(); return; }
    this.isLoadingConv = true;
    try {
      const res: any = await lastValueFrom(
        this._convService.getConventionsByContractOrProject('contract', idContrato)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.conventions = raw.filter((c: any) => c.active !== false).sort((a: any, b: any) => a.id - b.id);
      const vigente = this.conventions.find((c: any) => c.vigente);
      this.selectedConvention = vigente ?? (this.conventions.length ? this.conventions[this.conventions.length - 1] : null);
    } catch {
      this.conventions = [];
    } finally {
      this.isLoadingConv = false;
    }
    await this.loadDashboard();
  }

  async onConventionChange(): Promise<void> {
    await this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      const idConv    = this.selectedConvention?.id ?? null;

      // Cargar datos en paralelo — filtrados por convenio si hay uno seleccionado
      const tasksObs    = idConv
        ? this._workprogramsService.getByConvention(idConv, idProject)
        : this._workprogramsService.getWorkPrograms(idProject, 'Project');
      const advancesObs = idConv
        ? this._advanceService.getAdvancesByConvenio(idProject, 'Project', idConv)
        : this._advanceService.getAdvancesByProject(idProject, 'Project');

      const [tasks, advancesRes] = await Promise.all([
        lastValueFrom(tasksObs),
        lastValueFrom(advancesObs).catch(() => []),
      ]);

      const advances: any[] = Array.isArray((advancesRes as any)?.data)
        ? (advancesRes as any).data
        : (Array.isArray(advancesRes) ? advancesRes as any[] : []);

      this.hasPredecessors = (tasks ?? []).some(t => Number(t.predecesor ?? 0) > 0);

      this.buildEVM(tasks ?? [], advances);
      this.buildCriticalMilestones(tasks ?? []);
      this.buildSCurve(advances);
      this.buildDeliverables(tasks ?? []);
    } catch (e) {
      console.error('PMO Reporte error', e);
    } finally {
      this.isLoading = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EVM — usa total (MXN) real de cada tarea
  // ──────────────────────────────────────────────────────────────────────────
  buildEVM(tasks: any[], advances: any[]): void {
    // Tareas hoja con presupuesto
    const parentSet = new Set(tasks.map(t => String(t.parent)));
    const leafTasks = tasks.filter(t =>
      !parentSet.has(String(t.idTask ?? t.id))
    );

    // ── BAC — Σ total (costMX) de todas las tareas hoja ──────────────────
    const bac = leafTasks.reduce((s, t) => s + Number(t.total ?? t.costMX ?? 0), 0);

    // ── EV — Σ (task.total × task.progress) ──────────────────────────────
    const ev = leafTasks.reduce((s, t) =>
      s + Number(t.total ?? t.costMX ?? 0) * Math.min(1, Number(t.progress ?? 0)), 0
    );

    // ── PV — de la Curva S: último accumulateprogram × BAC ───────────────
    let pv = 0;
    if (advances.length) {
      const sorted = [...advances].sort((a, b) =>
        new Date(a.date ?? a.fecha ?? '').getTime() -
        new Date(b.date ?? b.fecha ?? '').getTime()
      );
      const lastAdv = sorted[sorted.length - 1];
      const pvPct   = Number(lastAdv.accumulateprogram ?? lastAdv.accumulateProgram ?? 0);
      pv = bac * pvPct / 100;
    } else {
      // Fallback: PV por tiempo transcurrido
      pv = this.calcPVByTime(leafTasks, bac);
    }

    // ── AC — manual ───────────────────────────────────────────────────────
    const ac = this.acManual;

    const spi  = pv  > 0 ? Math.round(ev / pv  * 1000) / 1000 : 0;
    const cpi  = ac  > 0 ? Math.round(ev / ac  * 1000) / 1000 : 0;
    const eac  = cpi > 0 ? Math.round(bac / cpi * 100)  / 100  : bac;
    const etc  = Math.round((eac - ac) * 100) / 100;
    const sv   = Math.round((ev  - pv) * 100) / 100;
    const cv   = Math.round((ev  - ac) * 100) / 100;
    const pvPct = bac > 0 ? Math.round(pv / bac * 1000) / 10 : 0;
    const evPct = bac > 0 ? Math.round(ev / bac * 1000) / 10 : 0;

    this.evm = { bac, pv, ev, ac, spi, cpi, eac, etc, sv, cv, pvPct, evPct };
    this.buildKpiCards();
  }

  private calcPVByTime(leafTasks: any[], bac: number): number {
    const today = Date.now();
    let pvSum = 0;
    leafTasks.forEach(t => {
      const cost  = Number(t.total ?? t.costMX ?? 0);
      const start = t.startdate ? new Date(t.startdate).getTime() : 0;
      const end   = t.endate   ? new Date(t.endate).getTime()   : 0;
      if (!start || !end || end <= start) { pvSum += cost; return; }
      if (today >= end)   { pvSum += cost; return; }
      if (today >= start) { pvSum += cost * (today - start) / (end - start); }
    });
    return pvSum;
  }

  buildKpiCards(): void {
    const { bac, ev, pv, spi, cpi, eac, etc, sv, cv, pvPct, evPct } = this.evm;
    const fmt = (n: number) =>
      n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + ' M'
      : n >= 1_000   ? (n / 1_000).toFixed(1) + ' K'
      : n.toFixed(2);

    this.kpiCards = [
      {
        label: 'BAC — Presupuesto Total',
        value: '$ ' + fmt(bac),
        color: 'dark', icon: 'bi-safe2-fill',
        help: 'Suma de presupuestos de todas las tareas',
      },
      {
        label: 'EV — Valor Ganado',
        value: '$ ' + fmt(ev) + ' (' + evPct + '%)',
        color: evPct >= pvPct ? 'success' : 'danger',
        icon: 'bi-cash-coin',
        help: 'Σ (presupuesto × avance) por tarea',
      },
      {
        label: 'PV — Valor Planeado',
        value: '$ ' + fmt(pv) + ' (' + pvPct + '%)',
        color: 'primary', icon: 'bi-calendar-check-fill',
        help: 'Basado en Curva S programada (último registro)',
      },
      {
        label: 'SPI — Rendimiento Cronograma',
        value: spi > 0 ? spi.toFixed(3) : '—',
        color: spi >= 1 ? 'success' : spi >= 0.8 ? 'warning' : 'danger',
        icon: 'bi-speedometer2',
        help: spi >= 1 ? 'Adelantado ✓' : spi >= 0.8 ? 'Leve retraso' : 'Retraso crítico ⚠',
      },
      {
        label: 'CPI — Rendimiento Costo',
        value: this.acManual > 0 ? cpi.toFixed(3) : 'Ingresa AC',
        color: cpi >= 1 ? 'success' : cpi >= 0.8 ? 'warning' : 'danger',
        icon: 'bi-currency-dollar',
        help: this.acManual > 0
          ? (cpi >= 1 ? 'Bajo presupuesto ✓' : 'Sobre presupuesto ⚠')
          : 'Introduce el Costo Real (AC)',
      },
      {
        label: 'EAC — Estimado al Terminar',
        value: this.acManual > 0 ? '$ ' + fmt(eac) : '—',
        color: 'info', icon: 'bi-calculator-fill',
        help: 'Proyección del costo total al terminar = BAC / CPI',
      },
    ];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Ruta Crítica — Hitos (Punto 10 integrado en el Reporte)
  // ──────────────────────────────────────────────────────────────────────────
  buildCriticalMilestones(tasks: any[]): void {
    if (!tasks.length) { this.criticalMilestones = []; return; }

    const slackMap = computeCPM(tasks);
    const today    = Date.now();
    const MAX_SHOW = 20;

    const milestones: CriticalMilestone[] = tasks
      .filter(t => {
        const slack = slackMap.get(Number(t.id)) ?? 9999;
        const prog  = Number(t.progress ?? 0);
        const endMs = t.endate ? new Date(t.endate).getTime() : 0;
        const dur   = t.startdate && t.endate
          ? new Date(t.endate).getTime() - new Date(t.startdate).getTime()
          : 1;

        const isHito     = dur <= 86400000 * 2;          // ≤ 2 días = hito
        const isCritical = slack <= 5 && prog < 1;        // holgura ≤ 5 días
        const isDelayed  = endMs > 0 && today > endMs && prog < 1;
        return isHito || isCritical || isDelayed;
      })
      .map(t => {
        const slack    = slackMap.get(Number(t.id)) ?? 0;
        const prog     = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10;
        const endMs    = t.endate ? new Date(t.endate).getTime() : 0;
        const delayDays = endMs ? Math.ceil((today - endMs) / 86400000) : 0;
        const dur      = t.startdate && t.endate
          ? new Date(t.endate).getTime() - new Date(t.startdate).getTime()
          : 1;

        let status: CriticalMilestone['status'] = 'Pendiente';
        if (prog >= 100)                            status = 'Terminado';
        else if (delayDays > 0)                     status = 'Atrasado';
        else if (slack <= 2 && prog < 100)          status = 'En Riesgo';
        else if (prog > 0)                          status = 'En Tiempo';

        return {
          id:            Number(t.id),
          activity:      t.activity || '',
          description:   t.description || t.text || '',
          endDate:       t.endate ? String(t.endate).substring(0, 10) : '',
          progress:      prog,
          slackDays:     slack >= 9999 ? -1 : slack,
          delayDays:     delayDays > 0 ? delayDays : 0,
          isMilestone:   dur <= 86400000 * 2,
          predecessorId: Number(t.predecesor ?? 0),
          status,
        } as CriticalMilestone;
      })
      .sort((a, b) => {
        // Orden: Atrasados → En Riesgo → En Tiempo → Terminados
        const order = { Atrasado:0, 'En Riesgo':1, 'En Tiempo':2, Pendiente:3, Terminado:4 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      });

    this.criticalMilestones = milestones.slice(0, MAX_SHOW);
  }

  statusBadge(s: string): string {
    const map: Record<string, string> = {
      'Terminado':  'bg-success',
      'En Tiempo':  'bg-primary',
      'En Riesgo':  'bg-warning text-dark',
      'Atrasado':   'bg-danger',
      'Pendiente':  'bg-secondary',
    };
    return map[s] ?? 'bg-secondary';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Curva S
  // ──────────────────────────────────────────────────────────────────────────
  buildSCurve(advances: any[]): void {
    const sorted = [...advances].sort((a, b) =>
      new Date(a.date ?? a.fecha ?? '').getTime() -
      new Date(b.date ?? b.fecha ?? '').getTime()
    );
    const dates    = sorted.map(a => String(a.date ?? a.fecha ?? '').substring(0, 10));
    const physical = sorted.map(a => Number(a.accumulatephysical ?? a.accumulatePhysical ?? 0));
    const program  = sorted.map(a => Number(a.accumulateprogram  ?? a.accumulateProgram  ?? 0));

    this.sCurveSeries  = [
      { name: 'Avance Físico Acum. (%)',     data: physical },
      { name: 'Avance Programado Acum. (%)', data: program  },
    ];
    this.sCurveOptions = {
      chart: { type: 'line', height: 240, toolbar: { show: false }, animations: { enabled: true } },
      stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 4] },
      xaxis: { categories: dates, labels: { rotate: -45, style: { fontSize: '9px' } } },
      yaxis: { min: 0, max: 100, labels: { formatter: (v: number) => v.toFixed(0) + '%' } },
      colors: ['#f39c12', '#2980b9'],
      fill:   { type: ['solid', 'gradient'] },
      legend: { position: 'top', fontSize: '11px' },
      tooltip: { y: { formatter: (v: number) => v.toFixed(2) + '%' } },
      annotations: {
        yaxis: [{
          y: this.evm.pvPct,
          borderColor: '#2980b9',
          label: { text: 'PV ' + this.evm.pvPct + '%', style: { color: '#fff', background: '#2980b9' } }
        }, {
          y: this.evm.evPct,
          borderColor: '#f39c12',
          label: { text: 'EV ' + this.evm.evPct + '%', style: { color: '#fff', background: '#f39c12' } }
        }],
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Entregables
  // ──────────────────────────────────────────────────────────────────────────
  buildDeliverables(tasks: any[]): void {
    const roots = tasks.filter(t => !t.parent || t.parent === '0' || t.parent === 0);
    this.deliverables = roots.slice(0, 15).map(t => {
      const children = tasks.filter(c => String(c.parent) === String(t.idTask ?? t.id));
      const progAvg  = children.length
        ? children.reduce((s, c) => s + Number(c.progress ?? 0), 0) / children.length
        : Number(t.progress ?? 0);
      const budget = children.reduce((s, c) => s + Number(c.total ?? c.costMX ?? 0), 0)
                   || Number(t.total ?? t.costMX ?? 0);
      const ev     = children.reduce((s, c) =>
          s + Number(c.total ?? c.costMX ?? 0) * Math.min(1, Number(c.progress ?? 0)), 0);
      return {
        name:     t.activity || t.description || 'Entregable',
        progress: Math.round(progAvg * 100),
        budget,
        ev,
        status:   progAvg >= 1 ? 'Terminado' : progAvg > 0.7 ? 'En Progreso' : progAvg > 0 ? 'Iniciado' : 'No Iniciado',
      };
    });
  }

  progressBarColor(pct: number): string {
    return pct >= 90 ? 'bg-success' : pct >= 50 ? 'bg-primary' : pct >= 20 ? 'bg-warning' : 'bg-danger';
  }

  deliverablesBadge(s: string): string {
    const m: Record<string, string> = {
      'Terminado':   'bg-success',
      'En Progreso': 'bg-warning text-dark',
      'Iniciado':    'bg-info text-dark',
      'No Iniciado': 'bg-secondary',
    };
    return m[s] ?? 'bg-secondary';
  }

  get visibleMilestones(): CriticalMilestone[] {
    return this.showAllMilestones
      ? this.criticalMilestones
      : this.criticalMilestones.slice(0, 6);
  }

  onAcChange(): void {
    if (this.selectedProject) this.buildEVM([], []);
    // Recalcular con los datos ya cargados
    if (this.selectedProject) this.loadDashboard();
  }

  fmt(n: number): string {
    return n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + 'M'
         : n >= 1_000     ? (n / 1_000).toFixed(1) + 'K'
         : n.toFixed(2);
  }
}
