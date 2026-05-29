import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { AgGridModule }         from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { SignalsService }       from 'app/services/signals.service';

interface BaselineRecord {
  id:           number;
  version:      string;    // BL0 = original, BL1, BL2, ...
  capturedAt:   string;    // ISO date
  capturedBy:   string;
  reason:       string;
  totalTasks:   number;
  avgProgress:  number;
  tasks:        any[];     // snapshot del programa
  active:       boolean;
}

@Component({
  selector: 'app-pmo-lineas-base',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './pmo-lineas-base.component.html',
})
export class PmoLineasBaseComponent implements OnInit {
  private _projectsService    = inject(ProjectsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _signalsService     = inject(SignalsService);

  idCompany         = 0;
  projects: any[]   = [];
  selectedProject: any = null;
  isLoading         = false;
  isSaving          = false;
  newReason         = '';

  // Historial de líneas base (se almacena en sessionStorage mientras no haya endpoint)
  baselines: BaselineRecord[] = [];
  selectedBaseline: BaselineRecord | null = null;

  // Grid de comparación: línea base vs actual
  compareGridApi!: GridApi;
  compareData: any[] = [];

  compareColDefs: ColDef[] = [
    { field: 'activity',    headerName: 'Actividad',   width: 100 },
    { field: 'description', headerName: 'Descripción', flex: 1, minWidth: 140 },
    {
      field: 'startBaseline', headerName: 'Inicio LB', width: 105,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
      cellStyle: { background: '#eaf4fb' },
    },
    {
      field: 'endBaseline', headerName: 'Fin LB', width: 105,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
      cellStyle: { background: '#eaf4fb' },
    },
    {
      field: 'startActual', headerName: 'Inicio Actual', width: 115,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
    },
    {
      field: 'endActual', headerName: 'Fin Actual', width: 115,
      valueFormatter: (p) => p.value ? String(p.value).substring(0, 10) : '',
    },
    {
      field: 'progressBaseline', headerName: 'Av. LB', width: 80, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(1) + '%',
      cellStyle: { background: '#eaf4fb' },
    },
    {
      field: 'progressActual', headerName: 'Av. Actual', width: 90, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(1) + '%',
    },
    {
      field: 'deltaProgress', headerName: 'Δ Avance', width: 90, type: 'numericColumn',
      valueFormatter: (p) => {
        const v = Number(p.value ?? 0);
        return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
      },
      cellStyle: (p) => ({
        color: Number(p.value) >= 0 ? '#27ae60' : '#c0392b',
        fontWeight: 'bold',
      }),
    },
    {
      field: 'deltaEndDays', headerName: 'Δ Fin (días)', width: 100, type: 'numericColumn',
      valueFormatter: (p) => {
        const v = Number(p.value ?? 0);
        return (v > 0 ? '+' : '') + v + 'd';
      },
      cellStyle: (p) => ({
        color: Number(p.value) <= 0 ? '#27ae60' : '#c0392b',
        fontWeight: 'bold',
      }),
    },
  ];

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

  async onProjectChange(): Promise<void> {
    if (!this.selectedProject) return;
    this.loadBaselinesFromStorage();
  }

  private storageKey(): string {
    const id = this.selectedProject?.id ?? this.selectedProject?.idProject;
    return `pmo_baselines_${this.idCompany}_${id}`;
  }

  loadBaselinesFromStorage(): void {
    try {
      const raw = sessionStorage.getItem(this.storageKey());
      this.baselines = raw ? JSON.parse(raw) : [];
    } catch { this.baselines = []; }
  }

  saveBaselinestoStorage(): void {
    try { sessionStorage.setItem(this.storageKey(), JSON.stringify(this.baselines)); } catch {}
  }

  async captureBaseline(): Promise<void> {
    if (!this.selectedProject) return;
    if (!this.newReason.trim()) { alert('Escribe el motivo / descripción de la reprogramación.'); return; }
    this.isSaving = true;
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      const tasks: any[] = await lastValueFrom(
        this._workprogramsService.getWorkPrograms(idProject, 'Project')
      );
      const version = 'BL' + this.baselines.length;
      const record: BaselineRecord = {
        id:          Date.now(),
        version,
        capturedAt:  new Date().toISOString(),
        capturedBy:  'Usuario',
        reason:      this.newReason.trim(),
        totalTasks:  tasks.length,
        avgProgress: tasks.length
          ? Math.round(tasks.reduce((s, t) => s + Number(t.progress ?? 0), 0) / tasks.length * 100 * 10) / 10
          : 0,
        tasks:       JSON.parse(JSON.stringify(tasks)),
        active:      true,
      };
      // Desactivar baseline anterior
      this.baselines = this.baselines.map(b => ({ ...b, active: false }));
      this.baselines.unshift(record);
      this.saveBaselinestoStorage();
      this.newReason = '';
    } catch (e) {
      console.error('Error capturando línea base', e);
    } finally {
      this.isSaving = false;
    }
  }

  async compareBaseline(bl: BaselineRecord): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    this.selectedBaseline = bl;
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      const currentTasks: any[] = await lastValueFrom(
        this._workprogramsService.getWorkPrograms(idProject, 'Project')
      );
      const blMap = new Map<number, any>(bl.tasks.map(t => [Number(t.id ?? t.idEntry), t]));

      this.compareData = currentTasks.map(t => {
        const blTask = blMap.get(Number(t.id ?? t.idEntry));
        const progCurrent = Math.round(Number(t.progress ?? 0) * 100 * 10) / 10;
        const progBl      = blTask ? Math.round(Number(blTask.progress ?? 0) * 100 * 10) / 10 : 0;
        const endCurrent  = t.endDate   ? new Date(t.endDate).getTime()   : 0;
        const endBl       = blTask?.endDate ? new Date(blTask.endDate).getTime() : 0;
        const deltaEndDays = (endCurrent && endBl) ? Math.ceil((endCurrent - endBl) / 86400000) : 0;
        return {
          activity:          t.activity || '',
          description:       t.text || t.description || '',
          startBaseline:     blTask?.startDate ?? '',
          endBaseline:       blTask?.endDate   ?? '',
          startActual:       t.startDate ?? '',
          endActual:         t.endDate   ?? '',
          progressBaseline:  progBl,
          progressActual:    progCurrent,
          deltaProgress:     Math.round((progCurrent - progBl) * 10) / 10,
          deltaEndDays,
        };
      });
    } catch (e) {
      console.error('Error comparando línea base', e);
    } finally {
      this.isLoading = false;
    }
  }

  onCompareGridReady(e: GridReadyEvent): void { this.compareGridApi = e.api; }

  exportXLS(): void {
    this.compareGridApi?.exportDataAsExcel({ fileName: 'PMO_LineasBase_Comparacion.xlsx' });
  }

  deleteBaseline(bl: BaselineRecord): void {
    if (!confirm(`¿Eliminar línea base ${bl.version}?`)) return;
    this.baselines = this.baselines.filter(b => b.id !== bl.id);
    if (this.selectedBaseline?.id === bl.id) { this.selectedBaseline = null; this.compareData = []; }
    this.saveBaselinestoStorage();
  }
}
