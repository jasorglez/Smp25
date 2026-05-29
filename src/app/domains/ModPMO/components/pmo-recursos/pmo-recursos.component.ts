import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule }         from '@angular/common';
import { FormsModule }          from '@angular/forms';
import { AgGridModule }         from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom }        from 'rxjs';
import { ProjectsService }      from 'app/services/projects.service';
import { SignalsService }       from 'app/services/signals.service';

interface RecursoRow {
  tipo:         string;   // Personal | Material | Equipo | Subcontrato | Indirecto
  descripcion:  string;
  unidad:       string;
  cantPlan:     number;
  cantReal:     number;
  costUnitPlan: number;
  costUnitReal: number;
  costoPlan:    number;
  costoReal:    number;
  variacion:    number;   // costoReal - costoPlan
  semana:       string;   // ISO week label
  __isNew?:     boolean;
  __modified?:  boolean;
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

  idCompany       = 0;
  projects: any[] = [];
  selectedProject: any = null;
  selectedPeriod  = 'semanal';    // semanal | quincenal | mensual
  isLoading       = false;
  hasUnsavedChanges = false;

  gridApi!: GridApi;
  rowData: RecursoRow[] = [];

  TIPOS = ['Personal', 'Material', 'Equipo', 'Subcontrato', 'Indirecto'];

  // ── Totales ───────────────────────────────────────────────────────────────
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
    { field: 'descripcion', headerName: 'Descripción',  width: 200, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {} },
    { field: 'unidad',      headerName: 'Unidad',       width: 80,  editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {} },
    { field: 'semana',      headerName: 'Período',      width: 110, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffacd' } : {} },
    {
      field: 'cantPlan', headerName: 'Cant. Plan', width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => { p.data.costoPlan = p.data.cantPlan * p.data.costUnitPlan; this.recalcTotals(); p.data.__modified = true; this.hasUnsavedChanges = true; },
    },
    {
      field: 'cantReal', headerName: 'Cant. Real', width: 100, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => { p.data.costoReal = p.data.cantReal * p.data.costUnitReal; p.data.variacion = p.data.costoReal - p.data.costoPlan; this.recalcTotals(); p.data.__modified = true; this.hasUnsavedChanges = true; },
    },
    {
      field: 'costUnitPlan', headerName: 'C.Unit Plan', width: 110, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => { p.data.costoPlan = p.data.cantPlan * p.data.costUnitPlan; p.data.__modified = true; this.recalcTotals(); this.hasUnsavedChanges = true; },
    },
    {
      field: 'costUnitReal', headerName: 'C.Unit Real', width: 110, editable: true, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toFixed(2),
      onCellValueChanged: (p) => { p.data.costoReal = p.data.cantReal * p.data.costUnitReal; p.data.variacion = p.data.costoReal - p.data.costoPlan; p.data.__modified = true; this.recalcTotals(); this.hasUnsavedChanges = true; },
    },
    {
      field: 'costoPlan', headerName: 'Costo Plan', width: 110, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { background: '#e8f4fd' },
    },
    {
      field: 'costoReal', headerName: 'Costo Real', width: 110, editable: false, type: 'numericColumn',
      valueFormatter: (p) => (p.value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      cellStyle: { background: '#e8f4fd' },
    },
    {
      field: 'variacion', headerName: 'Variación', width: 110, editable: false, type: 'numericColumn',
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

  addRow(): void {
    const today = new Date().toISOString().substring(0, 10);
    const newRow: RecursoRow = {
      tipo: 'Personal', descripcion: '', unidad: 'día',
      cantPlan: 0, cantReal: 0, costUnitPlan: 0, costUnitReal: 0,
      costoPlan: 0, costoReal: 0, variacion: 0,
      semana: today, __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => { this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'tipo' }); }, 50);
  }

  recalcTotals(): void {
    this.totalPlan = this.rowData.reduce((s, r) => s + Number(r.costoPlan ?? 0), 0);
    this.totalReal = this.rowData.reduce((s, r) => s + Number(r.costoReal ?? 0), 0);
    this.totalVar  = this.totalReal - this.totalPlan;
  }

  saveChanges(): void {
    // TODO: conectar a endpoint cuando se cree tabla pmo_recursos en BD
    // Por ahora solo marca como guardado
    this.rowData = this.rowData.map(r => ({ ...r, __isNew: false, __modified: false }));
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
    alert('Cambios registrados localmente.\n\nPara persistir: conecta al endpoint PMO/Recursos (Punto 9 — próxima entrega).');
  }

  revertChanges(): void {
    this.rowData = this.rowData.filter(r => !r.__isNew).map(r => ({ ...r, __modified: false }));
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  exportXLS(): void {
    this.gridApi?.exportDataAsExcel({ fileName: 'PMO_Recursos.xlsx' });
  }
}
