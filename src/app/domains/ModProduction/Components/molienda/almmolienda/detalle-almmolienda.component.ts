import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService } from '../../../../../services/molienda.service';
import { OcAndReqsService } from '../../../../../services/ocandreqs.service';
import { CustomersService } from '../../../../../services/customers.service';

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
      <div [style.flex]="selectedReqRow ? '0 0 58px' : '1 1 auto'"
           style="min-height: 58px; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellClicked)="onCellClicked($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Cascade 3–4: OCs + entradas por OC -->
      <div *ngIf="selectedReqRow"
           style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #1565c0; background: #e3f2fd;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #1565c0; margin-bottom: 3px; flex-shrink: 0;">
          OC de {{ selectedReqRow.folio }}
        </div>

        <div [style.flex]="selectedOcRow ? '0 0 58px' : '1 1 auto'"
             style="min-height: 58px; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="cascadeOcData"
            [columnDefs]="cascadeOcColDefs"
            [gridOptions]="cascadeOcGridOptions"
            (gridReady)="onCascadeOcGridReady($event)"
            (cellClicked)="onCascadeOcCellClicked($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>

        <div *ngIf="selectedOcRow"
             style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #0d47a1; background: #eceff1;
                    padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
          <div style="font-size: 0.76rem; font-weight: bold; color: #0d47a1; margin-bottom: 3px; flex-shrink: 0;">
            Entradas — {{ selectedOcRow.folio }}
          </div>
          <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
            <ag-grid-angular
              class="ag-theme-quartz small-text-ag-grid"
              [rowData]="cascadeEntradaData"
              [columnDefs]="nivel4ColDefs"
              [gridOptions]="nivel4GridOptions"
              (gridReady)="onNivel4GridReady($event)"
              style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
            </ag-grid-angular>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    :host ::ng-deep .selected-oc-highlight { background-color: #bbdefb !important; }
  `]
})
export class DetalleMoliendaComponent {
  private moliendaService = inject(MoliendaService);
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);

  private internalParams: any;
  private gridApi!: GridApi;
  private cascadeOcGridApi!: GridApi;
  private nivel4GridApi!: GridApi;
  private deptsCsv: string = '';
  private initCompleted = false;
  private providersMap: Map<number, string> | null = null;

  detailType: 'entradas' | 'salidas' = 'entradas';
  rowData: any[] = [];
  reqOptions: ReqOption[] = [];

  selectedReqRow: any = null;
  cascadeOcData: any[] = [];
  selectedOcRow: any = null;
  cascadeEntradaData: any[] = [];

  // ── Nivel 2: Requisiciones ────────────────────────────────────────
  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { fontWeight: 'bold' },
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
          ? 'cursor:pointer;color:#2e7d32;text-decoration:underline;'
          : 'color:#999;';
        div.textContent = val || '—';
        return div;
      },
      cellStyle: { backgroundColor: '#e8f5e9' },
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
      tooltipValueGetter: (p) => `Cantidad requisitada: ${p.value ?? 0}`,
    },
    {
      field: 'numCantidadOc',
      headerName: '# OC',
      width: 80,
      editable: false,
      type: 'numericColumn',
      tooltipValueGetter: (p) => `Órdenes de compra: ${p.value ?? 0}`,
    },
    {
      headerName: 'Resta',
      width: 110,
      editable: false,
      type: 'numericColumn',
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
    {
      field: 'folio',
      headerName: 'OC',
      width: 110,
      editable: false,
      cellStyle: { color: '#2e7d32', backgroundColor: '#e8f5e9' },
      cellRenderer: (params: any) => {
        const val = params.value ?? '';
        const div = document.createElement('div');
        div.style.cssText = val
          ? 'cursor:pointer;color:#2e7d32;text-decoration:underline;'
          : 'color:#999;';
        div.textContent = val || '—';
        return div;
      },
    },
    { field: 'proveedor', headerName: 'Proveedor', flex: 2, minWidth: 140 },
    { field: 'cantidad', headerName: 'Cantidad', width: 110, type: 'numericColumn' },
    { field: 'precioXKilo', headerName: 'Precio x Kilo', width: 120, type: 'numericColumn' },
    { field: 'condEspecial', headerName: 'Cond. Especial', flex: 2, minWidth: 130 },
    {
      field: 'resta', headerName: 'Resta', width: 90, type: 'numericColumn',
      cellStyle: { backgroundColor: '#fff9c4' }
    },
  ];

  cascadeOcGridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'selected-oc-highlight': (p: any) => p.data === this.selectedOcRow,
    },
    defaultColDef: { resizable: true, sortable: true },
    tooltipShowDelay: 300,
  };

  // ── Nivel 4: Entradas por OC (demo local; sustituir por API cuando exista) ──
  nivel4ColDefs: ColDef[] = [
    { field: 'idEntrada', headerName: 'ID Entrada', width: 95, type: 'numericColumn' },
    {
      field: 'fechaRecepcion',
      headerName: 'Fecha recepción',
      width: 120,
      valueFormatter: (p) => this.fmtFecha(p.value),
    },
    {
      field: 'cantidadEntrada',
      headerName: 'Cantidad Entrada',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => this.fmtEntero(p.value),
    },
    { field: 'bultos', headerName: 'Bultos', width: 85, type: 'numericColumn' },
    {
      field: 'revisionConfigu',
      headerName: 'Revisión Configu.',
      width: 125,
      type: 'numericColumn',
    },
    {
      field: 'carat',
      headerName: 'Carat. ▾',
      width: 100,
      sortable: false,
      cellRenderer: (params: any) => {
        const span = document.createElement('span');
        span.style.cssText =
          'color:#1565c0;cursor:pointer;text-decoration:underline;font-weight:500;';
        span.textContent = 'Click';
        span.addEventListener('click', (ev) => {
          ev.stopPropagation();
          /* TODO: abrir características */
        });
        return span;
      },
    },
    {
      field: 'pago',
      headerName: 'Pago',
      width: 110,
      type: 'numericColumn',
      valueFormatter: (p) => this.fmtMoneda(p.value),
    },
    {
      field: 'pdfCount',
      headerName: '📤 PDF',
      width: 85,
      type: 'numericColumn',
      valueFormatter: (p) => `(${p.value ?? 0})`,
    },
    { field: 'usuario', headerName: 'Usuario', width: 100 },
    {
      field: 'liberacion',
      headerName: 'Liberación',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  nivel4GridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true },
    tooltipShowDelay: 300,
  };

  // ── Lifecycle ─────────────────────────────────────────────────────
  async agInit(params: any) { await this.init(params); }
  refresh(params: any): boolean { this.internalParams = params; return true; }

  private async init(params: any) {
    this.initCompleted = false;
    this.internalParams = params;
    this.detailType = params?.data?.detailType ?? 'entradas';

    const departmentOptions = params?.departmentOptions ?? [];
    this.deptsCsv = departmentOptions
      .map((d: any) => d.id)
      .filter((id: any) => id)
      .join(',');

    // Si el padre ya sincronizó y pasó los datos, úsalos directamente sin HTTP
    const preloadedReqs = params?.preloadedReqs as any[] | undefined;
    const preloadedDetails = params?.preloadedDetails as any[] | undefined;

    if (preloadedReqs?.length && preloadedDetails !== undefined) {
      this.reqOptions = preloadedReqs;
      this.rowData = preloadedDetails.map((d: any) => {
        const req = this.reqOptions.find((r: any) => r.id === d.idRequisition);
        return {
          id: d.id,
          idRequisition: d.idRequisition ?? null,
          folio: req?.folio ?? '',
          cantidadReq: d.cantidadReq ?? 0,
          numCantidadOc: d.numCantidadOc ?? 0,
          cantidad: d.cantidad ?? 0,
          idCatalog: d.idCatalog ?? null,
        };
      });
      this.initCompleted = true;
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      }
      return;
    }

    // Flujo normal (salidas o sin precarga)
    await this.loadReqOptions();
    this.initCompleted = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  private async loadReqOptions() {
    const idBranch = this.internalParams?.data?.sucursal;
    const idMaterial = this.internalParams?.data?.idMaterial;
    if (!idBranch || !idMaterial) { this.reqOptions = []; return; }
    try {
      this.reqOptions = await lastValueFrom(
        this.ocAndReqsService.getReqsByBranchMaterial(idBranch, idMaterial, this.deptsCsv)
      );
    } catch (err) {
      console.error('Error cargando requisiciones:', err);
      this.reqOptions = [];
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.initCompleted) {
      if (this.rowData.length) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      } else {
        this.loadData();
      }
    }
  }

  onCascadeOcGridReady(params: GridReadyEvent) {
    this.cascadeOcGridApi = params.api;
    if (this.cascadeOcData.length)
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
  }

  onNivel4GridReady(params: GridReadyEvent) {
    this.nivel4GridApi = params.api;
    if (this.cascadeEntradaData.length)
      this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
  }

  /** Click en columna OC: comprime otras filas y muestra nivel 4 (entradas). */
  onCascadeOcCellClicked(event: any): void {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.folio) {
      this.clearOcSelection();
      return;
    }

    if (this.selectedOcRow === row) {
      this.clearOcSelection();
      return;
    }

    this.selectedOcRow = row;
    this.cascadeEntradaData = this.buildMockEntradasForOc(row);

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.forEachNode((node: any) => {
        if (node.data === row) node.setRowHeight(undefined);
        else node.setRowHeight(0);
      });
      this.cascadeOcGridApi.onRowHeightChanged();
      this.cascadeOcGridApi.refreshCells({ force: true });
    }

    if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed())
      this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
  }

  private clearOcSelection(): void {
    this.selectedOcRow = null;
    this.cascadeEntradaData = [];
    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.forEachNode((node: any) => node.setRowHeight(undefined));
      this.cascadeOcGridApi.onRowHeightChanged();
      this.cascadeOcGridApi.refreshCells({ force: true });
    }
  }

  /** Datos demo nivel 4 — reemplazar por GET entradas por OC cuando exista backend. */
  private buildMockEntradasForOc(oc: any): any[] {
    const seed = String(oc?.folio ?? oc?.id ?? 'x');
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

    const usuarios = ['Pedro', 'Juan', 'María'];
    const base = [
      { dias: 0, cant: 10000, bultos: 120, rev: 12, pago: 15000, u: 0, lib: true },
      { dias: 2, cant: 5000, bultos: 60, rev: 6, pago: 7500, u: 1, lib: true },
      { dias: 3, cant: 1000, bultos: 12, rev: 2, pago: 1500, u: 0, lib: false },
    ];

    const y = 2026;
    const m = 4;
    return base.map((b, idx) => {
      const day = 1 + ((h + idx * 7) % 28);
      const idEntrada = ((h >>> 0) % 9000) + idx + 1;
      return {
        idEntrada,
        fechaRecepcion: new Date(y, m, Math.min(day, 28)),
        cantidadEntrada: b.cant,
        bultos: b.bultos,
        revisionConfigu: b.rev,
        carat: true,
        pago: b.pago,
        pdfCount: 1,
        usuario: usuarios[b.u % usuarios.length],
        liberacion: b.lib,
      };
    });
  }

  private fmtFecha(v: any): string {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: '2-digit', year: '2-digit' });
  }

  private fmtEntero(v: any): string {
    if (v == null || v === '') return '';
    return Number(v).toLocaleString('es-MX');
  }

  private fmtMoneda(v: any): string {
    if (v == null || v === '') return '';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(v));
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
      const type = this.detailType === 'entradas' ? 'ENTRADA' : 'SALIDA';
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, type));
      this.rowData = (Array.isArray(items) ? items : []).map((d: any) => {
        const req = this.reqOptions.find(r => r.id === d.idRequisition);
        return {
          id: d.id,
          idRequisition: d.idRequisition ?? null,
          folio: req?.folio ?? '',
          cantidadReq: d.cantidadReq ?? 0,
          numCantidadOc: req?.numCantidadOc ?? 0,
          cantidad: d.cantidad ?? 0,
          idCatalog: d.idCatalog ?? null,
        };
      });
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading details molienda:', error);
    }
  }

  async onCellClicked(event: any) {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.idRequisition) {
      this.selectedReqRow = null;
      this.cascadeOcData = [];
      this.clearOcSelection();
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
      }
      return;
    }

    if (this.selectedReqRow === row) {
      this.selectedReqRow = null;
      this.cascadeOcData = [];
      this.clearOcSelection();
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
        this.gridApi.refreshCells({ force: true });
      }
      return;
    }

    this.clearOcSelection();
    this.selectedReqRow = row;

    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data === row) {
          node.setRowHeight(undefined);
        } else {
          node.setRowHeight(0);
        }
      });
      this.gridApi.onRowHeightChanged();
    }

    try {
      const { lastValueFrom } = await import('rxjs');

      // Obtenemos todas las OCs de la requisición seleccionada con detalles y nombres de proveedores
      const matchedOcs: any = await lastValueFrom(
        this.ocAndReqsService.getOcsDetailsForRequisition(row.idRequisition)
      ).catch(() => []);

      this.cascadeOcData = Array.isArray(matchedOcs) ? matchedOcs : [];
    } catch (err) {
      console.error('Error cargando OCs:', err);
      this.cascadeOcData = [];
    }

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed())
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
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
