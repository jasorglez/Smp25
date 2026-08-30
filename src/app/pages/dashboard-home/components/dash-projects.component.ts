import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { firstValueFrom } from 'rxjs';
import { ContractsService } from 'app/services/contracts.service';
import { EstimatesService } from 'app/services/estimates.service';
import { GeneratorsService } from 'app/services/generators.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { WorkprogramsService } from 'app/services/workprograms.service';

@Component({
  selector: 'app-dash-projects',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  template: `
    <section class="projects-dashboard">
      <div class="hero-card">
        <div>
          <span class="eyebrow">PORTAFOLIO EJECUTIVO</span>
          <h2>Dashboard de Proyectos</h2>
          <p>Contratos, ejecución, estimaciones y generadores en una sola vista.</p>
        </div>
        <div class="hero-status">
          <span class="live-dot"></span>
          {{ loading ? 'Actualizando información…' : 'Información actualizada' }}
        </div>
      </div>

      <div *ngIf="errorMessage" class="alert alert-warning py-2 mb-3">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}
      </div>

      <div class="kpi-grid">
        <article class="kpi-card blue">
          <div class="kpi-icon"><i class="bi bi-kanban-fill"></i></div>
          <div><span>Proyectos</span><strong>{{ projects.length }}</strong><small>{{ activeProjects }} activos</small></div>
        </article>
        <article class="kpi-card violet">
          <div class="kpi-icon"><i class="bi bi-file-earmark-check-fill"></i></div>
          <div><span>Contratos</span><strong>{{ contracts.length }}</strong><small>{{ activeContracts }} vigentes</small></div>
        </article>
        <article class="kpi-card green">
          <div class="kpi-icon"><i class="bi bi-calculator-fill"></i></div>
          <div><span>Estimaciones</span><strong>{{ estimates.length }}</strong><small>{{ formatMoney(estimatedMxn, 'MXN') }}</small></div>
        </article>
        <article class="kpi-card orange">
          <div class="kpi-icon"><i class="bi bi-rulers"></i></div>
          <div><span>Generadores</span><strong>{{ generators.length }}</strong><small>{{ generatorPhases }} fases</small></div>
        </article>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-xl-8">
          <article class="dash-card h-100">
            <header>
              <span><i class="bi bi-graph-up-arrow"></i> Avance programado vs. avance real</span>
              <span class="header-count">Programa de obra</span>
            </header>
            <div class="chart-wrap progress-chart" *ngIf="projectProgress.length; else noProgressData">
              <apx-chart [series]="progressChartSeries" [chart]="progressChart" [xaxis]="progressChartXaxis"
                         [colors]="progressColors" [plotOptions]="progressPlot" [dataLabels]="progressLabels"
                         [legend]="progressLegend" [tooltip]="progressTooltip"></apx-chart>
            </div>
            <ng-template #noProgressData><div class="empty-state">Sin programa de obra para calcular avances</div></ng-template>
          </article>
        </div>
        <div class="col-12 col-xl-4">
          <article class="dash-card h-100">
            <header><span><i class="bi bi-speedometer2"></i> Desempeño del portafolio</span></header>
            <div class="portfolio-progress">
              <div class="progress-summary">
                <div><span>Programado</span><strong>{{ averageScheduled | number:'1.1-1' }}%</strong></div>
                <div><span>Real</span><strong [class.behind]="averageActual < averageScheduled">{{ averageActual | number:'1.1-1' }}%</strong></div>
                <div><span>Variación</span><strong [class.behind]="progressVariance < 0">{{ progressVariance > 0 ? '+' : '' }}{{ progressVariance | number:'1.1-1' }} pts</strong></div>
              </div>
              <div class="project-progress-item" *ngFor="let item of projectProgress">
                <div class="progress-title"><span [title]="item.name">{{ item.name }}</span><strong>{{ item.actual | number:'1.1-1' }}%</strong></div>
                <div class="dual-track">
                  <div class="scheduled" [style.width.%]="item.scheduled"></div>
                  <div class="actual" [class.behind]="item.actual < item.scheduled" [style.width.%]="item.actual"></div>
                </div>
                <small>Programado {{ item.scheduled | number:'1.1-1' }}% · {{ varianceLabel(item) }}</small>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-xl-4">
          <article class="dash-card h-100">
            <header><span><i class="bi bi-pie-chart-fill"></i> Estado del portafolio</span></header>
            <div class="chart-wrap" *ngIf="projectStateSeries.length; else noProjectData">
              <apx-chart [series]="projectStateSeries" [chart]="donutChart" [labels]="projectStateLabels"
                         [colors]="projectStateColors" [legend]="donutLegend" [dataLabels]="donutLabels"></apx-chart>
            </div>
            <ng-template #noProjectData><div class="empty-state">Sin proyectos para mostrar</div></ng-template>
          </article>
        </div>

        <div class="col-12 col-xl-5">
          <article class="dash-card h-100">
            <header><span><i class="bi bi-bar-chart-fill"></i> Estimaciones por contrato</span></header>
            <div class="chart-wrap" *ngIf="estimateChartSeries[0]?.data?.length; else noEstimateData">
              <apx-chart [series]="estimateChartSeries" [chart]="barChart" [xaxis]="estimateChartXaxis"
                         [colors]="barColors" [plotOptions]="barPlot" [dataLabels]="barLabels"
                         [tooltip]="barTooltip"></apx-chart>
            </div>
            <ng-template #noEstimateData><div class="empty-state">Sin estimaciones capturadas</div></ng-template>
          </article>
        </div>

        <div class="col-12 col-xl-3">
          <article class="dash-card h-100 financial-card">
            <header><span><i class="bi bi-cash-stack"></i> Resumen contractual</span></header>
            <div class="financial-body">
              <div class="money-row"><span>Contratado MN</span><strong>{{ formatMoney(contractedMxn, 'MXN') }}</strong></div>
              <div class="money-row"><span>Estimado MN</span><strong class="text-success">{{ formatMoney(estimatedMxn, 'MXN') }}</strong></div>
              <div class="progress-shell"><div [style.width.%]="financialProgress"></div></div>
              <small>{{ financialProgress | number:'1.0-1' }}% estimado sobre contratado</small>
              <div class="money-row usd"><span>Contratado USD</span><strong>{{ formatMoney(contractedUsd, 'USD') }}</strong></div>
              <div class="money-row"><span>Estimado USD</span><strong>{{ formatMoney(estimatedUsd, 'USD') }}</strong></div>
            </div>
          </article>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-xl-7">
          <article class="dash-card">
            <header>
              <span><i class="bi bi-diagram-3-fill"></i> Proyectos y fechas clave</span>
              <span class="header-count">{{ projects.length }} proyectos</span>
            </header>
            <div class="project-list">
              <div class="project-row" *ngFor="let project of projectsSorted">
                <div class="project-mark" [class.overdue]="isOverdue(project.programEnd)"></div>
                <div class="project-main">
                  <strong [title]="project.name">{{ project.name || project.number }}</strong>
                  <span>{{ project.contractNumber || 'Sin contrato' }} · {{ project.branchName || 'Sin sucursal' }}</span>
                </div>
                <span class="status-pill" [class.done]="isCompleted(project.state)" [class.late]="isOverdue(project.programEnd)">
                  {{ project.state || 'Sin estado' }}
                </span>
                <div class="project-date">
                  <span>{{ project.programEnd | date:'dd MMM yyyy' }}</span>
                  <small>{{ deadlineLabel(project.programEnd) }}</small>
                </div>
              </div>
              <div class="empty-state" *ngIf="!projects.length">Sin proyectos registrados</div>
            </div>
          </article>
        </div>

        <div class="col-12 col-xl-5">
          <article class="dash-card mb-3">
            <header><span><i class="bi bi-receipt-cutoff"></i> Estimaciones recientes</span></header>
            <div class="activity-list">
              <div class="activity-row" *ngFor="let estimate of recentEstimates">
                <div class="activity-number">{{ estimate.number || '—' }}</div>
                <div class="activity-main">
                  <strong>{{ contractName(estimate.idContract) }}</strong>
                  <span>{{ estimate.dateStart | date:'dd MMM' }} – {{ estimate.dateEnd | date:'dd MMM yyyy' }}</span>
                </div>
                <strong class="activity-amount">{{ estimateAmount(estimate) }}</strong>
              </div>
              <div class="empty-state" *ngIf="!estimates.length">Sin estimaciones registradas</div>
            </div>
          </article>

          <article class="dash-card">
            <header><span><i class="bi bi-bounding-box-circles"></i> Generadores por fase</span></header>
            <div class="phase-cloud" *ngIf="phaseEntries.length; else noGenerators">
              <div class="phase-chip" *ngFor="let phase of phaseEntries">
                <span>{{ phase.name }}</span><strong>{{ phase.count }}</strong>
              </div>
            </div>
            <ng-template #noGenerators><div class="empty-state">Sin generadores registrados</div></ng-template>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .projects-dashboard { padding: 2px; color: #172033; }
    .hero-card { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:22px 26px; margin-bottom:16px; border-radius:16px; color:#fff; background:linear-gradient(120deg,#172554 0%,#1d4ed8 58%,#0891b2 100%); box-shadow:0 10px 30px rgba(30,64,175,.22); }
    .eyebrow { font-size:10px; font-weight:800; letter-spacing:2px; opacity:.72; }
    .hero-card h2 { margin:3px 0 2px; font-size:24px; font-weight:800; }
    .hero-card p { margin:0; opacity:.78; font-size:12px; }
    .hero-status { display:flex; align-items:center; gap:8px; font-size:11px; padding:7px 11px; border:1px solid rgba(255,255,255,.25); border-radius:20px; background:rgba(255,255,255,.1); white-space:nowrap; }
    .live-dot { width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 0 4px rgba(74,222,128,.18); }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
    .kpi-card { display:flex; align-items:center; gap:14px; min-height:98px; padding:16px 18px; background:#fff; border:1px solid #e8edf5; border-radius:13px; box-shadow:0 3px 14px rgba(15,23,42,.055); }
    .kpi-icon { width:45px; height:45px; display:grid; place-items:center; border-radius:12px; color:#fff; font-size:20px; }
    .kpi-card.blue .kpi-icon{background:linear-gradient(135deg,#2563eb,#60a5fa)} .kpi-card.violet .kpi-icon{background:linear-gradient(135deg,#7c3aed,#a78bfa)}
    .kpi-card.green .kpi-icon{background:linear-gradient(135deg,#059669,#34d399)} .kpi-card.orange .kpi-icon{background:linear-gradient(135deg,#ea580c,#fb923c)}
    .kpi-card span { display:block; color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
    .kpi-card strong { display:inline-block; margin:1px 9px 0 0; font-size:25px; line-height:1.1; color:#0f172a; }
    .kpi-card small { color:#94a3b8; font-size:10px; }
    .dash-card { overflow:hidden; background:#fff; border:1px solid #e8edf5; border-radius:13px; box-shadow:0 3px 14px rgba(15,23,42,.05); }
    .dash-card header { min-height:43px; display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #edf1f7; background:#fbfcff; color:#1e3a8a; font-size:12px; font-weight:800; }
    .dash-card header i { margin-right:7px; color:#3b82f6; }
    .header-count { font-size:10px; color:#64748b; font-weight:600; }
    .chart-wrap { min-height:245px; display:grid; place-items:center; padding:4px 8px; }
    .progress-chart { min-height:310px; }
    .portfolio-progress { padding:14px; max-height:340px; overflow:auto; }
    .progress-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-bottom:14px; }
    .progress-summary div { padding:9px 6px; text-align:center; border-radius:9px; background:#f8fafc; }
    .progress-summary span { display:block; color:#64748b; font-size:8px; font-weight:700; text-transform:uppercase; }
    .progress-summary strong { color:#059669; font-size:15px; } .progress-summary strong.behind{color:#dc2626}
    .project-progress-item { padding:8px 2px; border-bottom:1px solid #f0f3f8; }
    .progress-title { display:flex; justify-content:space-between; gap:10px; font-size:10px; }
    .progress-title span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-weight:700; }
    .progress-title strong { color:#2563eb; }
    .dual-track { position:relative; height:9px; margin:6px 0 4px; overflow:hidden; border-radius:8px; background:#e2e8f0; }
    .dual-track .scheduled { position:absolute; inset:0 auto 0 0; background:#fbbf24; opacity:.6; }
    .dual-track .actual { position:absolute; left:0; bottom:0; height:4px; background:#10b981; border-radius:5px; }
    .dual-track .actual.behind { background:#ef4444; }
    .project-progress-item small { color:#64748b; font-size:8px; }
    .financial-body { padding:18px 16px; }
    .money-row { display:flex; justify-content:space-between; gap:8px; padding:9px 0; border-bottom:1px dashed #e2e8f0; font-size:11px; color:#64748b; }
    .money-row strong { color:#0f172a; font-size:12px; }
    .money-row.usd { margin-top:12px; }
    .progress-shell { height:8px; margin:15px 0 5px; overflow:hidden; border-radius:8px; background:#e2e8f0; }
    .progress-shell div { height:100%; border-radius:8px; background:linear-gradient(90deg,#2563eb,#10b981); }
    .financial-body small { display:block; text-align:right; color:#64748b; font-size:9px; }
    .project-list { max-height:360px; overflow:auto; }
    .project-row { display:grid; grid-template-columns:5px minmax(0,1fr) auto 105px; align-items:center; gap:11px; padding:12px 14px; border-bottom:1px solid #f0f3f8; }
    .project-row:last-child,.activity-row:last-child { border-bottom:0; }
    .project-mark { width:5px; height:36px; border-radius:5px; background:#3b82f6; } .project-mark.overdue{background:#ef4444}
    .project-main { min-width:0; } .project-main strong { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:12px; }
    .project-main span,.project-date span,.project-date small,.activity-main span { display:block; color:#64748b; font-size:9px; }
    .project-date { text-align:right; } .project-date small { color:#94a3b8; }
    .status-pill { padding:4px 8px; border-radius:12px; background:#dbeafe; color:#1d4ed8; font-size:9px; font-weight:800; text-transform:uppercase; }
    .status-pill.done { background:#dcfce7; color:#15803d; } .status-pill.late:not(.done){background:#fee2e2;color:#b91c1c}
    .activity-list { max-height:195px; overflow:auto; }
    .activity-row { display:flex; align-items:center; gap:10px; padding:10px 13px; border-bottom:1px solid #f0f3f8; }
    .activity-number { width:31px; height:31px; display:grid; place-items:center; border-radius:9px; background:#eef2ff; color:#4338ca; font-size:9px; font-weight:800; }
    .activity-main { flex:1; min-width:0; } .activity-main strong { display:block; font-size:10px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .activity-amount { font-size:10px; color:#047857; white-space:nowrap; }
    .phase-cloud { display:flex; flex-wrap:wrap; gap:8px; padding:14px; }
    .phase-chip { display:flex; align-items:center; gap:9px; padding:7px 9px 7px 11px; border-radius:18px; background:#f1f5f9; color:#475569; font-size:10px; font-weight:700; }
    .phase-chip strong { min-width:20px; height:20px; display:grid; place-items:center; border-radius:50%; background:#0f766e; color:#fff; font-size:9px; }
    .empty-state { padding:42px 12px; text-align:center; color:#94a3b8; font-size:11px; }
    @media(max-width:992px){.kpi-grid{grid-template-columns:repeat(2,1fr)}.project-row{grid-template-columns:5px minmax(0,1fr) auto}.project-date{display:none}}
    @media(max-width:576px){.hero-card{align-items:flex-start;flex-direction:column}.kpi-grid{grid-template-columns:1fr}.hero-status{align-self:flex-start}}
  `]
})
export class DashProjectsComponent {
  private projectsService = inject(ProjectsService);
  private contractsService = inject(ContractsService);
  private estimatesService = inject(EstimatesService);
  private generatorsService = inject(GeneratorsService);
  private signalsService = inject(SignalsService);
  private workprogramsService = inject(WorkprogramsService);

  projects: any[] = [];
  contracts: any[] = [];
  estimates: any[] = [];
  generators: any[] = [];
  projectProgress: { id: number; name: string; scheduled: number; actual: number; activities: number }[] = [];
  loading = false;
  errorMessage = '';
  private loadedCompany: number | null = null;

  projectStateSeries: number[] = [];
  projectStateLabels: string[] = [];
  projectStateColors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#64748b'];
  estimateChartSeries: any[] = [{ name: 'Estimaciones', data: [] }];
  estimateChartXaxis: any = { categories: [] };
  readonly donutChart: any = { type: 'donut', height: 245, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
  readonly donutLegend: any = { position: 'bottom', fontSize: '10px' };
  readonly donutLabels: any = { enabled: true, formatter: (value: number) => value.toFixed(0) + '%' };
  readonly barChart: any = { type: 'bar', height: 245, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
  readonly barColors = ['#2563eb'];
  readonly barPlot: any = { bar: { horizontal: true, borderRadius: 4, barHeight: '55%', distributed: false } };
  readonly barLabels: any = { enabled: true, style: { fontSize: '10px' } };
  readonly barTooltip: any = { y: { formatter: (value: number) => `${value} estimación${value === 1 ? '' : 'es'}` } };
  progressChartSeries: any[] = [];
  progressChartXaxis: any = { categories: [] };
  readonly progressChart: any = { type: 'bar', height: 310, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' };
  readonly progressColors = ['#f59e0b', '#2563eb'];
  readonly progressPlot: any = { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } };
  readonly progressLabels: any = { enabled: true, formatter: (value: number) => `${value.toFixed(1)}%`, style: { fontSize: '9px' } };
  readonly progressLegend: any = { position: 'top', horizontalAlign: 'right', fontSize: '10px' };
  readonly progressTooltip: any = { shared: true, intersect: false, y: { formatter: (value: number) => `${value.toFixed(2)}%` } };

  constructor() {
    effect(() => {
      const companyId = this.signalsService.getRootSelectedBySidebar()();
      if (companyId && companyId !== this.loadedCompany) {
        this.loadedCompany = companyId;
        this.loadDashboard(companyId);
      }
    });
  }

  get activeProjects(): number { return this.projects.filter(p => p.active !== 0 && !this.isCompleted(p.state)).length; }
  get activeContracts(): number { return this.contracts.filter(c => c.active !== 0 && String(c.stateContract || '').toUpperCase() === 'ACTIVO').length; }
  get contractedMxn(): number { return this.contracts.reduce((sum, c) => sum + Number(c.amountMx || 0), 0); }
  get contractedUsd(): number { return this.contracts.reduce((sum, c) => sum + Number(c.amountDll || 0), 0); }
  get estimatedMxn(): number { return this.estimates.reduce((sum, e) => sum + Number(e.amountMX || 0), 0); }
  get estimatedUsd(): number { return this.estimates.reduce((sum, e) => sum + Number(e.amountDLL || 0), 0); }
  get financialProgress(): number { return this.contractedMxn > 0 ? Math.min(100, this.estimatedMxn / this.contractedMxn * 100) : 0; }
  get generatorPhases(): number { return this.phaseEntries.length; }
  get averageScheduled(): number { return this.averageProgress('scheduled'); }
  get averageActual(): number { return this.averageProgress('actual'); }
  get progressVariance(): number { return this.averageActual - this.averageScheduled; }
  get projectsSorted(): any[] { return [...this.projects].sort((a, b) => new Date(a.programEnd || 0).getTime() - new Date(b.programEnd || 0).getTime()); }
  get recentEstimates(): any[] { return [...this.estimates].sort((a, b) => new Date(b.dateEnd || 0).getTime() - new Date(a.dateEnd || 0).getTime()).slice(0, 6); }
  get phaseEntries(): { name: string; count: number }[] {
    const phases = new Map<string, number>();
    this.generators.forEach(g => {
      const name = String(g.fase || 'Sin fase').trim().toUpperCase();
      phases.set(name, (phases.get(name) || 0) + 1);
    });
    return [...phases.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  private async loadDashboard(companyId: number): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const projectsResult: any = await firstValueFrom(this.projectsService.getProjectListByCompany(companyId));
      this.projects = Array.isArray(projectsResult) ? projectsResult : [];
      const contractIds = [...new Set(this.projects.map(p => Number(p.idContrato)).filter(id => id > 0))];

      const workprogramResults = await Promise.all(this.projects.map(project =>
        this.safeLoad(() => this.workprogramsService.getWorkPrograms(Number(project.id), 'Project'))
      ));
      this.projectProgress = this.projects.map((project, index) => this.calculateProjectProgress(project, workprogramResults[index]))
        .filter(item => item.activities > 0)
        .sort((a, b) => b.scheduled - a.scheduled);

      const contractResults = await Promise.all(contractIds.map(id => this.safeLoad(() => this.contractsService.getContractById(id))));
      this.contracts = contractResults.flatMap(result => Array.isArray(result) ? result : result ? [result] : []);

      const estimateResults = await Promise.all(contractIds.map(id => this.safeLoad(() => this.estimatesService.getEstimates(id))));
      this.estimates = estimateResults.flatMap(result => Array.isArray(result) ? result : []);

      const generatorResults = await Promise.all(this.estimates.map(e => this.safeLoad(() => this.generatorsService.getGenerators(Number(e.id)))));
      this.generators = generatorResults.flatMap(result => Array.isArray(result) ? result : []);
      this.buildCharts();
    } catch (error) {
      console.error('Error cargando dashboard de proyectos:', error);
      this.errorMessage = 'No fue posible cargar toda la información de proyectos. Verifica tu sesión e intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  private async safeLoad(factory: () => any): Promise<any> {
    try { return await firstValueFrom(factory()); }
    catch { return []; }
  }

  private buildCharts(): void {
    const stateMap = new Map<string, number>();
    this.projects.forEach(project => {
      const state = String(project.state || 'Sin estado').trim();
      stateMap.set(state, (stateMap.get(state) || 0) + 1);
    });
    this.projectStateLabels = [...stateMap.keys()];
    this.projectStateSeries = [...stateMap.values()];

    const estimatesByContract = new Map<number, number>();
    this.estimates.forEach(estimate => estimatesByContract.set(Number(estimate.idContract), (estimatesByContract.get(Number(estimate.idContract)) || 0) + 1));
    const rows = [...estimatesByContract.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    this.estimateChartSeries = [{ name: 'Estimaciones', data: rows.map(([, count]) => count) }];
    this.estimateChartXaxis = { categories: rows.map(([id]) => this.contractName(id)), labels: { style: { fontSize: '9px', colors: '#64748b' } } };

    this.progressChartSeries = [
      { name: 'Programado', data: this.projectProgress.map(item => item.scheduled) },
      { name: 'Real', data: this.projectProgress.map(item => item.actual) }
    ];
    this.progressChartXaxis = {
      categories: this.projectProgress.map(item => item.name),
      min: 0, max: 100, tickAmount: 5,
      labels: { formatter: (value: number) => `${Number(value).toFixed(0)}%`, style: { fontSize: '9px', colors: '#64748b' } }
    };
  }

  private calculateProjectProgress(project: any, response: any): { id: number; name: string; scheduled: number; actual: number; activities: number } {
    const tasks = (Array.isArray(response) ? response : response?.data || []).filter((task: any) =>
      task.active !== 0 && String(task.typeActivity || '').toUpperCase() === 'ACTIVITY'
    );
    const now = Date.now();
    const weights = tasks.map((task: any) => Math.max(0, Number(task.ponderado || 0)));
    const hasWeights = weights.some((weight: number) => weight > 0);
    const denominator = hasWeights ? weights.reduce((sum: number, weight: number) => sum + weight, 0) : tasks.length;
    let scheduled = 0;
    let actual = 0;
    tasks.forEach((task: any, index: number) => {
      const weight = hasWeights ? weights[index] : 1;
      const start = new Date(task.startDate).getTime();
      const end = new Date(task.endDate).getTime();
      const plannedFraction = !Number.isFinite(start) || !Number.isFinite(end) ? 0
        : now >= end ? 1 : now <= start ? 0 : (now - start) / Math.max(1, end - start);
      scheduled += weight * plannedFraction;
      actual += weight * Math.min(1, Math.max(0, Number(task.progress || 0)));
    });
    return {
      id: Number(project.id), name: project.name || project.number || `Proyecto ${project.id}`,
      scheduled: denominator ? this.clampPercent(scheduled / denominator * 100) : 0,
      actual: denominator ? this.clampPercent(actual / denominator * 100) : 0,
      activities: tasks.length
    };
  }

  private averageProgress(field: 'scheduled' | 'actual'): number {
    if (!this.projectProgress.length) return 0;
    return this.projectProgress.reduce((sum, item) => sum + item[field], 0) / this.projectProgress.length;
  }

  private clampPercent(value: number): number { return Math.round(Math.min(100, Math.max(0, value || 0)) * 100) / 100; }
  varianceLabel(item: { scheduled: number; actual: number }): string {
    const variance = item.actual - item.scheduled;
    if (Math.abs(variance) < .05) return 'En programa';
    return `${Math.abs(variance).toFixed(1)} pts ${variance < 0 ? 'atrasado' : 'adelantado'}`;
  }

  contractName(id: number): string {
    const contract = this.contracts.find(c => Number(c.idContrato ?? c.id) === Number(id));
    return contract?.numberContract || this.projects.find(p => Number(p.idContrato) === Number(id))?.contractNumber || `Contrato ${id}`;
  }

  estimateAmount(estimate: any): string {
    const usd = Number(estimate.amountDLL || 0);
    return usd > 0 ? this.formatMoney(usd, 'USD') : this.formatMoney(Number(estimate.amountMX || 0), 'MXN');
  }

  formatMoney(value: number, currency: 'MXN' | 'USD'): string {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
  }

  isCompleted(state: string): boolean { return ['TERMINADO','FINALIZADO','CERRADO','COMPLETADO'].includes(String(state || '').toUpperCase()); }
  isOverdue(date: string): boolean { return !!date && new Date(date).getTime() < Date.now(); }
  deadlineLabel(date: string): string {
    if (!date) return 'Sin fecha final';
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return `Venció hace ${Math.abs(days)} días`;
    if (days === 0) return 'Vence hoy';
    return `${days} días restantes`;
  }
}
