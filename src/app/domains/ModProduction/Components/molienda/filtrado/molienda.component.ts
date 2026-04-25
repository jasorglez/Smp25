import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProductionService } from 'app/services/production.service';
import { MaterialXModuloService } from 'app/services/materialxmodulo.service';
import { MaterialsService } from 'app/services/materials.service';

@Component({
  selector: 'app-molienda-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div class="col-12">
      <div class="row g-2">
        <div class="col-auto">
          <div class="d-flex flex-column gap-1">
            <button type="button" class="btn btn-success btn-sm" (click)="addRow()" [disabled]="!gridApi">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" class="btn btn-primary btn-sm position-relative" (click)="saveChanges()" [disabled]="!hasChanges">
              <i class="bi bi-floppy"></i>
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                    *ngIf="hasChanges">
              </span>
            </button>
            <button type="button" class="btn btn-warning btn-sm" (click)="revert()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button type="button" class="btn btn-danger btn-sm" (click)="deleteEntry()" [disabled]="!selectedRow">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="col">
          <ag-grid-angular
            style="width: 100%"
            [ngStyle]="{ height: gridHeight }"
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="rowData"
            [columnDefs]="colDefs"
            [gridOptions]="gridOptions"
            [rowSelection]="'single'"
            [stopEditingWhenCellsLoseFocus]="true"
            (gridReady)="onGridReady($event)"
            (selectionChanged)="onSelectionChanged($event)"
            (cellValueChanged)="onCellValueChanged($event)"
>
          </ag-grid-angular>
        </div>
      </div>
    </div>
  `,
})
export class MoliendaComponent {
  private signalService     = inject(SignalsService);
  private branchsService    = inject(BranchsService);
  private productionService = inject(ProductionService);
  private mxmService        = inject(MaterialXModuloService);
  private materialsService  = inject(MaterialsService);

  gridApi!: GridApi;
  rowData: any[] = [];
  private originalRowData: any[] = [];
  hasChanges  = false;
  selectedRow: any = null;
  gridHeight  = '80vh';

  userBranches:   { id: number; name: string }[] = [];
  matPrimaOptions: { id: number; name: string }[] = [];

  private idCompany = 0;
  get colDefs(): ColDef[] {
    return [
      {
        field: 'sucursal',
        headerName: 'Sucursal',
        width: 180,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorPopup: true,
        cellEditorParams: () => ({
          values: this.userBranches.map(b => b.id),
          valueListMaxHeight: 220,
          formatValue: (val: any) => this.userBranches.find(b => b.id === val)?.name ?? String(val ?? ''),
        }),
        valueFormatter: p => this.userBranches.find(b => b.id === p.value)?.name ?? '',
        valueSetter: p => { p.data.sucursal = Number(p.newValue); p.data.__modified = true; this.hasChanges = true; return true; },
      },
      {
        field: 'matPrima',
        headerName: 'Mat Prima',
        flex: 2,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorPopup: true,
        cellEditorParams: () => ({
          values: this.matPrimaOptions.map(m => m.id),
          valueListMaxHeight: 220,
          formatValue: (val: any) => this.matPrimaOptions.find(m => m.id === val)?.name ?? String(val ?? ''),
        }),
        valueFormatter: p => this.matPrimaOptions.find(m => m.id === p.value)?.name ?? '',
        valueSetter: p => { p.data.matPrima = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
      },
      {
        field: 'fecha', headerName: 'Fecha', width: 120, editable: false,
        cellStyle: { backgroundColor: '#f8f9fa' },
        valueFormatter: p => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d && m && y ? `${d}/${m}/${y}` : p.value;
        },
      },
      { field: 'nombre',         headerName: 'Nombre',          flex: 2,    editable: false, cellStyle: { backgroundColor: '#f8f9fa' } },
      { field: 'cantidadUso',    headerName: 'Cantidad uso',    width: 120, editable: true, cellEditor: 'agNumberCellEditor' },
      { field: 'cuantoQueda',    headerName: 'Cuanto queda',    width: 120, editable: true, cellEditor: 'agNumberCellEditor' },
      { field: 'jugo',           headerName: 'Jugo',            width: 90,  editable: true, cellEditor: 'agNumberCellEditor' },
      { field: 'liberPorCompra', headerName: 'Liber. x Compra', width: 130, editable: true, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor' },
      { field: 'adicional',      headerName: 'Adicional',       flex: 1,    editable: true },
    ];
  }

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressRowClickSelection: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowSelected: (e: any) => {
      if (e.node.isSelected()) this.selectedRow = e.data;
    },
  };

  constructor() {
    effect(() => {
      const idUser    = this.signalService.idUser();
      const idCompany = this.signalService.getRootSelectedBySidebar()();
      if (idUser && idCompany) {
        this.idCompany = idCompany;
        this.loadBranches(idUser, idCompany);
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectionChanged(event: any) {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  private async loadBranches(idUser: number, idCompany: number) {
    try {
      const [branchData, mxmData, matsData] = await Promise.all([
        lastValueFrom(this.branchsService.getBranchesByUserAndCompany(idUser, idCompany)),
        lastValueFrom(this.mxmService.getByType(idCompany, 'MOLIENDA')),
        lastValueFrom(this.materialsService.getMaterialsxview(idCompany)),
      ]);

      const list: any[] = (branchData as any)?.project ?? (Array.isArray(branchData) ? branchData : []);
      this.userBranches = list
        .map((b: any) => ({
          id:   b?.idPermission || b?.idBranch || b?.id,
          name: (b?.name || b?.description || b?.Name || '') as string,
        }))
        .filter(b => b.id && b.name.trim());

      const matsMap = new Map<number, string>();
      (Array.isArray(matsData) ? matsData : []).forEach((m: any) => matsMap.set(m.id, m.articulo));
      this.matPrimaOptions = (Array.isArray(mxmData) ? mxmData : [])
        .filter((m: any) => m.active !== false)
        .map((m: any) => ({ id: m.idArticulo, name: matsMap.get(m.idArticulo) ?? String(m.idArticulo) }))
        .filter(m => m.name);

      if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
      await this.loadData();
    } catch (e) {
      console.error('Error cargando datos iniciales:', e);
    }
  }

  async loadData() {
    try {
      const items = await lastValueFrom(this.productionService.getMoliendaByCompany(this.idCompany));
      const mapped = (Array.isArray(items) ? items : []).map(i => this.mapRow(i));
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = mapped;
      if (this.gridApi) this.gridApi.setGridOption('rowData', mapped);
    } catch (e) {
      console.error('Error cargando molienda:', e);
    }
  }

  private mapRow(i: any): any {
    return {
      id:            i.id,
      sucursal:      i.idSucursal    ?? null,
      matPrima:      i.idMatPrima    ?? null,
      fecha:         i.fecha ? String(i.fecha).substring(0, 10) : null,
      nombre:        i.nombre        ?? '',
      cantidadUso:   i.cantidad      ?? null,
      cuantoQueda:   i.cuantoQueda   ?? null,
      jugo:          i.jugo          ?? null,
      liberPorCompra: i.liberCompra  ?? null,
      adicional:     i.columna1      ?? '',
      __isNew:       false,
      __modified:    false,
    };
  }

  private toPayload(row: any) {
    return {
      idCompany:   this.idCompany,
      idSucursal:  row.sucursal      ?? null,
      idMatPrima:  row.matPrima      ?? null,
      fecha:       row.fecha         || null,
      nombre:      row.nombre        || null,
      cantidad:    row.cantidadUso   ?? null,
      cuantoQueda: row.cuantoQueda   ?? null,
      jugo:        row.jugo          ?? null,
      liberCompra: row.liberPorCompra ?? null,
      columna1:    row.adicional      || null,
      active:      true,
    };
  }

  addRow() {
    const currentBranch = this.userBranches.length === 1 ? this.userBranches[0].id : null;
    const today = new Date().toISOString().substring(0, 10);
    const userName = this.signalService.getDisplayName()() ?? '';
    const newRow = {
      id: null, __tempId: `new_${Date.now()}`, __isNew: true,
      sucursal: currentBranch, matPrima: null, fecha: today, nombre: userName,
      cantidadUso: 0, cuantoQueda: 0, jugo: 0,
      liberPorCompra: false, adicional: '',
    };
    this.rowData = [newRow, ...this.rowData];
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    this.hasChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'sucursal' }), 100);
  }

  async saveChanges() {
    const newRows = this.rowData.filter(r => r.__isNew);
    const modRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newRows.length && !modRows.length) return;
    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.productionService.createMolienda(this.toPayload(row)));
        row.id      = created.id;
        row.__isNew = false;
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMolienda(row.id, this.toPayload(row)));
        row.__modified = false;
      }
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges = false;
      alerts.basicAlert('Guardado', 'Cambios guardados correctamente', 'success');
    } catch (e) {
      console.error('Error guardando molienda:', e);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar', 'error');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteEntry() {
    if (!this.selectedRow) { alerts.basicAlert('Atención', 'Seleccione un registro', 'warning'); return; }
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      return;
    }
    const res = await alerts.confirmAlert('Eliminar', '¿Está seguro?', 'warning', 'Sí, eliminar');
    if (!res.isConfirmed) return;
    try {
      await lastValueFrom(this.productionService.deleteMolienda(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      alerts.basicAlert('Eliminado', 'Registro eliminado', 'success');
    } catch (e) {
      console.error('Error eliminando:', e);
      alerts.basicAlert('Error', 'Ocurrió un error al eliminar', 'error');
    }
  }
}
