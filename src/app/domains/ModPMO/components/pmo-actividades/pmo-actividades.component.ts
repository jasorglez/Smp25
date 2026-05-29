import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { AgGridModule }        from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, GridOptions } from 'ag-grid-enterprise';
import { lastValueFrom }       from 'rxjs';
import { ProjectsService }     from 'app/services/projects.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { ConventionsService }  from 'app/services/conventions.service';
import { SignalsService }      from 'app/services/signals.service';

interface ActividadRow {
  id:           number;       // 0 = nuevo
  idProject:    number;
  idConvention: number | null;
  activity:     string;       // WBS
  description:  string;
  unit:         string;
  quantity:     number | null;
  costMX:       number | null;
  startDate:    string;
  endDate:      string;
  predecessor:  string;
  criticalRoute: string;
  typeActivity: string;
  parent:       number;
  sortorder:    number;
  active:       number;
  __isNew?:     boolean;
  __modified?:  boolean;
}

@Component({
  selector: 'app-pmo-actividades',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './pmo-actividades.component.html',
})
export class PmoActividadesComponent implements OnInit {

  private _projectsService = inject(ProjectsService);
  private _wpService       = inject(WorkprogramsService);
  private _convService     = inject(ConventionsService);
  private _signalsService  = inject(SignalsService);

  idCompany = 0;
  projects: any[]   = [];
  selectedProject: any = null;

  conventions:        any[] = [];
  selectedConvention: any   = null;
  isLoadingConv             = false;

  isLoading        = false;
  isSaving         = false;
  hasUnsavedChanges = false;
  saveMsg          = '';
  saveMsgType      = '';

  gridApi!: GridApi;
  rowData: ActividadRow[] = [];
  private originalRowData: ActividadRow[] = [];

  // ── Enter-key navigation ──────────────────────────────────────────────────
  private editableColumnOrder = ['activity','description','unit','quantity','costMX','startDate','endDate','predecessor','criticalRoute'];
  private enterPressed = false;

  // ── Column defs ───────────────────────────────────────────────────────────
  colDefs: ColDef[] = [
    {
      field: 'activity', headerName: 'WBS / Partida', width: 110, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'description', headerName: 'Descripción / Actividad', width: 240, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'unit', headerName: 'Unidad', width: 80, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'quantity', headerName: 'Cantidad', width: 90, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(2) : '',
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    {
      field: 'costMX', headerName: 'P.U. MXN', width: 110, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '',
      onCellValueChanged: (p) => this.markModified(p.data),
    },
    {
      field: 'startDate', headerName: 'Inicio', width: 115, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.startDate ? String(p.data.startDate).substring(0, 10) : '',
      valueSetter: (p) => { p.data.startDate = p.newValue; return true; },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    {
      field: 'endDate', headerName: 'Término', width: 115, editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (p) => p.data?.endDate ? String(p.data.endDate).substring(0, 10) : '',
      valueSetter: (p) => { p.data.endDate = p.newValue; return true; },
      valueFormatter: (p) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    {
      field: 'predecessor', headerName: 'Pred.', width: 80, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {},
    },
    {
      field: 'criticalRoute', headerName: 'R.C.', width: 70, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Si', 'No'] },
      cellStyle: (p) => p.value === 'Si'
        ? { color: '#c0392b', fontWeight: 'bold' }
        : {},
    },
    {
      field: 'typeActivity', headerName: 'Tipo', width: 100, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Activity', 'Milestone', 'Summary'] },
      cellStyle: (p) => p.value === 'Milestone'
        ? { color: '#8e44ad', fontWeight: 'bold' }
        : p.value === 'Summary' ? { color: '#2980b9', fontWeight: 'bold' } : {},
    },
  ];

  rowClassRules = { 'new-row-highlight': (p: any) => !!p.data?.__isNew };

  gridOptions: GridOptions = {
    defaultColDef: {
      sortable: true, resizable: true, minWidth: 60,
      suppressKeyboardEvent: (params) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    rowSelection: 'single',
    animateRows: true,
    overlayLoadingTemplate: "<span class='ag-overlay-loading-center'>Cargando actividades…</span>",
    overlayNoRowsTemplate: "<span class='text-muted small'>Sin actividades. Usa <b>+ Agregar</b> o importa desde Excel.</span>",
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
    this.selectedConvention = null;
    this.conventions        = [];
    this.rowData            = [];
    this.hasUnsavedChanges  = false;
    if (!this.selectedProject) return;
    await this.loadConventions();
  }

  async loadConventions(): Promise<void> {
    const idContrato = this.selectedProject?.idContrato ?? this.selectedProject?.id_contrato ?? 0;
    if (!idContrato) {
      await this.loadActividades();
      return;
    }
    this.isLoadingConv = true;
    try {
      const res: any = await lastValueFrom(
        this._convService.getConventionsByContractOrProject('contract', idContrato)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.conventions = raw.filter((c: any) => c.active !== false).sort((a: any, b: any) => a.id - b.id);

      const vigente = this.conventions.find((c: any) => c.vigente);
      if (vigente)                         { this.selectedConvention = vigente; await this.loadActividades(); }
      else if (this.conventions.length === 1) { this.selectedConvention = this.conventions[0]; await this.loadActividades(); }
    } catch {
      this.conventions = [];
      await this.loadActividades();
    } finally { this.isLoadingConv = false; }
  }

  async onConventionChange(): Promise<void> {
    this.rowData           = [];
    this.hasUnsavedChanges = false;
    this.setRowData([]);
    await this.loadActividades();
  }

  async loadActividades(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoading = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.showLoadingOverlay();
    try {
      const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
      let raw: any[];
      if (this.selectedConvention) {
        raw = await lastValueFrom(this._wpService.getByConvention(this.selectedConvention.id, idProject));
      } else {
        raw = await lastValueFrom(this._wpService.getWorkPrograms(idProject, 'Project'));
      }
      this.rowData = (raw ?? []).map(r => this.mapFromApi(r));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      this.setRowData(this.rowData);
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.rowData.length ? this.gridApi.hideOverlay() : this.gridApi.showNoRowsOverlay();
    } catch (err) {
      console.error('Error cargando actividades PMO', err);
      this.rowData = [];
      this.setRowData([]);
    } finally { this.isLoading = false; }
  }

  onGridReady(e: GridReadyEvent): void { this.gridApi = e.api; }

  onCellEditingStopped(event: any): void {
    const data: ActividadRow = event.data;
    if (!data.__isNew) data.__modified = true;
    this.hasUnsavedChanges = true;

    if (!this.enterPressed) return;
    this.enterPressed = false;
    const cur = this.editableColumnOrder.indexOf(event.column.getColId());
    if (cur !== -1 && cur < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[cur + 1] });
      }, 80);
    }
  }

  addRow(): void {
    if (!this.selectedProject) return;
    const newRow: ActividadRow = {
      id: 0,
      idProject:    this.selectedProject.id,
      idConvention: this.selectedConvention?.id ?? null,
      activity:     '',
      description:  '',
      unit:         '',
      quantity:     null,
      costMX:       null,
      startDate:    '',
      endDate:      '',
      predecessor:  '',
      criticalRoute: 'No',
      typeActivity: 'Activity',
      parent:       0,
      sortorder:    this.rowData.length,
      active:       1,
      __isNew:      true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.setRowData(this.rowData);
    setTimeout(() => {
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'activity' });
    }, 50);
  }

  async saveChanges(): Promise<void> {
    const dirty = this.rowData.filter(r => r.__isNew || r.__modified);
    if (!dirty.length) { this.showMsg('No hay cambios que guardar', 'error'); return; }
    this.isSaving = true;
    let saved = 0;
    try {
      for (const row of dirty) {
        const payload = this.mapToApi(row);
        if (row.id === 0) {
          const res: any = await lastValueFrom(this._wpService.addWorkProgram(payload));
          row.id    = res?.id ?? res?.data?.id ?? row.id;
          row.__isNew     = false;
          row.__modified  = false;
        } else {
          await lastValueFrom(this._wpService.updateWorkProgram(row.id, payload));
          row.__modified = false;
        }
        saved++;
      }
      this.hasUnsavedChanges = false;
      this.originalRowData   = JSON.parse(JSON.stringify(this.rowData));
      this.setRowData(this.rowData);
      this.showMsg(`✓ ${saved} actividad(es) guardada(s)`, 'success');
    } catch (err: any) {
      this.showMsg('Error al guardar — revisa la consola', 'error');
      console.error(err);
    } finally { this.isSaving = false; }
  }

  async deleteSelected(): Promise<void> {
    const selected = this.gridApi?.getSelectedRows() ?? [];
    if (!selected.length) return;
    const row: ActividadRow = selected[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(r => r !== row);
      this.setRowData(this.rowData);
      return;
    }
    if (!confirm(`¿Eliminar "${row.description || row.activity}"?`)) return;
    try {
      await lastValueFrom(this._wpService.deleteWorkProgram(row.id));
      await this.loadActividades();
      this.showMsg('Actividad eliminada', 'success');
    } catch { this.showMsg('Error al eliminar', 'error'); }
  }

  revertChanges(): void {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.setRowData(this.rowData);
  }

  exportXLS(): void {
    this.gridApi?.exportDataAsExcel({ fileName: 'PMO_Actividades.xlsx' });
  }

  convTypeBadge(type: string): { label: string; css: string } {
    const t = (type ?? '').toLowerCase();
    if (t.includes('reprog'))                      return { label: 'Reprogramación',       css: 'bg-warning text-dark' };
    if (t.includes('adend') || t.includes('addend')) return { label: 'Adenda',             css: 'bg-info text-dark'    };
    return                                                  { label: 'Programación Original', css: 'bg-primary'         };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private setRowData(data: ActividadRow[]): void {
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', data);
  }

  private markModified(row: ActividadRow): void {
    if (!row.__isNew) row.__modified = true;
    this.hasUnsavedChanges = true;
  }

  private mapFromApi(r: any): ActividadRow {
    return {
      id:           r.id ?? 0,
      idProject:    r.id_project ?? r.idProject ?? 0,
      idConvention: r.id_convention ?? r.idConvention ?? null,
      activity:     r.activity ?? '',
      description:  r.description ?? r.especification ?? '',
      unit:         r.measure ?? r.unit ?? '',
      quantity:     r.quantity != null ? Number(r.quantity) : null,
      costMX:       r.costMX != null ? Number(r.costMX) : null,
      startDate:    r.startdate ?? r.startDate ?? '',
      endDate:      r.endate ?? r.endDate ?? '',
      predecessor:  String(r.predecesor ?? r.predecessor ?? ''),
      criticalRoute: r.criticroute ?? r.criticalRoute ?? 'No',
      typeActivity: r.typeactivity ?? r.typeActivity ?? 'Activity',
      parent:       Number(r.parent ?? 0),
      sortorder:    Number(r.sortorder ?? 0),
      active:       Number(r.active ?? 1),
    };
  }

  private mapToApi(r: ActividadRow): any {
    return {
      id:           r.id,
      idProject:    r.idProject,
      id_convention: r.idConvention,
      activity:     r.activity,
      text:         r.description,
      description:  r.description,
      measure:      r.unit || null,
      quantity:     r.quantity ?? 0,
      costMX:       r.costMX ?? 0,
      costDLL:      0,
      salePrice:    0,
      startdate:    r.startDate || null,
      endate:       r.endDate   || null,
      progress:     0,
      ponderado:    null,
      criticroute:  r.criticalRoute,
      typeActivity: r.typeActivity,
      parent:       r.parent,
      sortorder:    r.sortorder,
      predecesor:   Number(r.predecessor) || 0,
      active:       r.active,
      type:         'Project',
      resources:    null,
      phase:        null,
    };
  }

  private showMsg(msg: string, type: 'success' | 'error'): void {
    this.saveMsg     = msg;
    this.saveMsgType = type;
    setTimeout(() => { this.saveMsg = ''; }, 4000);
  }
}
