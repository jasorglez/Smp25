import { Component, inject, effect, ViewChild } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { lastValueFrom }       from 'rxjs';
import { SignalsService }      from 'app/services/signals.service';
import { ProjectsService }     from 'app/services/projects.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { AdvanceService }      from 'app/services/advance.service';
import { RootService }         from 'app/services/root.service';
import { ConventionsService }  from 'app/services/conventions.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface TaskRow {
  id: number; wbs: string; name: string;
  duracion: number; inicio: string; fin: string;
  pctReal: number; pctProg: number; spi: number;
  isParent: boolean; level: number;
}

interface ReporteData {
  logo1: string; logo2: string; companyName: string;
  projectName: string; versionName: string;
  fechaCorte: string; fechaInicio: string; fechaFin: string;
  progAnterior: number; progActual: number; progAcumulado: number;
  realAnterior: number; realActual: number; realAcumulado: number;
  spi: number; eacDate: string;
  sinPrograma: number; programadas: number; conAvance: number; total: number;
  enTiempo: number; terminadas: number; retrasadas: number; retrasadasSinIniciar: number;
  tasks: TaskRow[];
  chartLabels: string[]; chartProg: number[]; chartReal: number[]; chartTrend: number[];
  footerText: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dateStr(d: any): string {
  if (!d) return '';
  return String(d).split('T')[0];
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function progTask(startDate: string, endDate: string, cut: string): number {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  const c = new Date(cut).getTime();
  if (c <= s) return 0;
  if (c >= e) return 100;
  return Math.round(((c - s) / (e - s)) * 1000) / 10;
}
function linReg(pts: [number, number][]): { m: number; b: number } {
  const n = pts.length;
  if (n < 2) return { m: 0, b: pts[0]?.[1] ?? 0 };
  const sx = pts.reduce((a, p) => a + p[0], 0);
  const sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
  const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx) || 0;
  const b = (sy - m * sx) / n;
  return { m, b };
}
function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d}-${months[+m - 1]}-${y.substring(2)}`;
}

// ═════════════════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-pmo-reporte-seguimiento',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './pmo-reporte-seguimiento.component.html',
  styleUrl:    './pmo-reporte-seguimiento.component.scss',
})
export class PmoReporteSeguimientoComponent {

  @ViewChild('sCurveChart') sCurveChart?: ChartComponent;
  @ViewChild('barChart')    barChart?:    ChartComponent;

  private _signals      = inject(SignalsService);
  private _projects     = inject(ProjectsService);
  private _wp           = inject(WorkprogramsService);
  private _adv          = inject(AdvanceService);
  private _root         = inject(RootService);
  private _conventions  = inject(ConventionsService);

  // ── Estado ──────────────────────────────────────────────────────────────────
  idCompany      = 0;
  projects: any[] = [];
  selectedProjectId: number | null = null;

  versions: any[] = [];
  selectedVersionId: number | null = null;
  loadingVersions = false;

  fechaCorte = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  isLoading   = false;
  report: ReporteData | null = null;

  // ── Chart options ────────────────────────────────────────────────────────────
  sCurveOpts: any  = {};
  barOpts:    any  = {};
  gauge1Opts: any  = {};
  gauge2Opts: any  = {};
  gauge3Opts: any  = {};

  readonly Math = Math;

  // ── Constructor ──────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const id = this._signals.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) { this.idCompany = id; this.loadProjects(); }
    });
  }

  // ── Carga inicial ────────────────────────────────────────────────────────────
  async loadProjects(): Promise<void> {
    try {
      const res: any = await lastValueFrom(this._projects.getProjectListByCompany(this.idCompany));
      this.projects  = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  async onProjectChange(): Promise<void> {
    this.versions = [];
    this.selectedVersionId = null;
    this.report = null;
    if (!this.selectedProjectId) return;
    await this.loadVersions();
  }

  async loadVersions(): Promise<void> {
    this.loadingVersions = true;
    try {
      // Igual que Avances: buscar contractId del proyecto, si existe usar 'Contract', si no 'Project'
      const contractId = this.resolveContractId(this.selectedProjectId);
      const scopeType  = contractId ? 'Contract' : 'Project';
      const scopeId    = contractId ?? this.selectedProjectId;

      const res: any = await lastValueFrom(
        this._conventions.getConventionsByContractOrProject(scopeType, scopeId)
      ).catch(() => []);
      this.versions = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      // Auto-seleccionar si solo hay una versión
      if (this.versions.length === 1) {
        this.selectedVersionId = this.versions[0].id ?? this.versions[0].idConvention;
      }
    } finally {
      this.loadingVersions = false;
    }
  }

  private resolveContractId(projectId: number | null): number | null {
    if (!projectId) return null;
    const project = this.projects.find((p: any) => Number(p.id ?? p.idProject) === Number(projectId));
    const candidates = [
      project?.idContrato, project?.id_contrato,
      project?.idContract, project?.id_contract,
      project?.contractId, project?.contract_id,
      project?.selectedContract, project?.idc,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (!isNaN(n) && n > 0) return n;
    }
    return null;
  }

  onVersionChange(): void {
    this.report = null;
  }

  // ── Construir reporte ────────────────────────────────────────────────────────
  async buildReport(): Promise<void> {
    if (!this.selectedProjectId) return;
    this.isLoading = true;
    this.report    = null;
    try {
      const idPrj    = this.selectedProjectId;
      const idVer    = this.selectedVersionId;
      const cut      = this.fechaCorte;

      // Workprogram: filtrado por versión si hay una seleccionada
      const wpCall = idVer
        ? this._wp.getByConvention(idVer, idPrj)
        : this._wp.getWorkPrograms(idPrj, 'Project');

      // Avances: filtrado por convenio en backend (incluye id_convenio=0 para registros viejos)
      const advCall = idVer
        ? this._adv.getAdvancesByConvenio(idPrj, 'Project', idVer)
        : this._adv.getAdvancesByProject(idPrj, 'Project');

      const [rootRes, tasksRaw, advancesRaw] = await Promise.all([
        lastValueFrom(this._root.getRootbyId(this.idCompany)).catch(() => ({})),
        lastValueFrom(wpCall).catch(() => []),
        lastValueFrom(advCall).catch(() => []),
      ]);

      const root: any      = rootRes ?? {};
      const tasks: any[]   = Array.isArray((tasksRaw as any)?.data) ? (tasksRaw as any).data
                           : (Array.isArray(tasksRaw) ? tasksRaw as any[] : []);

      const advances: any[] = Array.isArray((advancesRaw as any)?.data) ? (advancesRaw as any).data
                            : (Array.isArray(advancesRaw) ? advancesRaw as any[] : []);

      // ── Fechas del proyecto (de las tareas raíz) ─────────────────────────────
      const allStarts = tasks.map(t => dateStr(t.startdate ?? t.startDate)).filter(Boolean);
      const allEnds   = tasks.map(t => dateStr(t.endate ?? t.endDate)).filter(Boolean);
      const projStart = allStarts.length ? allStarts.sort()[0]  : cut;
      const projEnd   = allEnds.length   ? allEnds.sort().reverse()[0] : cut;

      // ── Avances ordenados hasta el corte ─────────────────────────────────────
      const advSorted = advances
        .map((a: any) => ({ ...a, dateStr: dateStr(a.date) }))
        .filter(a => a.dateStr && a.dateStr <= cut)
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      const lastAdv     = advSorted.length ? advSorted[advSorted.length - 1] : null;
      const prevAdv     = advSorted.length > 1 ? advSorted[advSorted.length - 2] : null;

      const progAcum  = Number(lastAdv?.accumulateProgram  ?? lastAdv?.accumulateprogram  ?? 0);
      const realAcum  = Number(lastAdv?.accumulatePhysical ?? lastAdv?.accumulatephysical ?? 0);
      const progPrev  = Number(prevAdv?.accumulateProgram  ?? prevAdv?.accumulateprogram  ?? 0);
      const realPrev  = Number(prevAdv?.accumulatePhysical ?? prevAdv?.accumulatephysical ?? 0);
      const progActual = Math.max(0, progAcum - progPrev);
      const realActual = Math.max(0, realAcum - realPrev);

      const spi = progAcum > 0 ? Math.round((realAcum / progAcum) * 100) / 100 : 0;

      // ── EAC ──────────────────────────────────────────────────────────────────
      let eacDate = projEnd;
      if (spi > 0 && projStart && projEnd) {
        const durMs  = new Date(projEnd).getTime() - new Date(projStart).getTime();
        const eacMs  = new Date(projStart).getTime() + durMs / spi;
        eacDate = new Date(eacMs).toISOString().split('T')[0];
      }

      // ── Estatus de actividades ─────────────────────────────────────────────
      let sinPrograma = 0, programadas = 0, conAvance = 0;
      tasks.forEach(t => {
        const s = dateStr(t.startdate ?? t.startDate);
        const e = dateStr(t.endate   ?? t.endDate);
        const p = Number(t.progress ?? 0);
        if (!s || !e)             { sinPrograma++; return; }
        if (s <= cut) {
          conAvance++;            // tiene programa al corte
          if (p > 0) programadas++; // además tiene avance real
        } else sinPrograma++;
      });
      const total = tasks.length;

      // ── Gauges: terminadas / en tiempo / retrasadas ─────────────────────────
      let terminadas = 0, retrasadas = 0, enTiempo = 0, retrasadasSI = 0;
      tasks.forEach(t => {
        const s = dateStr(t.startdate ?? t.startDate);
        const e = dateStr(t.endate   ?? t.endDate);
        const p = Number(t.progress ?? 0);
        if (!s || !e) return;
        if (p >= 1)              { terminadas++;  return; }
        if (e < cut && p < 1) {
          retrasadas++;
          if (p === 0) retrasadasSI++;
          return;
        }
        if (s <= cut && p > 0)   enTiempo++;
      });
      const gaugeBase = conAvance || 1;

      // ── Tabla de tareas ───────────────────────────────────────────────────
      const parentSet = new Set(tasks.map(t => String(t.parent)).filter(p => p !== '0' && p !== ''));
      const getEffId  = (t: any) => String(t.idTask ?? t.idtask ?? '0') === '0' ? String(t.id) : String(t.idTask ?? t.idtask);

      const taskRows: TaskRow[] = tasks
        .filter(t => dateStr(t.startdate ?? t.startDate))
        .map(t => {
          const s     = dateStr(t.startdate ?? t.startDate);
          const e     = dateStr(t.endate   ?? t.endDate);
          const prog  = Number(t.progress ?? 0);
          const pReal = Math.round(prog * 100 * 10) / 10;
          const pProg = progTask(s, e, cut);
          const tSpi  = pProg > 0 ? Math.round((pReal / pProg) * 100) / 100 : (pReal > 0 ? 1 : 0);
          const isP   = parentSet.has(getEffId(t));
          const wbs   = String(t.activity ?? '');
          const level = wbs.split('.').length;
          return {
            id: Number(t.id), wbs, name: t.description ?? t.text ?? '',
            duracion: (s && e) ? daysBetween(s, e) : 0,
            inicio: s, fin: e,
            pctReal: pReal, pctProg: pProg, spi: tSpi,
            isParent: isP, level,
          };
        })
        .sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true }));

      // ── Curva S ──────────────────────────────────────────────────────────────
      const labels: string[] = [];
      const prog:   number[] = [];
      const real:   number[] = [];

      advSorted.forEach(a => {
        labels.push(a.dateStr);
        prog.push(Math.round(Number(a.accumulateProgram  ?? a.accumulateprogram  ?? 0) * 100) / 100);
        real.push(Math.round(Number(a.accumulatePhysical ?? a.accumulatephysical ?? 0) * 100) / 100);
      });

      // Tendencia estadística: regresión lineal sobre avance real → proyectar a fechaFin
      const trend: number[] = Array(labels.length).fill(null);
      if (real.length >= 2) {
        const pts: [number, number][] = real.map((v, i) => [i, v]);
        const { m, b } = linReg(pts);
        // Proyectar hasta fechaFin: agregar puntos futuros
        const endIdx = Math.max(daysBetween(cut, projEnd) / 7, 0); // aprox semanas restantes
        for (let i = 0; i < labels.length; i++) {
          trend[i] = null; // solo mostrar línea proyectada
        }
        // Construir puntos de tendencia desde primer dato real hasta fin
        const trendExtLabels = [...labels];
        const trendExtProg   = [...prog];
        const trendExtReal   = [...real];
        const trendExt: (number | null)[] = Array(labels.length).fill(null);
        // Añadir punto de proyección al corte y al fin
        const projAtCut = Math.round((b + m * (real.length - 1)) * 100) / 100;
        const projAtEnd = Math.round((b + m * (real.length - 1 + endIdx)) * 100) / 100;
        trendExtLabels.push(projEnd);
        trendExtProg.push(null);
        trendExtReal.push(null);
        trendExt.push(Math.max(0, Math.min(100, projAtEnd)));
        // Línea de tendencia: primer y último punto reales + proyección
        trendExt[0] = Math.max(0, b);
        if (real.length > 1) trendExt[real.length - 1] = Math.max(0, projAtCut);

        this.report = this.buildReportObj({
          logo1: root.picture ?? '', logo2: root.picture2 ?? '',
          companyName: root.name ?? '', projectName: this.getProjectName(), versionName: this.getVersionName(),
          fechaCorte: cut, fechaInicio: projStart, fechaFin: projEnd,
          progAnterior: progPrev, progActual, progAcumulado: progAcum,
          realAnterior: realPrev, realActual, realAcumulado: realAcum,
          spi, eacDate,
          sinPrograma, programadas, conAvance, total,
          enTiempo, terminadas, retrasadas, retrasadasSinIniciar: retrasadasSI,
          tasks: taskRows,
          chartLabels: trendExtLabels, chartProg: trendExtProg as number[],
          chartReal: trendExtReal as number[], chartTrend: trendExt as number[],
          footerText: this.buildFooterText(spi, retrasadasSI, retrasadas, eacDate),
        });
        this.buildCharts(gaugeBase);
        return;
      }

      this.report = this.buildReportObj({
        logo1: root.picture ?? '', logo2: root.picture2 ?? '',
        companyName: root.name ?? '', projectName: this.getProjectName(), versionName: this.getVersionName(),
        fechaCorte: cut, fechaInicio: projStart, fechaFin: projEnd,
        progAnterior: progPrev, progActual, progAcumulado: progAcum,
        realAnterior: realPrev, realActual, realAcumulado: realAcum,
        spi, eacDate,
        sinPrograma, programadas, conAvance, total,
        enTiempo, terminadas, retrasadas, retrasadasSinIniciar: retrasadasSI,
        tasks: taskRows,
        chartLabels: labels, chartProg: prog, chartReal: real, chartTrend: trend,
        footerText: this.buildFooterText(spi, retrasadasSI, retrasadas, eacDate),
      });
      this.buildCharts(gaugeBase);

    } catch (err) {
      console.error('Error buildReport:', err);
    } finally {
      this.isLoading = false;
    }
  }

  private buildReportObj(d: ReporteData): ReporteData { return d; }

  private getProjectName(): string {
    const p = this.projects.find(x => Number(x.id ?? x.idProject) === Number(this.selectedProjectId));
    return p?.name ?? p?.nombre ?? p?.projectName ?? 'Proyecto';
  }

  private getVersionName(): string {
    if (!this.selectedVersionId) return '';
    const v = this.versions.find(x => Number(x.id ?? x.idConvention) === Number(this.selectedVersionId));
    return v?.name ?? v?.nombre ?? v?.version ?? '';
  }

  private buildFooterText(spi: number, retSI: number, ret: number, eac: string): string {
    const spiTxt = spi < 1
      ? `de continuar con esta tendencia, se eleva su riesgo de pérdida en aproximadamente ${Math.round((1/spi - 1) * 100)}% de tiempo adicional.`
      : `el proyecto se encuentra adelantado respecto al programa.`;
    return `El Índice de Desempeño del Programa (SPI) al presente corte es de ${spi.toFixed(2)}. ${spiTxt} ` +
      `En cuanto a las actividades programadas NO iniciadas tenemos que siguen aumentando, al momento son ${retSI}, ` +
      `además se suman ${ret} actividades con retraso, por lo cual la fecha pronóstico de finalización (EAC) ` +
      `continúa alejándose de la fecha original. Fecha EAC estimada: ${fmtDate(eac)}.`;
  }

  // ── Charts ───────────────────────────────────────────────────────────────────
  private buildCharts(gaugeBase: number): void {
    if (!this.report) return;
    const r = this.report;

    // Curva S
    const xLabels = r.chartLabels.map(fmtDate);
    this.sCurveOpts = {
      series: [
        { name: 'Programado',           data: r.chartProg,  type: 'line'   },
        { name: 'Real',                 data: r.chartReal,  type: 'line'   },
        { name: 'Tendencia estadística',data: r.chartTrend, type: 'line'   },
      ],
      chart: { height: 280, type: 'line' as any, toolbar: { show: false },
               background: '#fff', fontFamily: 'inherit', animations: { enabled: false } },
      colors: ['#1565c0','#c0392b','#7f8c8d'],
      stroke: { curve: 'smooth', width: [3, 3, 2], dashArray: [0, 0, 6] },
      markers: { size: [3,3,0], strokeWidth: 2 },
      fill: { opacity: [0.15, 0.15, 0] },
      dataLabels: { enabled: false },
      xaxis: { categories: xLabels, tickAmount: Math.min(xLabels.length, 18),
               labels: { rotate: -45, style: { fontSize: '9px', colors: '#555' } } },
      yaxis: { min: 0, max: 100, tickAmount: 10,
               labels: { formatter: (v: number) => v?.toFixed(0) + '%', style: { fontSize: '10px' } } },
      grid: { borderColor: '#e0e0e0', strokeDashArray: 2 },
      legend: { position: 'top', horizontalAlign: 'center', fontSize: '11px' },
      tooltip: { shared: true, intersect: false,
                 y: { formatter: (v: number) => v != null ? v.toFixed(2) + '%' : '-' } },
    };

    // Activity bar
    const barData = [r.sinPrograma, r.conAvance - r.programadas, r.programadas, r.total];
    this.barOpts = {
      series: [{ data: barData }],
      chart:  { type: 'bar', height: 240, toolbar: { show: false }, sparkline: { enabled: false } },
      plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 3, distributed: true } },
      colors: ['#95a5a6', '#3498db', '#27ae60', '#2c3e50'],
      dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: '700', colors: ['#fff'] } },
      xaxis: { categories: ['Sin Programa', 'Programadas', 'C/Avance Real', 'Totales'],
               labels: { style: { fontSize: '10px' } } },
      legend: { show: false },
      grid:   { borderColor: '#e8e8e8' },
    };

    // Gauges (radialBar)
    const mkGauge = (pct: number, color: string) => ({
      series: [Math.min(100, Math.round(pct))],
      chart:  { type: 'radialBar', height: 180, sparkline: { enabled: true } },
      colors: [color],
      plotOptions: { radialBar: {
        startAngle: -90, endAngle: 90,
        track: { background: '#ecf0f1', strokeWidth: '100%', margin: 2 },
        hollow: { size: '55%' },
        dataLabels: {
          name:  { show: false },
          value: { offsetY: -15, fontSize: '18px', fontWeight: '700', color,
                   formatter: (v: number) => v.toFixed(1) + '%' },
        },
      }},
    });
    const eT  = r.enTiempo    / gaugeBase * 100;
    const ter = r.terminadas  / gaugeBase * 100;
    const ret = r.retrasadas  / gaugeBase * 100;
    this.gauge1Opts = mkGauge(eT,  '#2980b9');
    this.gauge2Opts = mkGauge(ter, '#27ae60');
    this.gauge3Opts = mkGauge(ret, '#e74c3c');
  }

  // ── Print ────────────────────────────────────────────────────────────────────
  printReport(): void { window.print(); }

  // ── Helpers HTML ─────────────────────────────────────────────────────────────
  spiColor(spi: number): string {
    if (spi >= 0.95) return '#27ae60';
    if (spi >= 0.8)  return '#f39c12';
    return '#e74c3c';
  }
  spiCell(spi: number): string {
    if (!spi || spi === 0) return '';
    if (spi >= 0.95) return 'spi-ok';
    if (spi >= 0.8)  return 'spi-warn';
    return 'spi-bad';
  }
  fmtDate(iso: string): string { return fmtDate(iso); }
}
