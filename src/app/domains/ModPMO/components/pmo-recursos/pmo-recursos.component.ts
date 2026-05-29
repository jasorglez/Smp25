import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { AgGridModule }         from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { SignalsService }       from 'app/services/signals.service';

interface RecursoRow {
  id:           number;   // 0 = nuevo, >0 = existe en BD
  tipo:         string;
  descripcion:  string;
  unidad:       string;
  periodo:      string;
  cantPlan:     number;
  cantReal:     number;
  costoUnitPlan: number;
  costoUnitReal: number;
  costoPlan:    number;   // calculado: cantPlan * costoUnitPlan
  costoReal:    number;   // calculado: cantReal * costoUnitReal
  variacion:    number;   // costoReal - costoPlan
  __isNew?:     boolean;
  __modified?:  boolean;
  __deleted?:   boolean;
}

@Component({
  selector: 'app-pmo-recursos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './pmo-recursos.component.html',
})
export class PmoRecursosComponent implements OnInit {
  private _projectsService = inject(ProjectsService);
  private _signalsService  = inject(SignalsService);

  idCompany        = 0;
  projects: any[]  = [];
  selectedProject: any = null;
  isLoading        = false;
  isSaving         = false;
  hasUnsavedChanges = false;
  saveMsg          = '';
  saveMsgType      = '';   // 'success' | 'error'

  gridApi!: GridApi;
  rowData: RecursoRow[] = [];
  private originalRowData: RecursoRow[] = [];

  totalPlan  = 0;
  totalReal  = 0;
  totalVar   = 0;

  colDefs: ColDef[] = [
    {
      field: 'tipo', headerName: 'Tipo de Cargo', width: 130, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Personal', 'Material', 'Equipo', 'Subcontrato', 'Indirecto'] },
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'descripcion', headerName: 'Descripción', width: 200, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'unidad', headerName: 'Unidad', width: 90, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'periodo', headerName: 'Período', width: 110, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'cantPlan', headerName: 'Cant. Plan', width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoPlan = Number(p.data.cantPlan) * Number(p.data.costoUnitPlan);
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'cantReal', headerName: 'Cant. Real', width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoReal = Number(p.data.cantReal) * Number(p.data.costoUnitReal);
        p.data.variacion  = p.data.costoReal - p.data.costoPlan;
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'costoUnitPlan', headerName: 'C.Unit Plan', width: 110, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoPlan = Number(p.data.cantPlan) * Number(p.data.costoUnitPlan);
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'costoUnitReal', headerName: 'C.Unit Real', width: 110, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => {
        p.data.costoReal = Number(p.data.cantReal) * Number(p.data.costoUnitReal);
        p.data.variacion  = p.data.costoReal - p.data.costoPlan;
        this.recalcTotals(); this.markModified(p.data);
      },
    },
    {
      field: 'costoPlan', headerName: 'Costo Plan', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { background: '#e8f4fd' },
    },
    {
      field: 'costoReal', headerName: 'Costo Real', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { background: '#e8f4fd' },
    },
    {
      field: 'variacion', headerName: 'Variación', width: 120, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: (p) => ({
        background: Number(p.value ?? 0) > 0 ? '#fce4e4' : Number(p.value ?? 0) < 0 ? '#e4fce4' : '#f8f8f8',
        fontWeight: 'bold',
      }),
    },
  ];

  rowClassRules = {
    'new-row-highlight': (p: any) => !!p.data?.__isNew,
  };

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
      const res: any = await lastValueFrom(this._projectsService.getProjectListByCompany(this.idCompany));
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  async onProjectChange(): Promise<void> {
    if (!this.selectedProject) { this.rowData = []; this.recalcTotals(); return; }
    await this.loadRecursos();
  }

  async loadRecursos(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    try {
      const res: any = await lastValueFrom(
        this._projectsService.getPmoRecursosByProject(this.selectedProject.id)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.rowData = raw.map((r: any) => this.mapFromApi(r));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      this.recalcTotals();
      this.setRowData(this.rowData);
    } catch (err) {
      console.error('Error cargando recursos PMO', err);
      this.rowData = [];
    } finally {
      this.isLoading = false;
    }
  }

  onGridReady(e: GridReadyEvent): void { this.gridApi = e.api; }

  addRow(): void {
    const newRow: RecursoRow = {
      id: 0,
      tipo: 'Personal', descripcion: '', unidad: 'día', periodo: '',
      cantPlan: 0, cantReal: 0, costoUnitPlan: 0, costoUnitReal: 0,
      costoPlan: 0, costoReal: 0, variacion: 0,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.setRowData(this.rowData);
    setTimeout(() => {
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'tipo' });
      }
    }, 50);
  }

  async saveChanges(): Promise<void> {
    if (!this.selectedProject) return;
    const dirty = this.rowData.filter(r => r.__isNew || r.__modified);
    if (!dirty.length) { this.showMsg('No hay cambios que guardar', 'error'); return; }

    this.isSaving = true;
    try {
      const payload = dirty.map(r => this.mapToApi(r));
      const res: any = await lastValueFrom(this._projectsService.savePmoRecursosBatch(payload));
      await this.loadRecursos();
      this.showMsg(`✓ ${res?.count ?? dirty.length} registros guardados`, 'success');
    } catch (err: any) {
      console.error('Error guardando recursos PMO', err);
      this.showMsg('Error al guardar — revisa la consola', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  async deleteSelected(): Promise<void> {
    const selected = this.gridApi?.getSelectedRows() ?? [];
    if (!selected.length) return;
    const row: RecursoRow = selected[0];
    if (row.__isNew) {
      // Fila nueva no guardada: solo quitar del grid
      this.rowData = this.rowData.filter(r => r !== row);
      this.setRowData(this.rowData);
      this.recalcTotals();
      return;
    }
    if (!confirm(`¿Eliminar "${row.descripcion || row.tipo}"?`)) return;
    try {
      await lastValueFrom(this._projectsService.deletePmoRecurso(row.id));
      await this.loadRecursos();
      this.showMsg('Registro eliminado', 'success');
    } catch (err) {
      this.showMsg('Error al eliminar', 'error');
    }
  }

  revertChanges(): void {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.setRowData(this.rowData);
    this.recalcTotals();
  }

  exportXLS(): void {
    this.gridApi?.exportDataAsExcel({ fileName: 'PMO_Recursos.xlsx' });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Llama setGridOption solo si el grid sigue vivo (evita "grid has been destroyed") */
  private setRowData(data: RecursoRow[]): void {
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', data);
    }
  }

  private markModified(row: RecursoRow): void {
    if (!row.__isNew) row.__modified = true;
    this.hasUnsavedChanges = true;
  }

  recalcTotals(): void {
    this.totalPlan = this.rowData.reduce((s, r) => s + Number(r.costoPlan ?? 0), 0);
    this.totalReal = this.rowData.reduce((s, r) => s + Number(r.costoReal ?? 0), 0);
    this.totalVar  = this.totalReal - this.totalPlan;
  }

  private mapFromApi(r: any): RecursoRow {
    const cantPlan      = Number(r.cantPlan ?? r.cant_plan ?? 0);
    const cantReal      = Number(r.cantReal ?? r.cant_real ?? 0);
    const costoUnitPlan = Number(r.costoUnitPlan ?? r.costo_unit_plan ?? 0);
    const costoUnitReal = Number(r.costoUnitReal ?? r.costo_unit_real ?? 0);
    const costoPlan     = cantPlan * costoUnitPlan;
    const costoReal     = cantReal * costoUnitReal;
    return {
      id:            r.id ?? 0,
      tipo:          r.tipo ?? 'Personal',
      descripcion:   r.descripcion ?? '',
      unidad:        r.unidad ?? 'día',
      periodo:       r.periodo ?? '',
      cantPlan, cantReal, costoUnitPlan, costoUnitReal,
      costoPlan, costoReal,
      variacion:     costoReal - costoPlan,
    };
  }

  private mapToApi(r: RecursoRow): any {
    return {
      id:             r.id,
      idProject:      this.selectedProject?.id ?? 0,
      idCompany:      this.idCompany,
      tipo:           r.tipo,
      descripcion:    r.descripcion,
      unidad:         r.unidad,
      periodo:        r.periodo,
      cantPlan:       r.cantPlan,
      cantReal:       r.cantReal,
      costoUnitPlan:  r.costoUnitPlan,
      costoUnitReal:  r.costoUnitReal,
      active:         1,
    };
  }

  private showMsg(msg: string, type: 'success' | 'error'): void {
    this.saveMsg     = msg;
    this.saveMsgType = type;
    setTimeout(() => { this.saveMsg = ''; }, 4000);
  }
}
