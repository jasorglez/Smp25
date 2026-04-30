import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService } from '../../../../../services/molienda.service';
import { OcAndReqsService } from '../../../../../services/ocandreqs.service';
import { SelectWithTooltipEditorV2Component } from '../../../../../shared/select-with-tooltip-editor-v2.component';

interface ReqOption {
  id: number;
  folio: string;
  cantidadReq: number;
  numCantidadOc: number;
}

@Component({
  selector: 'app-detalle-almmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;"
         [style.backgroundColor]="detailType === 'entradas' ? '#e8f5e9' : '#fce4ec'">

      <!-- Título -->
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">{{ detailType === 'entradas' ? 'Entradas' : 'Salidas' }}</strong>
      </div>

      <!-- Grid nivel 2 (requisiciones) -->
      <div [style.flex]="selectedReqRow ? '0 0 70%' : '1 1 auto'"
           style="min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (rowClicked)="onRowClicked($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Cascade 3: OCs de la requisición seleccionada -->
      <div *ngIf="selectedReqRow"
           style="flex: 0 0 50%; min-height: 0; border-top: 2px solid #1565c0; background: #e3f2fd;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #1565c0; margin-bottom: 3px; flex-shrink: 0;">
          OC de {{ selectedReqRow.folio }}
        </div>
        <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="cascadeOcData"
            [columnDefs]="cascadeOcColDefs"
            [gridOptions]="cascadeOcGridOptions"
            (gridReady)="onCascadeOcGridReady($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>
      </div>

    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetalleMoliendaComponent {
  private moliendaService  = inject(MoliendaService);
  private ocAndReqsService = inject(OcAndReqsService);

  private internalParams: any;
  private gridApi!: GridApi;
  private cascadeOcGridApi!: GridApi;
  private deptsCsv: string = '';

  detailType: 'entradas' | 'salidas' = 'entradas';
  rowData: any[] = [];
  reqOptions: ReqOption[] = [];

  selectedReqRow: any = null;
  cascadeOcData: any[] = [];

  // ── Nivel 2: Requisiciones ────────────────────────────────────────
  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'folio',
      headerName: 'Folio / Req',
      width: 160,
      editable: false,
      cellRenderer: (params: any) => {
        const val = params.value ?? '';
        const div = document.createElement('div');
        div.style.cssText = val
          ? 'cursor:pointer;color:#1565c0;text-decoration:underline;'
          : 'color:#999;';
        div.textContent = val || '—';
        return div;
      },
      tooltipValueGetter: (p) => {
        const req = this.reqOptions.find(r => r.id === p.data?.idRequisition);
        if (!req) return null;
        return `Requisición: ${req.folio}\nCant. Req: ${req.cantidadReq}\n# OC: ${req.numCantidadOc}`;
      },
    },
    {
      field: 'cantidadReq',
      headerName: 'Cant Req',
      width: 120,
      editable: false,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#e3f2fd' },
      tooltipValueGetter: (p) => `Cantidad requisitada: ${p.value ?? 0}`,
    },
    {
      field: 'numCantidadOc',
      headerName: '# OC',
      width: 80,
      editable: false,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#fff9c4' },
      tooltipValueGetter: (p) => `Órdenes de compra: ${p.value ?? 0}`,
    },
    {
      headerName: 'Resta',
      width: 110,
      editable: false,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#fce4ec' },
      valueGetter: (p) => (p.data?.cantidadReq ?? 0) - (p.data?.cantidad ?? 0),
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'selected-row-highlight': (p: any) => p.data === this.selectedReqRow,
    },
    tooltipShowDelay: 300,
    defaultColDef: { resizable: true, sortable: true },
  };

  // ── Nivel 3: OCs ──────────────────────────────────────────────────
  cascadeOcColDefs: ColDef[] = [
    { field: 'folio',        headerName: 'OC',              width: 110 },
    { field: 'proveedor',    headerName: 'Proveedor',        flex: 2, minWidth: 140 },
    { field: 'cantidad',     headerName: 'Cantidad',         width: 110, type: 'numericColumn' },
    { field: 'condEspecial', headerName: 'Cond. Especial',   flex: 2, minWidth: 130 },
    { field: 'resta',        headerName: 'Resta',            width: 90, type: 'numericColumn',
      cellStyle: { backgroundColor: '#fff9c4' } },
  ];

  cascadeOcGridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true },
  };

  // ── Lifecycle ─────────────────────────────────────────────────────
  agInit(params: any) { this.init(params); }
  refresh(params: any): boolean { this.internalParams = params; return true; }

  private async init(params: any) {
    this.internalParams = params;
    this.detailType = params?.data?.detailType ?? 'entradas';

    // Usar departamentos del tooltip
    const departmentOptions = params?.departmentOptions ?? [];
    console.log('💠 init: params recibidos =', params);
    console.log('💠 init: departmentOptions =', departmentOptions);
    this.deptsCsv = departmentOptions
      .map((d: any) => d.id)
      .filter((id: any) => id)
      .join(',');
    console.log('💠 init: deptsCsv final =', this.deptsCsv);

    await this.loadReqOptions();
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  private async loadReqOptions() {
    const idBranch   = this.internalParams?.data?.sucursal;
    const idMaterial = this.internalParams?.data?.idMaterial;
    console.log('💠 loadReqOptions: idBranch =', idBranch, ', idMaterial =', idMaterial, ', deptsCsv =', this.deptsCsv);
    if (!idBranch || !idMaterial) { this.reqOptions = []; return; }
    try {
      this.reqOptions = await lastValueFrom(
        this.ocAndReqsService.getReqsByBranchMaterial(idBranch, idMaterial, this.deptsCsv)
      );
      console.log('💠 loadReqOptions: requisiciones cargadas =', this.reqOptions);
    } catch (err) {
      console.error('💠 loadReqOptions: error =', err);
      this.reqOptions = [];
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  onCascadeOcGridReady(params: GridReadyEvent) {
    this.cascadeOcGridApi = params.api;
    if (this.cascadeOcData.length)
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
  }

  async loadData() {
    const idMolienda = this.internalParams?.data?.id;
    if (!idMolienda || typeof idMolienda === 'string') {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }

    try {
      const type  = this.detailType === 'entradas' ? 'ENTRADA' : 'SALIDA';
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, type));
      this.rowData = (Array.isArray(items) ? items : []).map((d: any) => {
        const req = this.reqOptions.find(r => r.id === d.idRequisition);
        return {
          id:            d.id,
          idRequisition: d.idRequisition ?? null,
          folio:         req?.folio ?? '',
          cantidadReq:   d.cantidadReq   ?? 0,
          numCantidadOc: d.numCantidadOc ?? 0,
          cantidad:      d.cantidad ?? 0,
          idCatalog:     d.idCatalog ?? null,
        };
      });
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading details molienda:', error);
    }
  }

  async onRowClicked(event: any) {
    const row = event.data;
    console.log('💠 onRowClicked: row =', row, ', deptsCsv =', this.deptsCsv);
    if (!row?.idRequisition) { this.selectedReqRow = null; this.cascadeOcData = []; return; }

    if (this.selectedReqRow === row) {
      this.selectedReqRow = null;
      this.cascadeOcData  = [];
      if (this.gridApi) this.gridApi.refreshCells({ force: true });
      return;
    }

    this.selectedReqRow = row;
    const idMaterial = this.internalParams?.data?.idMaterial;
    console.log('💠 onRowClicked: cargando OCs con idReq =', row.idRequisition, ', idMaterial =', idMaterial, ', deptsCsv =', this.deptsCsv);
    try {
      this.cascadeOcData = await lastValueFrom(
        this.ocAndReqsService.getOcsByReqMaterial(row.idRequisition, idMaterial, this.deptsCsv)
      );
      console.log('💠 onRowClicked: OCs cargadas =', this.cascadeOcData);
    } catch (err) {
      console.error('💠 onRowClicked: error cargando OCs =', err);
      this.cascadeOcData = [];
    }

    if (this.cascadeOcGridApi) this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
  }

  private updateParentCount() {
    if (!this.internalParams?.node) return;
    const data = this.internalParams.node.data;
    const countField = this.detailType === 'entradas' ? 'entradas' : 'salidas';
    data[countField] = this.rowData.length;

    if (this.internalParams.api) {
      this.internalParams.api.refreshCells({
        rowNodes: [this.internalParams.node],
        columns: [countField],
        force: true,
      });
    }
  }
}
