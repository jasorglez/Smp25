import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { AgGridModule }         from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { SignalsService }       from 'app/services/signals.service';

interface CriticalTask {
  id:           number;
  activity:     string;
  description:  string;
  wbs:          string;
  startDate:    string;
  endDate:      string;
  duration:     number;    // días
  progress:     number;    // 0-100
  slack:        number;    // días de holgura (0 = ruta crítica)
  predecessors: string;
  successors:   string;
  isCritical:   boolean;
  isMilestone:  boolean;
  statusDays:   number;    // positivo = adelantado, negativo = atrasado
  status:       string;
}

@Component({
  selector: 'app-pmo-ruta-critica',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './pmo-ruta-critica.component.html',
})
export class PmoRutaCriticaComponent implements OnInit {
  private _projectsService    = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _signalsService     = inject(SignalsService);

  idCompany        = 0;
  projects: any[]  = [];
  selectedProject: any = null;
  isLoading        = false;

  gridApi!: GridApi;
  rowData: CriticalTask[] = [];

  // Contadores
  totalCritical   = 0;
  totalMilestones = 0;
  totalDelayed    = 0;

  // Filtro
  showOnlyCritical = false;

  colDefs: ColDef[] = [
    {
      field: 'isCritical', headerName: '🔴', width: 50, editable: false,
      cellRenderer: (p: any) => p.value
        ? '<span class="badge bg-danger" style="font-size:10px;">CR</span>'
        : '',
    },
    {
      field: 'isMilestone', headerName: '🏁', width: 50, editable: false,
      cellRenderer: (p: any) => p.value
        ? '<span title="Hito" style="font-size:16px;">🏁</span>'
        : '',
    },
    { field: 'activity',    headerName: 'Actividad',    width: 100 },
    { field: 'description', headerName: 'Descripción',  flex: 1, minWidth: 160 },
    { field: 'wbs',         headerName: 'EDT',          width: 80 },
    {
      field: 'startDate', headerName: 'Inicio', width: 100,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
    },
    {
      field: 'endDate', headerName: 'Fin', width: 100,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
    },
    { field: 'duration',  headerName: 'Días',    width: 70, type: 'numericColumn' },
    {
      field: 'progress', headerName: 'Avance', width: 90, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(1) + '%',
    },
    {
      field: 'slack', headerName: 'Holgura', width: 80, type: 'numericColumn',
      cellStyle: (p) => ({
        color: Number(p.value) === 0 ? '#c0392b' : Number(p.value) <= 3 ? '#e67e22' : '#27ae60',
        fontWeight: 'bold',
      }),
    },
    {
      field: 'statusDays', headerName: 'Desviación', width: 100, type: 'numericColumn',
      valueFormatter: (p) => {
        const v = Number(p.value ?? 0);
        return v > 0 ? '+' + v + 'd' : v < 0 ? v + 'd' : '0d';
      },
      cellStyle: (p) => ({
        color: Number(p.value) < 0 ? '#c0392b' : Number(p.value) > 0 ? '#27ae60' : '#666',
        fontWeight: 'bold',
      }),
    },
    {
      field: 'status', headerName: 'Estado', width: 110,
      cellRenderer: (p: any) => {
        const map: Record<string, string> = {
          'Terminada': 'bg-success', 'En tiempo': 'bg-primary',
          'Atrasada': 'bg-danger',   'No iniciada': 'bg-secondary',
        };
        return `<span class="badge ${map[p.value] ?? 'bg-secondary'}" style="font-size:10px;">${p.value}</span>`;
      },
    },
    { field: 'predecessors', headerName: 'Predecesores', width: 120 },
    { field: 'successors',   headerName: 'Sucesores',    width: 120 },
  ];

  rowClassRules = {
    'table-danger': (p: any) => !!p.data?.isCritical && Number(p.data?.slack ?? 0) === 0,
  };

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
      const res: any = await lastValueFrom(this._projectsService.getProjectListByCompany(this.idCompany));
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  onGridReady(e: GridReadyEvent): void { this.gridApi = e.api; }

  async loadCriticalPath(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      const tasks: any[] = await lastValueFrom(
        this._workprogramsService.getWorkPrograms(idProject, 'Project')
      );
      this.rowData = this.computeCriticalPath(tasks);
      this.updateCounters();
    } catch (e) {
      console.error('Ruta Crítica error', e);
    } finally {
      this.isLoading = false;
    }
  }

  private computeCriticalPath(tasks: any[]): CriticalTask[] {
    if (!tasks?.length) return [];
    const today = new Date();

    // Determinar tareas hoja (sin hijos)
    const parentSet = new Set(tasks.map(t => String(t.parent)));

    // Calcular slack como diferencia entre fin planificado y hoy
    const result: CriticalTask[] = tasks.map(t => {
      const startMs  = t.startDate ? new Date(t.startDate).getTime() : 0;
      const endMs    = t.endDate   ? new Date(t.endDate).getTime()   : 0;
      const duration = startMs && endMs ? Math.ceil((endMs - startMs) / 86400000) : 0;
      const progress = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10;
      const isLeaf   = !parentSet.has(String(t.idTask ?? t.id));

      // Slack estimado: días desde hoy hasta fin (si no terminado)
      let slack    = 0;
      let statusDays = 0;
      if (endMs) {
        slack = Math.ceil((endMs - today.getTime()) / 86400000);
        if (progress >= 100) { slack = 999; }
      }

      // Hito: duración = 0 o flag isMilestone
      const isMilestone = Boolean(t.isMilestone) || duration === 0;

      // Estado
      let status = 'No iniciada';
      if (progress >= 100) status = 'Terminada';
      else if (today.getTime() > endMs && endMs > 0 && progress < 100) { status = 'Atrasada'; statusDays = Math.ceil((today.getTime() - endMs) / 86400000) * -1; }
      else if (progress > 0) { status = 'En tiempo'; }

      return {
        id:           Number(t.id ?? t.idEntry),
        activity:     t.activity || '',
        description:  t.text || t.description || '',
        wbs:          t.wbs || t.activity || '',
        startDate:    t.startDate ? String(t.startDate).substring(0, 10) : '',
        endDate:      t.endDate   ? String(t.endDate).substring(0, 10)   : '',
        duration,
        progress,
        slack:        slack < 0 ? 0 : slack >= 999 ? 999 : slack,
        predecessors: t.predecessors || '',
        successors:   t.successors   || '',
        isCritical:   isLeaf && slack <= 2 && progress < 100,
        isMilestone,
        statusDays,
        status,
      };
    });

    // Ordenar: críticas primero, luego por slack
    return result.sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      return a.slack - b.slack;
    });
  }

  private updateCounters(): void {
    this.totalCritical   = this.rowData.filter(r => r.isCritical).length;
    this.totalMilestones = this.rowData.filter(r => r.isMilestone).length;
    this.totalDelayed    = this.rowData.filter(r => r.status === 'Atrasada').length;
  }

  get filteredData(): CriticalTask[] {
    return this.showOnlyCritical ? this.rowData.filter(r => r.isCritical) : this.rowData;
  }

  exportXLS(): void {
    this.gridApi?.exportDataAsExcel({ fileName: 'PMO_RutaCritica.xlsx' });
  }
}
