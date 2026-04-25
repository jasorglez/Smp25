import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { DetalleMoliendaComponent } from './detalle-molienda.component';
import { lastValueFrom } from 'rxjs';
import { SignalsService } from '../../../../../services/signals.service';
import { BranchsService } from '../../../../../services/branchs.service';
import { MaterialsService } from '../../../../../services/materials.service';
import { MoliendaService, Molienda } from '../../../../../services/molienda.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-almmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular, SelectWithTooltipEditorV2Component, DetalleMoliendaComponent],
  styles: [`
    .toast-mini {
      display: inline-block;
      background: #198754;
      color: #fff;
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 6px;
      animation: fadeInOut 1.5s ease forwards;
    }
    @keyframes fadeInOut {
      0%   { opacity: 0; transform: translateY(-4px); }
      15%  { opacity: 1; transform: translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `],
  template: `
    <div class="col-md-12 mt-2">

      <div *ngIf="toastMsg()" class="toast-mini">{{ toastMsg() }}</div>

      <div class="d-flex">

        <!-- BOTONES CRUD — izquierda -->
        <div class="d-flex flex-column gap-2 me-2">
          <button class="btn btn-xs btn-success" title="Agregar" (click)="add()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-xs btn-primary position-relative" title="Guardar" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasUnsavedChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-xs btn-warning" title="Deshacer" (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-xs btn-danger" title="Borrar" (click)="deleteRow()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i>
          </button>
        </div>

        <!-- GRID -->
        <div class="flex-grow-1">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [columnDefs]="columnDefs"
            [gridOptions]="gridOptions"
            (gridReady)="onGridReady($event)"
            (cellValueChanged)="onCellValueChanged($event)"
            (rowClicked)="onRowClicked($event)"
            (cellEditingStopped)="onCellEditingStopped($event)"
            style="height: 350px; width: 100%;">
          </ag-grid-angular>
        </div>

      </div>

    </div>
  `,
})
export class AlmmoliendaComponent {
  private signalsService = inject(SignalsService);
  private branchsService = inject(BranchsService);
  private materialsService = inject(MaterialsService);
  private moliendaService = inject(MoliendaService);

  hasUnsavedChanges = false;
  selectedRow: any  = null;
  toastMsg          = signal('');
  rowData           = signal<any[]>([]);
  private originalRowData: any[] = [];
  gridApi!: GridApi;
  private idRoot = 0;
  private enterPressed = false;
  private editableColumnOrder = ['sucursal', 'id_articulo', 'ajustesInventarios', 'comentarios'];

  userBranches: any[] = [];
  branchNames: string[] = [];
  rawMaterials: any[] = [];
  rawMaterialNames: string[] = [];
  activeBranchFilter: number | null = null;
  expandedRowId: string | null = null;
  expandedDetailType: string | null = null;
  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) return this._columnDefs;

    this._columnDefs = [
    {
      headerName: 'Sucursal',
      field: 'sucursal',
      width: 200,
      editable: () => !this.activeBranchFilter || this.activeBranchFilter < 0,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({
        values: this.userBranches.map(b => b.id),
        valueListGap: 0,
        valueListMaxHeight: 220,
        cellWidth: 220,
        formatValue: (value: any) => {
          const branch = this.userBranches.find(b => b.id === value);
          return branch?.name ?? value?.toString() ?? '';
        }
      }),
      filter: true,
      filterValueGetter: (params) => {
        const branch = this.userBranches.find(b => b.id === params.data?.sucursal);
        return branch?.name ?? '';
      },
      valueFormatter: (params) => {
        const branch = this.userBranches.find(b => b.id === params.value);
        return branch?.name ?? '';
      },
      cellStyle: () => {
        if (this.activeBranchFilter && this.activeBranchFilter > 0) {
          return { backgroundColor: '#f0f0f0' };
        }
        return {};
      },
      valueSetter: (params) => {
        if (params.newValue == null) return false;
        params.data.sucursal = Number(params.newValue);
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },

    {
      headerName: 'Artículo',
      field: 'id_articulo',
      flex: 1,
      minWidth: 180,
      editable: true,
      cellDataType: 'text',
      cellEditor: 'selectV2',
      cellEditorParams: () => ({
        options: this.rawMaterialNames.map(name => ({ id: name, description: name })),
      }),
      valueSetter: (params) => {
        params.data.id_articulo = params.newValue ?? '';
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },

    {
      field: 'entradas',
      headerName: 'Entradas',
      width: 130,
      editable: false,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        const isNew = !!params.data?.__isNew;
        const container = document.createElement('div');
        container.style.cssText = isNew
          ? 'display:flex;align-items:center;cursor:not-allowed;color:#aaa;'
          : 'display:flex;align-items:center;cursor:pointer;color:#2e7d32;text-decoration:underline;';
        container.innerHTML = `<span>${count} registro(s)</span>`;
        if (!isNew) {
          container.addEventListener('click', () => this.toggleCascade(params.node, 'entradas'));
        }
        return container;
      },
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
    },
    {
      field: 'salidas',
      headerName: 'Salidas',
      width: 130,
      editable: false,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        const isNew = !!params.data?.__isNew;
        const container = document.createElement('div');
        container.style.cssText = isNew
          ? 'display:flex;align-items:center;cursor:not-allowed;color:#aaa;'
          : 'display:flex;align-items:center;cursor:pointer;color:#c62828;text-decoration:underline;';
        container.innerHTML = `<span>${count} registro(s)</span>`;
        if (!isNew) {
          container.addEventListener('click', () => this.toggleCascade(params.node, 'salidas'));
        }
        return container;
      },
      cellStyle: { backgroundColor: '#fce4ec', cursor: 'pointer' }
    },
    {
      headerName: 'Total Inventarios',
      field: 'totalInventarios',
      width: 150,
      editable: false,
      type: 'numericColumn',
      valueFormatter: (p) => String(Math.trunc(p.value ?? 0)),
      cellStyle: { backgroundColor: '#f0f4ff', fontWeight: '600' }
    },
    {
      headerName: 'Ajustes Inventarios',
      field: 'ajustesInventarios',
      width: 150,
      editable: true,
      type: 'numericColumn',
    },
    {
      headerName: 'Comentarios',
      field: 'comentarios',
      flex: 2,
      minWidth: 160,
      editable: true,
    },
    ];
    return this._columnDefs;
  }

  gridOptions: any = {
    components: {
      selectV2: SelectWithTooltipEditorV2Component,
    },
    getRowId: (params: any) => String(params.data.id ?? params.data.__tempId),
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    isExternalFilterPresent: () => this.activeBranchFilter != null,
    doesExternalFilterPass: (node: any) => node.data?.sucursal === this.activeBranchFilter,
    masterDetail: true,
    detailRowHeight: 280,
    isRowMaster: () => true,
    detailCellRenderer: DetalleMoliendaComponent,
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  constructor() {
    effect(() => {
      const idUser = this.signalsService.idUser();
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idUser && idCompany) {
        this.idRoot = idCompany;
        this.loadUserBranches();
        this.loadRawMaterials(idCompany);
      }
    });

    effect(() => {
      const branchId = this.signalsService.getBranchSelectedBySidebar()();
      const branchName = this.signalsService.getBranchNameSelectedBySidebar()();
      const isAll = !branchName || branchName === 'Todas las sucursales' || (branchId != null && branchId < 0);
      this.activeBranchFilter = isAll ? null : branchId;
      if (this.gridApi) {
        this.gridApi.onFilterChanged();
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('rowData', this.rowData());
    if (this.userBranches.length > 0 || this.rawMaterialNames.length > 0) {
      this._columnDefs = [];
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }
  }

  async loadUserBranches() {
    try {
      const idUser = this.signalsService.idUser();
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (!idUser || !idCompany) return;
      const data = await lastValueFrom(this.branchsService.getBranchesByUserAndCompany(idUser, idCompany));
      const list: any[] = (data as any)?.project ?? (Array.isArray(data) ? data : []);
      const mapped = list
        .map((b: any) => ({
          id: b?.idPermission || b?.idBranch || b?.id,
          name: (b?.name || b?.description || b?.Name || '') as string
        }))
        .filter(b => b.id && b.name.trim());
      this.userBranches = mapped;
      this.branchNames = mapped.map(b => b.name);
      this._columnDefs = [];
      if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.columnDefs);
    } catch (error) {
      console.error('Error loading user branches:', error);
    }
  }

  async loadRawMaterials(idCompany: number) {
    try {
      const data = await lastValueFrom(this.materialsService.getMaterialsxview(idCompany));
      const list: any[] = Array.isArray(data) ? data : [];
      this.rawMaterials = list;
      this.rawMaterialNames = list.map(m => m.articulo || m.description || m.insumo || '').filter(Boolean);
      this._columnDefs = [];
      if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.columnDefs);
      await this.loadData(this.idRoot);
    } catch (error) {
      console.error('Error loading raw materials:', error);
    }
  }

  private showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(''), 1500);
  }

  onRowClicked(event: any)       { this.selectedRow = event.data; }
  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  async loadData(idCompany: number) {
    try {
      const items = await lastValueFrom(this.moliendaService.getAll(idCompany));
      const mapped = (Array.isArray(items) ? items : []).map(i => this.mapRow(i));
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData.set(mapped);
      if (this.gridApi) this.gridApi.setGridOption('rowData', mapped);
    } catch (error) {
      console.error('Error loading molienda:', error);
      this.rowData.set([]);
      if (this.gridApi) this.gridApi.setGridOption('rowData', []);
    }
  }

  private mapRow(i: any): any {
    // Convertir idMaterial (número) al nombre para mostrarlo en el selectV2
    const material = this.rawMaterials.find(m => m.id === i.idMaterial);
    const nombreMaterial = material
      ? (material.articulo || material.description || material.insumo || '')
      : (i.idMaterial ?? '');
    return {
      id:                 i.id,
      sucursal:           i.idSucursal   ?? null,
      id_articulo:        nombreMaterial,
      entradas:           i.entradas     ?? 0,
      salidas:            i.salidas      ?? 0,
      totalInventarios:   i.totalInventarios   ?? 0,
      ajustesInventarios: i.ajustesInventarios ?? 0,
      comentarios:        i.comentarios  ?? '',
      __isNew:            false,
      __modified:         false,
    };
  }

  private toPayload(row: any): Molienda {
    // Convertir el nombre del artículo de vuelta a su ID numérico
    const material = this.rawMaterials.find(
      m => (m.articulo || m.description || m.insumo || '') === row.id_articulo
    );
    return {
      idCompany:          this.idRoot,
      idSucursal:         row.sucursal       ?? null,
      idMaterial:         material?.id       ?? null,
      entradas:           row.entradas       ?? 0,
      salidas:            row.salidas        ?? 0,
      totalInventarios:   row.totalInventarios   ?? 0,
      ajustesInventarios: row.ajustesInventarios ?? 0,
      comentarios:        row.comentarios    || null,
      active:             true,
    };
  }

  toggleCascade(node: any, type: string) {
    if (node.data?.__isNew) return;

    if (this.expandedRowId === node.id && this.expandedDetailType === type) {
      node.setExpanded(false);
      this.expandedRowId = null;
      this.expandedDetailType = null;
      node.data.detailType = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }

    if (this.expandedRowId) {
      this.gridApi.forEachNode((n: any) => {
        if (n.id === this.expandedRowId) { n.setExpanded(false); }
      });
    }

    this.gridApi.forEachNode((n: any) => {
      if (n.id !== node.id) n.setRowHeight(0);
    });

    node.data.detailType = type;
    this.expandedRowId = node.id;
    this.expandedDetailType = type;
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  add() {
    const branchName = this.signalsService.getBranchNameSelectedBySidebar()() ?? '';
    const currentBranch = this.userBranches.find(b => b.name === branchName);
    const newRow = {
      id: null,
      __tempId: `new_${Date.now()}`,
      sucursal: currentBranch?.id ?? null,
      id_articulo: '',
      entradas: 0,
      salidas: 0,
      totalInventarios: 0,
      ajustesInventarios: 0,
      comentarios: '',
      __isNew: true,
    };
    const updated = [newRow, ...this.rowData()];
    this.rowData.set(updated);
    this.hasUnsavedChanges = true;
    if (this.gridApi) this.gridApi.setGridOption('rowData', updated);
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'sucursal' });
    }, 0);
  }

  async saveChanges() {
    const newRows      = this.rowData().filter(r => r.__isNew);
    const modifiedRows = this.rowData().filter(r => r.__modified && !r.__isNew);
    if (newRows.length === 0 && modifiedRows.length === 0) return;

    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.moliendaService.create(this.toPayload(row)));
        row.id      = created.id;
        row.__isNew = false;
      }
      for (const row of modifiedRows) {
        await lastValueFrom(this.moliendaService.update(row.id, this.toPayload(row)));
        row.__modified = false;
      }

      const saved = newRows.length + modifiedRows.length;
      this.hasUnsavedChanges = false;
      this.originalRowData   = JSON.parse(JSON.stringify(this.rowData()));
      this.showToast(`${saved} registro(s) guardado(s)`);
    } catch (error) {
      console.error('Error saving molienda:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar.', 'error');
    }
  }

  revertChanges() {
    const reverted = JSON.parse(JSON.stringify(this.originalRowData));
    this.rowData.set(reverted);
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', reverted);
  }

  async deleteRow() {
    if (!this.selectedRow) return;

    if (this.selectedRow.__isNew) {
      const filtered = this.rowData().filter(r => r !== this.selectedRow);
      this.rowData.set(filtered);
      this.selectedRow = null;
      this.hasUnsavedChanges = filtered.some((r: any) => r.__isNew || r.__modified);
      if (this.gridApi) this.gridApi.setGridOption('rowData', filtered);
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Eliminar registro?', '', 'warning', 'Sí, eliminar'
    );
    if (!confirm.isConfirmed) return;

    try {
      await lastValueFrom(this.moliendaService.delete(this.selectedRow.id));
      const afterDelete = this.rowData().filter(r => r !== this.selectedRow);
      this.rowData.set(afterDelete);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      if (this.gridApi) this.gridApi.setGridOption('rowData', afterDelete);
      this.selectedRow = null;
      this.showToast('Eliminado');
    } catch (error) {
      console.error('Error deleting molienda:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al eliminar.', 'error');
    }
  }
}
