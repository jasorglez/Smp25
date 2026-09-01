import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { AgGridModule }         from 'ag-grid-angular';
import {
  ColDef, GridApi, GridReadyEvent,
  GridOptions, RowNode,
} from 'ag-grid-enterprise';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { SignalsService }       from 'app/services/signals.service';
import { PmoImportComponent }   from '../pmo-import/pmo-import.component';

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildPaths(tasks: any[]): any[] {
  const map = new Map<string, any>();
  tasks.forEach(t => map.set(String(t.idTask ?? t.id), t));

  function label(t: any): string {
    return t.activity || t.text || t.description || String(t.idTask ?? t.id);
  }

  function getPath(t: any): string[] {
    const parentId = t.parent;
    if (!parentId || parentId === '0' || parentId === 0) return [label(t)];
    const parent = map.get(String(parentId));
    if (!parent) return [label(t)];
    return [...getPath(parent), label(t)];
  }

  return tasks.map(t => ({ ...t, _path: getPath(t) }));
}

function taskStatus(t: any): { label: string; color: string } {
  const prog    = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10;
  const endMs   = t.endDate   ? new Date(t.endDate).getTime()   : 0;
  const startMs = t.startDate ? new Date(t.startDate).getTime() : 0;
  const now     = Date.now();

  if (prog >= 100) return { label: 'Terminada',   color: '#27ae60' };
  if (endMs && now > endMs && prog < 100) return { label: 'Atrasada',    color: '#c0392b' };
  if (startMs && now >= startMs && now <= endMs && prog > 0) return { label: 'En Progreso', color: '#2980b9' };
  if (startMs && now >= startMs && now <= endMs && prog === 0) return { label: 'Sin Avance', color: '#e67e22' };
  return { label: 'Pendiente', color: '#7f8c8d' };
}

// ── Progress bar inline renderer ─────────────────────────────────────────────
function progressBarRenderer(params: any): string {
  const pct   = Math.round(Math.min(1, Number(params.value ?? 0)) * 100);
  const color = pct >= 100 ? '#27ae60' : pct >= 70 ? '#2980b9' : pct >= 30 ? '#f39c12' : pct > 0 ? '#e67e22' : '#bdc3c7';
  return `<div style="display:flex;align-items:center;gap:5px;padding:3px 0;width:100%;">
    <div style="flex:1;background:#e9ecef;border-radius:6px;height:10px;overflow:hidden;">
      <div style="width:${pct}%;background:${color};height:10px;border-radius:6px;"></div>
    </div>
    <span style="min-width:34px;font-size:11px;font-weight:700;color:${color};text-align:right;">${pct}%</span>
  </div>`;
}

// ── Status badge renderer ─────────────────────────────────────────────────────
function statusRenderer(params: any): string {
  const s = taskStatus(params.data ?? {});
  return `<span style="background:${s.color};color:#fff;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:600;">${s.label}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-pmo-programa',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PmoImportComponent],
  templateUrl: './pmo-programa.component.html',
})
export class PmoProgramaComponent implements OnInit {
  private _projectsService     = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _signalsService      = inject(SignalsService);

  // ── Estado ───────────────────────────────────────────────────────────────
  idCompany        = 0;
  projects: any[]  = [];
  selectedProject: any = null;
  isLoading        = false;
  filterStatus     = 'todos';   // todos | atrasadas | progreso | terminadas | pendientes
  showImport       = false;

  // ── Contadores ───────────────────────────────────────────────────────────
  cntTotal     = 0;
  cntTerminado = 0;
  cntProgreso  = 0;
  cntAtrasada  = 0;
  cntPendiente = 0;
  pctGeneral   = 0;

  // ── AG Grid ───────────────────────────────────────────────────────────────
  gridApi!: GridApi;
  allRows: any[]  = [];       // datos con _path
  rowData: any[]  = [];       // filtrados

  autoGroupColDef: ColDef = {
    headerName: 'Actividad / Entregable',
    minWidth: 280,
    flex: 1,
    cellRendererParams: { suppressCount: true },
    cellStyle: { fontWeight: '600' },
  };

  colDefs: ColDef[] = [
    {
      field: 'progress',
      headerName: 'Avance',
      width: 170,
      cellRenderer: progressBarRenderer,
    },
    {
      headerName: 'Estado',
      width: 110,
      cellRenderer: statusRenderer,
      valueGetter: (p) => taskStatus(p.data ?? {}).label,
    },
    {
      field: 'ponderado',
      headerName: 'Pond. %',
      width: 85,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(1) + '%' : '',
      cellStyle: { color: '#6c757d' },
    },
    {
      field: 'startDate',
      headerName: 'Inicio',
      width: 100,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
    },
    {
      field: 'endDate',
      headerName: 'Fin Plan',
      width: 100,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
    },
    {
      headerName: 'Días restantes',
      width: 120,
      type: 'numericColumn',
      valueGetter: (p) => {
        const end  = p.data?.endDate ? new Date(p.data.endDate).getTime() : 0;
        const prog = Number(p.data?.progress ?? 0);
        if (!end || prog >= 1) return null;
        return Math.ceil((end - Date.now()) / 86400000);
      },
      cellStyle: (p) => {
        const v = p.value;
        if (v === null || v === undefined) return {};
        return { color: v < 0 ? '#c0392b' : v <= 7 ? '#e67e22' : '#27ae60', fontWeight: '600' };
      },
      valueFormatter: (p) => {
        if (p.value === null || p.value === undefined) return '—';
        return p.value < 0 ? `${Math.abs(p.value)}d retraso` : `${p.value}d`;
      },
    },
    {
      field: 'description',
      headerName: 'Descripción',
      minWidth: 160,
      flex: 1,
      cellStyle: { color: '#6c757d', fontSize: '11px' },
    },
  ];

  gridOptions: GridOptions = {
    treeData: true,
    getDataPath: (data: any) => data._path ?? [data.activity ?? 'Sin nombre'],
    groupDefaultExpanded: 2,
    animateRows: true,
    rowHeight: 38,
    headerHeight: 36,
    defaultColDef: {
      resizable: true,
      sortable: true,
    },
    rowClassRules: {
      'pmo-row-atrasada':  (p: any) => taskStatus(p.data ?? {}).label === 'Atrasada',
      'pmo-row-terminada': (p: any) => taskStatus(p.data ?? {}).label === 'Terminada',
    },
    getRowStyle: (p: any) => {
      const st = taskStatus(p.data ?? {}).label;
      if (st === 'Atrasada')   return { borderLeft: '3px solid #c0392b' };
      if (st === 'Terminada')  return { borderLeft: '3px solid #27ae60' };
      if (st === 'En Progreso') return { borderLeft: '3px solid #2980b9' };
      if (st === 'Sin Avance') return { borderLeft: '3px solid #e67e22' };
      return {};
    },
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

  async onProjectChange(): Promise<void> {
    if (!this.selectedProject) return;
    await this.loadProgram();
  }

  async loadProgram(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    try {
      const id = this.selectedProject.id ?? this.selectedProject.idProject;
      const raw: any[] = await lastValueFrom(
        this._workprogramsService.getWorkPrograms(id, 'Project')
      );
      this.allRows = buildPaths(raw ?? []);
      this.calcCounters();
      this.applyFilter();
    } catch (e) {
      console.error('PMO Programa error', e);
    } finally {
      this.isLoading = false;
    }
  }

  calcCounters(): void {
    this.cntTotal     = this.allRows.length;
    this.cntTerminado = this.allRows.filter(r => taskStatus(r).label === 'Terminada').length;
    this.cntProgreso  = this.allRows.filter(r => taskStatus(r).label === 'En Progreso').length;
    this.cntAtrasada  = this.allRows.filter(r => taskStatus(r).label === 'Atrasada').length;
    this.cntPendiente = this.allRows.filter(r =>
      ['Pendiente', 'Sin Avance'].includes(taskStatus(r).label)
    ).length;
    this.pctGeneral   = this.cntTotal
      ? Math.round(
          this.allRows.reduce((s, r) => s + Math.min(1, Number(r.progress ?? 0)), 0)
          / this.cntTotal * 100 * 10
        ) / 10
      : 0;
  }

  applyFilter(): void {
    const map: Record<string, string> = {
      atrasadas:   'Atrasada',
      progreso:    'En Progreso',
      terminadas:  'Terminada',
      pendientes:  'Pendiente',
    };
    if (this.filterStatus === 'todos') {
      this.rowData = this.allRows;
    } else {
      const label = map[this.filterStatus] ?? '';
      // Al filtrar, incluir la tarea y TODOS sus ancestros para mantener el árbol coherente
      const matchIds = new Set(
        this.allRows
          .filter(r => taskStatus(r).label === label)
          .map(r => String(r.idTask ?? r.id))
      );
      // Agregar ancestros
      const taskMap = new Map(this.allRows.map(r => [String(r.idTask ?? r.id), r]));
      const toShow  = new Set<string>(matchIds);
      matchIds.forEach(id => {
        let cur = taskMap.get(id);
        while (cur) {
          const pid = String(cur.parent ?? '');
          if (!pid || pid === '0') break;
          toShow.add(pid);
          cur = taskMap.get(pid);
        }
      });
      this.rowData = this.allRows.filter(r => toShow.has(String(r.idTask ?? r.id)));
    }
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  expandAll():  void { this.gridApi?.expandAll(); }
  collapseAll(): void { this.gridApi?.collapseAll(); }

  exportXLS(): void {
    this.gridApi?.exportDataAsExcel({ fileName: 'PMO_ProgramaTrabajoAvance.xlsx' });
  }

  // ── Importación ──────────────────────────────────────────────────────────
  openImport(): void  { this.showImport = true; }
  closeImport(): void { this.showImport = false; }

  async onImported(count: number): Promise<void> {
    this.showImport = false;
    if (count > 0) await this.loadProgram();
  }

  async createExampleProgram(): Promise<void> {
    if (!this.selectedProject) return;
    const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
    const existing:any[] = await lastValueFrom(this._workprogramsService.getWorkPrograms(idProject, 'Project')).catch(() => []);
    if (existing?.length) { await this.loadProgram(); return; }
    const names = ['Inicio y preparación', 'Trazo y nivelación', 'Ejecución de trabajos', 'Control de calidad', 'Cierre y entrega'];
    for (let i = 0; i < names.length; i++) await lastValueFrom(this._workprogramsService.addWorkProgram({ idProject, idConvention: null, activity: `EJ-${i + 1}`, text: names[i], description: names[i], startDate: new Date().toISOString().substring(0, 10), endDate: new Date(Date.now() + (i + 1) * 86400000 * 7).toISOString().substring(0, 10), progress: 0, parent: 0, sortorder: i, active: 1, type: 'Project', typeActivity: 'Activity', measure: null }));
    await this.loadProgram();
  }

  get progressColor(): string {
    return this.pctGeneral >= 80 ? '#27ae60'
         : this.pctGeneral >= 40 ? '#f39c12'
         : '#c0392b';
  }
}
