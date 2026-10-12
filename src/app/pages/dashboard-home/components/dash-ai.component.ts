import { Component, OnDestroy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DashboardAiService } from 'app/services/dashboard-ai.service';
import { DASHBOARD_CATALOG, DashboardPlan, DashboardResult, DashboardSource, DashboardView, dateRange, validateDashboardPeriod, validateDashboardPlan } from 'app/services/dashboard-ai.model';

interface DashboardTemplate {
  name: string;
  sources: DashboardSource[];
  icon: string;
  description: string;
  prompt: string;
  indicators: string[];
  chart: string;
  detail: string;
}

@Component({
  selector: 'app-dash-ai',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './dash-ai.component.html',
  styleUrl: './dash-ai.component.scss',
})
export class DashAiComponent implements OnDestroy {
  private readonly ai = inject(DashboardAiService);
  private readonly signalsService = inject(SignalsService);
  readonly branchName = this.signalsService.getBranchNameSelectedBySidebar();
  readonly projectName = this.signalsService.getProjectNameBySidebar();
  readonly templates: DashboardTemplate[] = [
    {
      name: 'Control de proyectos', sources: ['projects'], icon: 'bi-kanban',
      description: 'Avance real, planeado y estado actual.',
      prompt: 'Crea un dashboard del proyecto activo con avance real contra planeado, número de proyectos y estado actual.',
      indicators: ['Avance real', 'Avance planeado', 'Proyectos', 'Estado actual'],
      chart: 'Avance actual por proyecto', detail: 'Proyectos y estados',
    },
    {
      name: 'Finanzas', sources: ['incomes', 'expenses'], icon: 'bi-cash-stack',
      description: 'Ingresos y gastos registrados en el periodo.',
      prompt: 'Crea un dashboard financiero con ingresos y gastos registrados, tendencia mensual y tabla de documentos.',
      indicators: ['Ingresos registrados', 'Gastos registrados', 'Documentos', 'Estado'],
      chart: 'Ingresos y egresos por periodo', detail: 'Documentos registrados',
    },
    {
      name: 'Compras', sources: ['orders'], icon: 'bi-box-seam',
      description: 'Importes por moneda, proveedores y órdenes.',
      prompt: 'Dame las compras de todo este año, con importes por moneda, gráfica mensual y detalle por proveedor.',
      indicators: ['Órdenes', 'Abiertas / cerradas', 'Materiales', 'Valor de inventario'],
      chart: 'Órdenes por mes y estado de stock', detail: 'Órdenes e inventario actual',
    },
    {
      name: 'Resumen ejecutivo', sources: ['projects', 'incomes', 'expenses'], icon: 'bi-speedometer2',
      description: 'Avances, ingresos y gastos registrados.',
      prompt: 'Crea un dashboard ejecutivo con avances actuales de proyectos, ingresos y gastos registrados.',
      indicators: ['Proyectos', 'Avance real', 'Ingresos registrados', 'Gastos registrados'],
      chart: 'Avances e importes por periodo', detail: 'Proyectos y documentos registrados',
    },
  ];
  selectedTemplate: DashboardTemplate | null = null;
  prompt = '';
  period = 'month';
  requestedRange = dateRange('month');
  status = '';
  loading = false;
  error = '';
  plan: DashboardPlan | null = null;
  results: (DashboardResult & { series: any[]; chart: any; xaxis: any })[] = [];
  generatedAt = '';
  saved: { name: string; plan: DashboardPlan }[] = [];
  readonly catalog = DASHBOARD_CATALOG;
  readonly colors = ['#176d96', '#e2982d', '#27a277', '#8257bd'];
  readonly dataLabels = { enabled: false };
  private controller?: AbortController;
  private requestId = 0;
  private storageKey = '';

  constructor() {
    effect(() => {
      const company = this.signalsService.getRootSelectedBySidebar()();
      const user = this.signalsService.idUser();
      this.signalsService.getBranchSelectedBySidebar()();
      this.signalsService.getProjectSelectedBySidebar()();
      this.invalidate();
      this.plan = null;
      this.storageKey = `dashboard-ai-plans-v1:${user}:${company}`;
      this.saved = [];
      if (!user || !company) return;
      try {
        const items = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        if (Array.isArray(items)) this.saved = items.slice(0, 10).map(item => ({ name: String(item.name).slice(0, 160), plan: validateDashboardPlan(item.plan) }));
      } catch { this.saved = []; }
    });
  }

  ngOnDestroy(): void { this.controller?.abort(); this.requestId++; }

  invalidate(): void {
    this.controller?.abort();
    this.requestId++;
    this.results = [];
    this.generatedAt = '';
    this.error = '';
    this.status = '';
    this.loading = false;
  }

  changePeriod(): void {
    if (this.period !== 'custom') this.requestedRange = dateRange(this.period);
    if (this.plan) this.plan.period = { ...this.requestedRange };
    this.invalidate();
  }

  selectTemplate(template: DashboardTemplate): void {
    this.invalidate();
    this.plan = null;
    this.selectedTemplate = template;
    this.prompt = template.prompt;
  }

  async prepareRequest(): Promise<void> {
    if (!this.prompt.trim() || this.loading) return;
    await this.run(true);
  }

  async loadTemplate(): Promise<void> {
    if (!this.selectedTemplate || this.loading) return;
    this.plan = {
      title: this.selectedTemplate.name,
      limitations: ['Plantilla predefinida: no interpreta la solicitud escrita. Usa Generar con IA para personalizarla.'],
      widgets: this.selectedTemplate.sources.flatMap(source => {
        const metric = source === 'projects' ? 'progress' : 'amount';
        return [
          { title: this.catalog[source].label, source, metric, view: 'kpi', groupBy: 'name', search: '' },
          { title: this.catalog[source].label, source, metric, view: 'bar', groupBy: source === 'projects' ? 'name' : source === 'inventory' ? 'state' : 'month', search: '' },
        ] as DashboardPlan['widgets'];
      }),
    };
    await this.run(false);
  }

  async refresh(): Promise<void> { if (this.plan && !this.loading) await this.run(false); }

  private async run(generate: boolean): Promise<void> {
    const previous = this.plan;
    this.invalidate();
    const requestId = this.requestId;
    this.controller = new AbortController();
    const controller = this.controller;
    const deadline = setTimeout(() => controller.abort(), 60000);
    const context = {
      company: Number(this.signalsService.getRootSelectedBySidebar()() || 0),
      branch: Number(this.signalsService.getBranchSelectedBySidebar()() || 0),
      project: Number(this.signalsService.getProjectSelectedBySidebar()() || 0),
      user: Number(this.signalsService.idUser() || 0), ...this.requestedRange,
    };
    this.loading = true;
    this.status = generate ? 'La IA está diseñando tu dashboard…' : 'Consultando datos del ERP…';
    try {
      if (!context.company || !context.user) throw new Error('Selecciona una empresa y verifica tu sesión antes de generar el dashboard.');
      validateDashboardPeriod(context);
      const plan = generate ? await this.ai.createPlan(this.prompt, previous, controller.signal, this.requestedRange) : previous!;
      clearTimeout(deadline);
      if (requestId !== this.requestId) return;
      if (plan.period) {
        this.requestedRange = validateDashboardPeriod(plan.period);
        Object.assign(context, this.requestedRange);
        this.period = ['month', 'previous-month', 'quarter', 'year'].find(period => {
          const range = dateRange(period);
          return range.from === this.requestedRange.from && range.to === this.requestedRange.to;
        }) || 'custom';
      }
      this.plan = { ...plan, period: { ...this.requestedRange } };
      this.status = 'Consultando datos del ERP…';
      const results = plan.widgets.length ? await this.ai.load(plan, context) : [];
      if (requestId !== this.requestId) return;
      this.results = results.map(result => this.toChart(result));
      this.generatedAt = new Date().toLocaleString('es-MX');
      this.status = results.some(result => result.error) ? 'Dashboard cargado con fuentes no disponibles. Revisa los avisos de cada elemento.' : plan.widgets.length ? 'Dashboard actualizado con las fuentes consultadas.' : 'La solicitud no contiene indicadores disponibles. Revisa las limitaciones.';
    } catch (error: any) {
      if (requestId === this.requestId) {
        this.error = controller.signal.aborted ? 'La IA tardó demasiado. Intenta nuevamente.' : error?.message || 'No se pudo generar el dashboard.';
        this.status = '';
      }
    } finally {
      clearTimeout(deadline);
      if (requestId === this.requestId) this.loading = false;
    }
  }

  private toChart(result: DashboardResult) {
    return {
      ...result,
      series: result.currencySeries.length ? result.currencySeries : [{ name: `${result.widget.metric === 'count' ? 'Registros' : result.widget.metric === 'amount' ? 'Importe' : 'Avance'} (${result.unit})`, data: result.groups.map(group => group.value === null ? null : Math.round(group.value * 100) / 100) }],
      chart: { type: result.widget.view === 'line' ? 'line' : 'bar', height: 280, toolbar: { show: false }, animations: { enabled: false } },
      xaxis: { categories: result.groups.map(group => group.name), labels: { trim: true, rotate: -35 } },
    };
  }

  changeView(index: number, view: DashboardView): void {
    const widget = this.plan?.widgets[index];
    if (!widget) return;
    widget.view = view;
    this.results[index] = this.toChart({ ...this.results[index], widget });
  }

  save(): void {
    if (!this.plan || !this.plan.widgets.length || this.loading) return;
    const saved = [{ name: this.plan.title, plan: JSON.parse(JSON.stringify(this.plan)) }, ...this.saved.filter(item => item.name !== this.plan!.title)].slice(0, 10);
    try { localStorage.setItem(this.storageKey, JSON.stringify(saved)); this.saved = saved; this.status = 'Diseño guardado en este navegador. Al abrirlo se consultarán los datos de nuevo.'; }
    catch { this.error = 'El navegador no permitió guardar el diseño.'; }
  }

  async openSaved(index: number): Promise<void> {
    if (this.loading) return;
    this.plan = validateDashboardPlan(this.saved[index].plan);
    this.prompt = `Actualiza el dashboard ${this.plan.title}`;
    await this.run(false);
  }
}
