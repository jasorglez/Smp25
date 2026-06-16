import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { EmployeesService } from 'app/services/employees.service';
import { UsersService } from 'app/services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { SelectOption } from 'app/shared/select-dropdown.service';
import { MultiSelectEmployeeEditorComponent, EmployeeOption } from 'app/shared/multi-select-employee-editor.component';
import { MultiSelectActividadEditorComponent, ActividadOption } from 'app/shared/multi-select-actividad-editor.component';
import { TimeEditorComponent } from 'app/domains/Indicadores/components/ind01/timeinactives/time-editor.component';

@Component({
  selector: 'app-lib-limpieza-bote',
  standalone: true,
  imports: [CommonModule, AgGridAngular, SelectWithTooltipEditorV2Component, MultiSelectEmployeeEditorComponent, MultiSelectActividadEditorComponent, TimeEditorComponent],
  styles: [':host { display: block; height: 100%; overflow: hidden; }'],
  template: `
    <div style="height:100%;display:flex;flex-direction:column;background:#f0fff4;border-top:2px solid #c3e6cb;">

      <!-- Toolbar -->
      <div style="padding:3px 8px;flex-shrink:0;border-bottom:1px solid #c3e6cb;display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.78rem;color:#155724;font-weight:600;flex:1;">
          <i class="bi bi-check2-circle me-1"></i>Liberación Limpieza
          <span *ngIf="loading" class="ms-2 text-muted" style="font-size:0.75rem;">
            <i class="bi bi-hourglass-split"></i> Cargando…
          </span>
        </span>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-success" (click)="addRow()" [disabled]="!gridApi || botesVacios"
                  [title]="botesVacios ? 'No hay botes registrados' : ''">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary position-relative"
                  (click)="saveChanges()" [disabled]="!hasChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span *ngIf="hasChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
              <span class="visually-hidden">Cambios sin guardar</span>
            </span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revert()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteRow()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>

      <!-- Grid -->
      <div style="flex:1 1 auto;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz"
          style="width:100%;height:100%;"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged()">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class LibLimpiezaBoteComponent {
  private productionService = inject(ProductionService);
  private employeesService  = inject(EmployeesService);
  private usersService      = inject(UsersService);
  private signalsService    = inject(SignalsService);

  loading = false;
  gridApi!: GridApi;
  rowData: any[] = [];
  private originalRowData: any[] = [];
  selectedRow: any = null;
  hasChanges = false;
  colDefs: ColDef[] = [];

  private idParams: number | null = null;
  private idBranch: number | null = null;
  private currentUserId: number | null = null;
  private currentUserName = '';
  botesVacios = false;

  private employeeOptions: EmployeeOption[] = [];
  private userOptions: SelectOption[] = [];
  private actividadesOptions: ActividadOption[] = [];
  private availableIds: Set<number> = new Set();
  private nextAvailableDates: Map<number, Date> = new Map();

  private static readonly PERIOD_DAYS: Record<string, number> = {
    'Diario': 1, 'Cada 2 días': 2, 'Cada semana': 7, 'Cada 2 semanas': 14,
  };

  private computeAvailability(rows: any[]): void {
    const lastDone = new Map<number, Date>();
    for (const row of rows) {
      if (!row.fecha || !row.actividadesIds) continue;
      const fecha = new Date(row.fecha + 'T00:00:00');
      let ids: number[] = [];
      try { ids = JSON.parse(row.actividadesIds); } catch { /* empty */ }
      for (const id of ids) {
        if (!lastDone.has(id) || fecha > lastDone.get(id)!) lastDone.set(id, fecha);
      }
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    this.availableIds.clear();
    this.nextAvailableDates.clear();
    for (const act of this.actividadesOptions) {
      const days = LibLimpiezaBoteComponent.PERIOD_DAYS[act.periodicidad ?? ''];
      if (!days) { this.availableIds.add(act.id); continue; } // 'Ninguno' o sin periodicidad → siempre
      const last = lastDone.get(act.id);
      if (!last) { this.availableIds.add(act.id); continue; } // nunca hecha → disponible
      const next = new Date(last);
      next.setDate(next.getDate() + days);
      if (today >= next) this.availableIds.add(act.id);
      else this.nextAvailableDates.set(act.id, next);
    }
  }

  gridOptions: any = {
    getRowId: (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight: 24,
    rowHeight: 24,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  @Input() set agParams(p: any) {
    if (p) this.initFromParams(p);
  }

  agInit(p: any): void { this.initFromParams(p); }
  refresh(): boolean { return false; }

  private async initFromParams(params: any) {
    this.idParams         = params.data?.id ?? null;
    this.idBranch         = params.context?.idBranch ?? params.data?.idBranch ?? null;
    this.botesVacios      = params.data?.botesVacios ?? false;
    this.currentUserId    = this.signalsService.profile.idUser();
    this.currentUserName  = this.signalsService.profile.nameUser() ?? '';
    this.actividadesOptions = params.context?.actividadesOptions ?? [];

    const idCompany = this.signalsService.getRootSelectedBySidebar()();

    await this.loadCatalogs(idCompany);
    this.buildColDefs();
    if (this.idParams) await this.loadData();
  }

  private async loadCatalogs(idCompany: number | null) {
    try {
      const [employees, users] = await Promise.all([
        this.idBranch
          ? lastValueFrom(this.employeesService.getEmployeesVigente(this.idBranch)).catch(() => [])
          : Promise.resolve([]),
        idCompany
          ? lastValueFrom(this.usersService.get2fieldsUsers(idCompany)).catch(() => [])
          : Promise.resolve([]),
      ]);

      const empList: any[] = Array.isArray(employees) ? employees : [];
      this.employeeOptions = empList
        .filter((e: any) => e.active !== false)
        .map((e: any) => ({
          id: e.id ?? e.Id,
          name: e.name ?? e.Name ?? `Empleado ${e.id ?? e.Id}`,
        }));

      const rawUsers: any = users;
      const userList: any[] = Array.isArray(rawUsers?.data) ? rawUsers.data
                            : Array.isArray(rawUsers)        ? rawUsers
                            : [];
      this.userOptions = userList.map((u: any) => ({
        id: u.id,
        description: u.DisplayName ?? u.displayName ?? u.usersmall ?? `#${u.id}`,
      }));
    } catch {
      this.employeeOptions = [];
      this.userOptions     = [];
    }
  }

  private buildColDefs() {
    this.colDefs = [
      {
        field: 'fecha', headerName: 'Fecha', editable: true, width: 130,
        cellEditor: 'agDateCellEditor',
        valueGetter: (p: any) => {
          if (!p.data?.fecha) return null;
          const [y, m, d] = String(p.data.fecha).split('-').map(Number);
          return new Date(y, m - 1, d);
        },
        valueFormatter: (p: any) => {
          if (!p.value) return '';
          const d: Date = p.value instanceof Date ? p.value : new Date(p.value);
          if (isNaN(d.getTime())) return '';
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        },
        valueSetter: (p: any) => {
          if (!p.newValue) return false;
          let iso: string;
          if (p.newValue instanceof Date) {
            const d = p.newValue as Date;
            iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          } else {
            const s = String(p.newValue);
            iso = s.includes('T') ? s.split('T')[0] : s;
          }
          p.data.fecha = iso; p.data.__modified = true; return true;
        },
      },
      {
        field: 'empleadosIds', headerName: 'Quien liberó', editable: true, flex: 1,
        cellEditor: MultiSelectEmployeeEditorComponent,
        cellEditorPopup: true,
        cellEditorParams: () => ({ options: this.employeeOptions }),
        valueFormatter: (p: any) => {
          if (!p.value) return '';
          try {
            const ids: number[] = JSON.parse(p.value);
            return ids
              .map(id => this.employeeOptions.find(e => e.id === id)?.name ?? `#${id}`)
              .join(', ');
          } catch { return p.value; }
        },
        valueSetter: (p: any) => { p.data.empleadosIds = p.newValue; p.data.__modified = true; return true; },
      },
      {
        field: 'idUsuario', headerName: 'Quien autorizó', editable: true, width: 180,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({ options: this.userOptions }),
        valueFormatter: (p: any) => {
          if (p.value == null) return '';
          return this.userOptions.find(u => u.id === p.value)?.description ?? `#${p.value}`;
        },
        valueSetter: (p: any) => { p.data.idUsuario = p.newValue; p.data.__modified = true; return true; },
      },
      {
        field: 'actividadesIds', headerName: 'Actividades', editable: true, flex: 1,
        cellEditor: MultiSelectActividadEditorComponent,
        cellEditorPopup: true,
        cellEditorParams: () => ({
          options: this.actividadesOptions,
          availableIds: this.availableIds,
          nextAvailableDates: this.nextAvailableDates,
        }),
        valueFormatter: (p: any) => {
          if (!p.value || !this.actividadesOptions.length) return '';
          try {
            const ids: number[] = JSON.parse(p.value);
            if (!ids.length) return '';
            const total = this.actividadesOptions.length;
            const done  = ids.length;
            const names = ids
              .map(id => this.actividadesOptions.find(a => a.id === id)?.actividad ?? '')
              .filter(Boolean)
              .join(', ');
            return `${done}/${total}: ${names}`;
          } catch { return ''; }
        },
        cellStyle: (p: any) => {
          if (!p.value) return {};
          try {
            const ids: number[] = JSON.parse(p.value);
            const done  = ids.length;
            const total = this.actividadesOptions.length;
            if (!total) return {};
            return done === total
              ? { color: '#155724', fontWeight: '600' }
              : done > 0
                ? { color: '#856404' }
                : {};
          } catch { return {}; }
        },
        valueSetter: (p: any) => {
          p.data.actividadesIds = p.newValue; p.data.__modified = true; return true;
        },
      },
    ];
  }

  private async loadData() {
    this.loading = true;
    try {
      const items = await lastValueFrom(
        this.productionService.getMoliendaLibLimpiezaByParams(this.idParams!)
      ).catch(() => [] as any[]);

      const mapped = (items as any[]).map((i: any) => ({
        id: i.id,
        fecha: i.fecha ?? null,
        empleadosIds: i.empleadosIds ?? '[]',
        idUsuario: i.idUsuario ?? null,
        actividadesIds: i.actividadesIds ?? '[]',
        __isNew: false, __modified: false,
      }));
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = [...mapped];
      this.computeAvailability(mapped);
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.autoSizeAllColumns();
      }
    } finally {
      this.loading = false;
    }
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    if (this.rowData.length) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.autoSizeAllColumns();
    }
  }

  onSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  onCellValueChanged() { this.hasChanges = true; }

  addRow() {
    if (this.botesVacios) return;
    const today = new Date();
    const fecha = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const newRow: any = {
      id: null, __tempId: `new_${Date.now()}`, __isNew: true, __modified: false,
      fecha,
      empleadosIds: '[]',
      idUsuario: this.currentUserId,
      actividadesIds: '[]',
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fecha' }), 50);
    }
  }

  async saveChanges() {
    if (!this.idParams) return;
    try {
      const newRows = this.rowData.filter(r => r.__isNew);
      const modRows = this.rowData.filter(r => r.__modified && !r.__isNew && r.id);

      for (const r of newRows) {
        await lastValueFrom(
          this.productionService.createMoliendaLibLimpieza({
            idParams:       this.idParams!,
            fecha:          r.fecha,
            empleadosIds:   r.empleadosIds,
            idUsuario:      r.idUsuario,
            actividadesIds: r.actividadesIds,
          })
        );
      }
      for (const r of modRows) {
        await lastValueFrom(
          this.productionService.updateMoliendaLibLimpieza(r.id, {
            fecha:          r.fecha,
            empleadosIds:   r.empleadosIds,
            idUsuario:      r.idUsuario,
            actividadesIds: r.actividadesIds,
          })
        );
      }
      this.hasChanges = false;
      await this.loadData();
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    const confirmed = await alerts.confirmAlert('¿Eliminar?', 'Se eliminará este registro.', 'warning', 'Eliminar');
    if (!confirmed) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
    } else {
      await lastValueFrom(this.productionService.deleteMoliendaLibLimpieza(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
    }
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }
}
