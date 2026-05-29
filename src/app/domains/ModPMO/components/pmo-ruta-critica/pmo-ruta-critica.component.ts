import {
  Component, inject, OnInit, OnDestroy, effect,
  ElementRef, ViewChild, AfterViewInit, NgZone, HostListener
} from '@angular/core';
import { CommonModule }          from '@angular/common';
import { FormsModule }           from '@angular/forms';
import { lastValueFrom }         from 'rxjs';
import { ProjectsService }       from 'app/services/projects.service';
import { WorkprogramsService }   from 'app/services/workprograms.service';
import { SignalsService }        from 'app/services/signals.service';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de layout
// ─────────────────────────────────────────────────────────────────────────────
const ROW_H       = 44;   // alto de cada fila (px)
const HEADER_H    = 52;   // alto del encabezado de fechas
const LABEL_W     = 230;  // ancho del panel de nombres (px)
const BAR_H       = 22;   // alto de cada barra
const BAR_PAD     = (ROW_H - BAR_H) / 2;
const MIN_DAY_PX  = 4;    // px mínimo por día

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────
interface GanttTask {
  id:           number;
  label:        string;       // "EDT — descripción"
  startDate:    Date;
  endDate:      Date;
  durationDays: number;
  progress:     number;       // 0-1
  predecessorId: number;
  isCritical:   boolean;
  isMilestone:  boolean;
  status:       string;       // Atrasada | En Riesgo | En Tiempo | Terminada | Sin iniciar
  slack:        number;       // días holgura
  // calculated
  row:          number;
  x:            number;
  y:            number;
  barW:         number;
  progressW:    number;
  fill:         string;
  fillProgress: string;
}

interface Link {
  id:      number;
  srcTask: GanttTask;
  tgtTask: GanttTask;
  isCritical: boolean;
  path:    string;
}

interface MonthLabel {
  label: string;
  x:     number;
  width: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-pmo-ruta-critica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pmo-ruta-critica.component.html',
  styles: [`
    .gantt-wrapper   { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 310px);
                       min-height: 300px; border: 1px solid #dee2e6; border-radius: 6px; background:#fff; }
    .gantt-svg       { display: block; }
    .label-panel     { position: sticky; left: 0; z-index: 10; }
    .task-label      { font-size: 12px; fill: #333; cursor: default; }
    .task-label.crit { font-weight: 700; fill: #c0392b; }
    .bar-bg          { rx: 4; ry: 4; opacity: .15; }
    .bar-fill        { rx: 4; ry: 4; }
    .bar-prog        { rx: 3; ry: 3; opacity: .5; }
    .milestone-icon  { font-size: 18px; }
    .link-arrow      { fill: none; stroke-width: 1.8; marker-end: url(#arrowCrit);  }
    .link-arrow.norm { marker-end: url(#arrowNorm); }
    .grid-line       { stroke: #e8eaed; stroke-width: 1; }
    .month-sep       { stroke: #c0c8d0; stroke-width: 1; }
    .month-label     { font-size: 11px; fill: #555; font-weight: 600; }
    .header-bg       { fill: #f8f9fa; }
    .row-bg-even     { fill: #fafbfc; }
    .today-line      { stroke: #e74c3c; stroke-width: 1.5; stroke-dasharray: 4 3; }
    .today-label     { font-size: 10px; fill: #e74c3c; font-weight: 700; }
    .pct-label       { font-size: 10px; fill: #fff; font-weight: 700; }
    .slack-label     { font-size: 9px; fill: #888; }
  `],
})
export class PmoRutaCriticaComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;

  private _projectsService     = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _signalsService      = inject(SignalsService);
  private _ngZone              = inject(NgZone);

  idCompany        = 0;
  projects: any[]  = [];
  selectedProject: any = null;
  isLoading        = false;

  // Vista
  showOnlyCritical = false;
  zoomLevel: 'month' | 'week' = 'month';

  // SVG data
  tasks:       GanttTask[]  = [];
  links:       Link[]       = [];
  months:      MonthLabel[] = [];
  chartW       = 1200;
  chartH       = 200;
  svgW         = 0;
  svgH         = 0;
  todayX       = 0;

  // Contadores
  get totalCritical()   { return this.tasks.filter(t => t.isCritical).length; }
  get totalMilestones() { return this.tasks.filter(t => t.isMilestone).length; }
  get totalDelayed()    { return this.tasks.filter(t => t.status === 'Atrasada').length; }

  // Días visibles
  private chartStart!: Date;
  private chartEnd!:   Date;
  private totalDays    = 0;
  private dayPx        = 6;  // px por día

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

  ngAfterViewInit(): void { }

  ngOnDestroy(): void { }

  @HostListener('window:resize')
  onResize(): void { this.rebuildChart(); }

  async loadProjects(): Promise<void> {
    try {
      const res: any = await lastValueFrom(this._projectsService.getProjectListByCompany(this.idCompany));
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  async loadCriticalPath(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    this.tasks = [];
    this.links = [];
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      const raw: any[] = await lastValueFrom(
        this._workprogramsService.getWorkPrograms(idProject, 'Project')
      );
      this.buildGanttData(raw ?? []);
    } catch (e) {
      console.error('Ruta Crítica error', e);
    } finally {
      this.isLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────
  private buildGanttData(raw: any[]): void {
    if (!raw.length) { this.tasks = []; this.links = []; return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Mapear tareas
    const all: GanttTask[] = raw
      .filter(t => t.startdate || t.startDate)
      .map((t, i) => {
        const sd = new Date(t.startdate ?? t.startDate);
        const ed = new Date(t.endate   ?? t.endDate);
        sd.setHours(0,0,0,0); ed.setHours(0,0,0,0);
        const dur  = Math.max(0, Math.ceil((ed.getTime() - sd.getTime()) / 86400000));
        const prog = Math.min(1, Math.max(0, Number(t.progress ?? 0)));
        const isMilestone = dur === 0;
        const slack = ed >= today ? Math.ceil((ed.getTime() - today.getTime()) / 86400000) : -Math.ceil((today.getTime() - ed.getTime()) / 86400000);
        const isCritical  = String(t.criticroute ?? '').toLowerCase() === 'si' || (!isMilestone && slack <= 2 && prog < 1);
        const predId      = Number(t.predecesor ?? t.predecessors ?? 0);

        let status = 'Sin iniciar';
        if (prog >= 1) status = 'Terminada';
        else if (today > ed) status = 'Atrasada';
        else if (today >= sd && slack <= 5) status = 'En Riesgo';
        else if (prog > 0) status = 'En Tiempo';

        const fill         = isCritical ? '#e74c3c' : isMilestone ? '#8e44ad' : '#2980b9';
        const fillProgress = isCritical ? '#c0392b' : '#1a5276';

        return {
          id: Number(t.id ?? t.idEntry ?? i),
          label: `${t.activity || t.wbs || ''} — ${(t.text ?? t.description ?? '').substring(0, 38)}`,
          startDate: sd, endDate: ed,
          durationDays: dur, progress: prog,
          predecessorId: predId,
          isCritical, isMilestone,
          status, slack,
          row: 0, x: 0, y: 0, barW: 0, progressW: 0,
          fill, fillProgress,
        };
      });

    // 2. Filtrar si switch activo
    const visible = this.showOnlyCritical
      ? all.filter(t => t.isCritical || t.isMilestone)
      : all;

    // 3. Asignar filas
    visible.forEach((t, i) => { t.row = i; t.y = HEADER_H + i * ROW_H; });

    // 4. Rango de fechas (+ margen)
    const dates = visible.flatMap(t => [t.startDate, t.endDate]);
    let minD = new Date(Math.min(...dates.map(d => d.getTime())));
    let maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    minD.setDate(minD.getDate() - 7);
    maxD.setDate(maxD.getDate() + 14);
    this.chartStart = minD;
    this.chartEnd   = maxD;
    this.totalDays  = Math.ceil((maxD.getTime() - minD.getTime()) / 86400000);

    // 5. px por día según ancho del contenedor
    const containerW = this.wrapperRef?.nativeElement?.clientWidth ?? 900;
    const availW = Math.max(containerW - LABEL_W - 20, 600);
    this.dayPx   = this.zoomLevel === 'week'
      ? Math.max(MIN_DAY_PX * 2, availW / this.totalDays)
      : Math.max(MIN_DAY_PX,     availW / this.totalDays);
    this.chartW  = Math.ceil(this.totalDays * this.dayPx);
    this.chartH  = HEADER_H + visible.length * ROW_H + 10;

    // 6. Calcular posiciones x de cada tarea
    visible.forEach(t => {
      t.x     = this.xForDate(t.startDate);
      t.barW  = Math.max(isMilestone(t) ? 0 : 8, t.durationDays * this.dayPx);
      t.progressW = t.barW * t.progress;
    });

    // 7. Hoy
    this.todayX = this.xForDate(today);

    // 8. Etiquetas de meses/semanas
    this.months = this.buildMonthLabels();

    // 9. Links (flechas)
    const idMap = new Map<number, GanttTask>(visible.map(t => [t.id, t]));
    const lnks: Link[] = [];
    visible.forEach(t => {
      if (t.predecessorId > 0) {
        const src = idMap.get(t.predecessorId);
        if (src) {
          lnks.push({
            id: src.id * 10000 + t.id,
            srcTask: src, tgtTask: t,
            isCritical: src.isCritical && t.isCritical,
            path: this.buildArrowPath(src, t),
          });
        }
      }
    });

    this.tasks  = visible;
    this.links  = lnks;
    this.svgW   = LABEL_W + this.chartW;
    this.svgH   = this.chartH;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Geometría
  // ─────────────────────────────────────────────────────────────────────────
  private xForDate(d: Date): number {
    return LABEL_W + Math.round(((d.getTime() - this.chartStart.getTime()) / 86400000) * this.dayPx);
  }

  private buildArrowPath(src: GanttTask, tgt: GanttTask): string {
    // sale del extremo derecho de la barra fuente
    const x1 = src.isMilestone ? src.x + 10 : src.x + src.barW;
    const y1 = HEADER_H + src.row * ROW_H + ROW_H / 2;
    // llega al extremo izquierdo de la barra destino
    const x2 = tgt.x;
    const y2 = HEADER_H + tgt.row * ROW_H + ROW_H / 2;

    if (y1 === y2) {
      // misma fila: línea recta
      return `M${x1},${y1} L${x2},${y2}`;
    }
    // elbow: derecha → abajo/arriba → derecha
    const midX = x1 + Math.max(8, (x2 - x1) * 0.4);
    return `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
  }

  private buildMonthLabels(): MonthLabel[] {
    const labels: MonthLabel[] = [];
    const cur = new Date(this.chartStart);
    cur.setDate(1);
    const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    while (cur <= this.chartEnd) {
      const next = new Date(cur); next.setMonth(next.getMonth() + 1);
      const x1 = this.xForDate(cur < this.chartStart ? this.chartStart : cur);
      const x2 = this.xForDate(next > this.chartEnd  ? this.chartEnd   : next);
      labels.push({ label: `${MONTHS_ES[cur.getMonth()]} ${cur.getFullYear()}`, x: x1, width: x2 - x1 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return labels;
  }

  private rebuildChart(): void {
    if (this.tasks.length) this.buildGanttData([]); // re-run with cached raw? Keep it simple
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers template
  // ─────────────────────────────────────────────────────────────────────────
  get visibleRowsBg(): number[] {
    return this.tasks.filter((_,i) => i % 2 === 0).map(t => t.row);
  }

  milestonePoints(t: GanttTask): string {
    const cx = t.x, cy = HEADER_H + t.row * ROW_H + ROW_H / 2, s = 10;
    return `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
  }

  statusBadgeColor(s: string): string {
    switch(s) {
      case 'Atrasada':   return '#e74c3c';
      case 'En Riesgo':  return '#f39c12';
      case 'En Tiempo':  return '#27ae60';
      case 'Terminada':  return '#8e44ad';
      default:           return '#95a5a6';
    }
  }

  toggleCritical(): void {
    if (!this.selectedProject) return;
    this.loadCriticalPath();
  }

  setZoom(z: 'month' | 'week'): void {
    this.zoomLevel = z;
    if (this.selectedProject) this.loadCriticalPath();
  }

  trackById(_: number, t: GanttTask) { return t.id; }
  trackByLink(_: number, l: Link)    { return l.id; }
}

function isMilestone(t: GanttTask): boolean { return t.isMilestone; }
