import { Component, inject, effect, ChangeDetectorRef} from '@angular/core';
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
import { MoliendaService } from 'app/services/molienda.service';
import { InventarioMpService } from 'app/services/inventario-mp.service';
import { DetallesEntradasMoliendaComponent } from './detalles-entradasmolienda.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { DetailRouterFiltradoComponent } from './detail-router-filtrado.component';
import { SalidaLotesModalComponent } from './salida-lotes-modal.component';

@Component({
  selector: 'app-molienda-filtrado',
  standalone: true,
  imports: [CommonModule, AgGridAngular, DetallesEntradasMoliendaComponent, SelectWithTooltipEditorV2Component, DetailRouterFiltradoComponent, SalidaLotesModalComponent],
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

    <!-- Modal: gastar materia prima por lote (FEFO) -->
    <app-salida-lotes-modal *ngIf="salidaModal"
      [articuloOptions]="salidaModal.articuloOptions"
      [idSucursal]="salidaModal.idSucursal"
      [idDepartamento]="EXTRACCION_FERMENTACION_DEPT_ID"
      [idArticuloActual]="salidaModal.idArticuloActual"
      [salidasPrevias]="salidaModal.salidasPrevias"
      (resolve)="onSalidaResolve($event)"
      (cancel)="salidaModal = null">
    </app-salida-lotes-modal>
  `,
})
export class MoliendaComponent {
  readonly EXTRACCION_FERMENTACION_DEPT_ID = 62;
  // Estado del modal de salida por lote (lo dispara el Nivel 3 vía context).
  salidaModal: { articuloOptions: any[]; idSucursal: number; idArticuloActual: number | null; salidasPrevias: { [idDatoExterno: number]: number }; onResolve: (r: any) => void } | null = null;
  private signalService = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private branchsService = inject(BranchsService);
  private productionService = inject(ProductionService);
  private mxmService = inject(MaterialXModuloService);
  private materialsService = inject(MaterialsService);
  private moliendaService = inject(MoliendaService);
  private inventarioMpService = inject(InventarioMpService);

  // idSucursal → (idMaterial → cantidad total)
  private inventarioPorSucursal = new Map<number, Map<number, number>>();

  gridApi!: GridApi;
  rowData: any[] = [];
  private originalRowData: any[] = [];
  hasChanges = false;
  selectedRow: any = null;
  gridHeight = '80vh';

  userBranches: { id: number; name: string }[] = [];
  matPrimaOptions: { id: number; name: string }[] = [];
  allActiveArticuloOptions: { id: number; name: string }[] = [];

  private idCompany = 0;
  private idBranch = 0;
  private activeMatPrimaFilter: number | null = null;
  private activeExpandedNodeId: string | null = null;
  private activeDetailType: 'inventario' | 'matprima' | 'bote' | 'parametros' | null = null;

  colDefs: ColDef[] = [
    { field: 'active', headerName: 'Activo', width: 80, editable: true, cellRenderer: 'agCheckboxCellRenderer', valueSetter: (p: any) => { p.data.active = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; } }, {
      field: 'sucursal',
      headerName: 'Sucursal',
      editable: (params: any) => !!params.data.__isNew || !params.data.hasMatDetail,
      cellStyle: (params: any) => (!params.data.__isNew && params.data.hasMatDetail) ? { backgroundColor: '#f0f0f0', color: '#6c757d' } : {},
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({
        values: this.userBranches.map(b => b.id),
        valueListMaxHeight: 220,
        formatValue: (val: any) => this.userBranches.find(b => b.id === val)?.name ?? String(val ?? ''),
      }),
      valueFormatter: (p: any) => this.userBranches.find(b => b.id === p.value)?.name ?? '',
      valueSetter: (p: any) => { p.data.sucursal = Number(p.newValue); p.data.__modified = true; this.hasChanges = true; return true; },
    },
    {
      field: 'matPrima',
      headerName: 'Mat Prima',
      editable: (params: any) => params.data.__isNew || !params.data.hasMatDetail,
      cellEditor: 'selectV2',
      cellEditorParams: (params: any) => {
        const currentSucursal = params.data?.sucursal;
        const usedMatPrimas = new Set(
          this.rowData
            .filter(row => row !== params.data && row.sucursal === currentSucursal && row.matPrima != null)
            .map(row => row.matPrima)
        );
        return {
          options: this.matPrimaOptions
            .filter(m => !usedMatPrimas.has(m.id))
            .map(m => ({ id: m.id, description: m.name })),
        };
      },
      cellStyle: (params: any) => (!params.data.__isNew && params.data.hasMatDetail)
        ? { backgroundColor: '#f0f0f0', color: '#6c757d' }
        : {},
      valueFormatter: (p: any) => this.matPrimaOptions.find(m => m.id === p.value)?.name ?? '',
      valueSetter: (p: any) => { p.data.matPrima = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; },
      headerClass: 'no-right-separator',
    },
    {
      field: 'itemsIcon',
      headerName: '',
      width: 40,
      editable: false,
      sortable: false,
      suppressHeaderMenuButton: true,
      cellStyle: { textAlign: 'center', padding: '0', cursor: 'pointer' },
      cellRenderer: () => `<i class="bi bi-list" style="font-size:1rem;color:#5c6bc0;"></i>`,
      onCellClicked: (event: any) => {
        if (!event.data?.__isNew && event.data?.id != null) this.toggleMatPrimaDetail(event.node);
      },
    },
    {
      field: 'fecha', hide: true, headerName: 'Fecha', editable: false,
      cellStyle: { backgroundColor: '#f8f9fa' },
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    { field: 'nombre', hide: true, headerName: 'Nombre', editable: false, cellStyle: { backgroundColor: '#f8f9fa' } },
    {
      field: 'cantidadUso',
      headerName: 'Inventario',
      hide: true,
      editable: false,
      cellStyle: (params: any) => {
        const hasAlm = params.data?.idAlm != null;
        return {
          backgroundColor: '#e8f5e9',
          cursor: hasAlm ? 'pointer' : 'default',
          color: hasAlm ? '#2e7d32' : '#999',
          textDecoration: hasAlm ? 'underline' : 'none',
        };
      },
      valueFormatter: (params: any) => params.value != null ? String(Math.trunc(Number(params.value))) : '—',
      onCellClicked: (event: any) => {
        if (event.data?.idAlm != null) {
          this.toggleCascade(event.node);
        }
      },
    },
    { field: 'cuantoQueda', hide: true, headerName: 'Cuanto queda', editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'jugo', hide: true, headerName: 'Jugo', editable: true, cellEditor: 'agNumberCellEditor' },
    { field: 'liberPorCompra', hide: true, headerName: 'Liber. x Compra', editable: true, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor' },
    { field: 'adicional', hide: true, headerName: 'Adicional', editable: true },
    { field: 'ohJugos', headerName: 'OH Jugos', hide: true, editable: true, cellEditor: 'agNumberCellEditor', valueSetter: (p: any) => { p.data.ohJugos = p.newValue; p.data.__modified = true; this.hasChanges = true; return true; } },
    {
      field: 'bote',
      headerName: 'Asignar bote',
      editable: false,
      cellStyle: (p: any) => p.data?.__isNew ? {} : { cursor: 'pointer', backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: '600' },
      cellRenderer: (p: any) => p.data?.__isNew ? '' : 'Botes',
      onCellClicked: (event: any) => {
        if (!event.data?.__isNew && event.data?.id != null) this.toggleBoteDetail(event.node);
      },
    },
    {
      field: 'parametros',
      headerName: 'Asignar parámetros',
      editable: false,
      cellStyle: (p: any) => p.data?.__isNew ? {} : { cursor: 'pointer', backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: '600' },
      cellRenderer: (p: any) => p.data?.__isNew ? '' : 'Parámetros',
      onCellClicked: (event: any) => {
        if (!event.data?.__isNew && event.data?.id != null) this.toggleParametrosDetail(event.node);
      },
    },
  ];

  gridOptions: any = {
    components: { selectV2: SelectWithTooltipEditorV2Component },
    getRowId: (params: any) => String(params.data.id ?? params.data.__tempId),
    headerHeight: 25,
    rowHeight: 20,
    suppressRowClickSelection: false,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'inactive-row': (p: any) => p.data?.active === false && !p.data?.__isNew,
    },
    autoSizeStrategy: { type: 'fitCellContents' },
    masterDetail: true,
    detailRowHeight: Math.max(200, window.innerHeight * 0.8 - 25 - 20),
    isRowMaster: (data: any) => data?.id != null,
    detailCellRenderer: DetailRouterFiltradoComponent,
    detailCellRendererParams: (params: any) => ({
      context: {
        onMatDetailChanged: (idMolienda: number, hasDetail: boolean) =>
          this.onMatDetailChanged(idMolienda, hasDetail),
        articuloOptions: this.getArticulosParaSucursal(params?.data?.sucursal),
        allArticuloOptions: this.allActiveArticuloOptions,
        allMoliendaRows: this.rowData,
        matPrimaOptions: this.matPrimaOptions,
        userBranches: this.userBranches,
        // Para el modal de salida por lote (Nivel 3):
        idSucursal: params?.data?.sucursal ?? null,
        openSalidaModal: (p: any) => this.openSalidaModal(p),
      },
    }),
    isExternalFilterPresent: () => this.activeMatPrimaFilter != null,
    doesExternalFilterPass: (node: any) => node.data?.matPrima === this.activeMatPrimaFilter,
    onRowSelected: (e: any) => {
      if (e.node.isSelected()) this.selectedRow = e.data;
    },
  };

  constructor() {
    effect(() => {
      const idUser = this.signalService.idUser();
      const idCompany = this.signalService.getRootSelectedBySidebar()();
      if (idUser && idCompany) {
        this.idCompany = idCompany;
        this.loadBranches(idUser, idCompany);
      }
    });

    effect(() => {
      const idBranch = this.signalService.getBranchSelectedBySidebar()();
      if (idBranch !== undefined && idBranch !== null && idBranch !== this.idBranch) {
        this.idBranch = idBranch;
        if (this.idCompany) this.loadData();
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

  // Abre el modal de salida por lote (llamado desde Nivel 3 vía context).
  openSalidaModal(payload: { articuloOptions: any[]; idSucursal: number; idArticuloActual: number | null; salidasPrevias?: { [idDatoExterno: number]: number }; onResolve: (r: any) => void }) {
    this.salidaModal = { ...payload, salidasPrevias: payload.salidasPrevias ?? {} };
  }

  onSalidaResolve(res: { idArticulo: number; cantidad: number; lotes: { idDatoExterno: number; cantidad: number }[] }) {
    const cb = this.salidaModal?.onResolve;
    this.salidaModal = null;
    cb?.(res);
  }

  private getArticulosParaSucursal(idSucursal: number | null): { id: number; name: string; cantidad?: number }[] {
    if (!idSucursal) return this.allActiveArticuloOptions;
    const disponibles = this.inventarioPorSucursal.get(idSucursal);
    if (!disponibles) return [];
    return this.allActiveArticuloOptions
      .filter(o => disponibles.has(o.id))
      .map(o => ({ ...o, cantidad: disponibles.get(o.id) }));
  }

  private async loadBranches(idUser: number, idCompany: number) {
    const currentBranch = this.signalService.getBranchSelectedBySidebar()();
    if (currentBranch) this.idBranch = currentBranch;
    try {
      const [branchData, mxmData, matsData, invData] = await Promise.all([
        lastValueFrom(this.branchsService.getBranchesByUserAndCompany(idUser, idCompany)),
        lastValueFrom(this.mxmService.getByType(idCompany, 'MOLIENDA')),
        lastValueFrom(this.materialsService.getMaterialsxview(idCompany)),
        lastValueFrom(this.inventarioMpService.getGerencial(idCompany)),
      ]);

      const list: any[] = (branchData as any)?.project ?? (Array.isArray(branchData) ? branchData : []);
      this.userBranches = list
        .map((b: any) => ({
          id: b?.idPermission || b?.idBranch || b?.id,
          name: (b?.name || b?.description || b?.Name || '') as string,
        }))
        .filter(b => b.id && b.name.trim());

      const matsMap = new Map<number, string>();
      (Array.isArray(matsData) ? matsData : []).forEach((m: any) => matsMap.set(m.id, m.articulo));
      const mxmList = Array.isArray(mxmData) ? mxmData : [];
      const sortByName = (a: any, b: any) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      this.matPrimaOptions = mxmList
        .filter((m: any) => m.active !== false && m.molienda === true)
        .map((m: any) => ({ id: m.idArticulo, name: matsMap.get(m.idArticulo) ?? String(m.idArticulo) }))
        .filter(m => m.name)
        .sort(sortByName);
      this.allActiveArticuloOptions = mxmList
        .filter((m: any) => m.active !== false)
        .map((m: any) => ({ id: m.idArticulo, name: matsMap.get(m.idArticulo) ?? String(m.idArticulo) }))
        .filter(m => m.name)
        .sort(sortByName);

      // Construir mapa idSucursal → Set<idMaterial> con inventario > 0
      this.inventarioPorSucursal.clear();
      for (const fila of (invData?.filas ?? [])) {
        for (const [colId, cant] of Object.entries(fila.valores)) {
          const cantidad = cant as number;
          if (cantidad > 0) {
            const idSuc = Number(colId);
            if (!this.inventarioPorSucursal.has(idSuc))
              this.inventarioPorSucursal.set(idSuc, new Map());
            this.inventarioPorSucursal.get(idSuc)!.set(fila.idMaterial, cantidad);
          }
        }
      }

      await this.loadData();
    } catch (e) {
      console.error('Error cargando datos iniciales:', e);
    }
  
    this.cdr.detectChanges();}

  async loadData() {
    if (!this.idCompany) return;
    try {
      const allBranches = this.idBranch <= 0;
      const prodObs = allBranches
        ? this.productionService.getMoliendaByCompany(this.idCompany)
        : this.productionService.getMoliendaByCompanyAndSucursal(this.idCompany, this.idBranch);

      const [items, almItems, matDetailCounts] = await Promise.all([
        lastValueFrom(prodObs),
        lastValueFrom(this.moliendaService.getAll(this.idCompany)),
        lastValueFrom(this.productionService.getMoliendaMatDetalleCountsByCompany(this.idCompany)),
      ]);

      const almExact = new Map<string, any>();
      const almByMat = new Map<number, any>();
      (Array.isArray(almItems) ? almItems : []).forEach((a: any) => {
        almExact.set(`${a.idSucursal}_${a.idMaterial}`, a);
        if (!almByMat.has(a.idMaterial)) almByMat.set(a.idMaterial, a);
      });

      const mapped = (Array.isArray(items) ? items : []).map(i => this.mapRow(i, almExact, almByMat, matDetailCounts));
      this.sortRowData(mapped);
      this.originalRowData = JSON.parse(JSON.stringify(mapped));
      this.rowData = mapped;
      if (this.gridApi) this.gridApi.setGridOption('rowData', mapped);
    } catch (e) {
      console.error('Error cargando molienda:', e);
    }
  
    this.cdr.detectChanges();}

  private mapRow(i: any, almExact?: Map<string, any>, almByMat?: Map<number, any>, matDetailCounts?: Record<number, number>): any {
    const almRecord = almExact?.get(`${i.idSucursal}_${i.idMatPrima}`) ?? almByMat?.get(i.idMatPrima);
    return {
      id: i.id,
      sucursal: i.idSucursal ?? null,
      matPrima: i.idMatPrima ?? null,
      fecha: i.fecha ? String(i.fecha).substring(0, 10) : null,
      nombre: i.nombre ?? '',
      cantidadUso: almRecord?.totalInventarios ?? null,
      idAlm: almRecord?.id ?? null,
      cuantoQueda: i.cuantoQueda ?? null,
      jugo: i.jugo ?? null,
      liberPorCompra: !!i.liberCompra,
      adicional: i.columna1 ?? '',
      ohJugos: i.ohJugos ?? null,
      bote: i.bote ?? null,
      parametros: i.parametros ?? '',
      active: i.active ?? true,
      hasMatDetail: (matDetailCounts?.[i.id] ?? 0) > 0,
      __isNew: false,
      __modified: false,
    };
  }

  private sortRowData(data: any[]) {
    data.sort((a, b) => {
      const aActive = a.active !== false ? 1 : 0;
      const bActive = b.active !== false ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;

      const aSuc = this.userBranches.find(br => br.id === a.sucursal)?.name ?? '';
      const bSuc = this.userBranches.find(br => br.id === b.sucursal)?.name ?? '';
      const sucCmp = aSuc.localeCompare(bSuc, 'es', { sensitivity: 'base' });
      if (sucCmp !== 0) return sucCmp;

      const aMat = this.matPrimaOptions.find(m => m.id === a.matPrima)?.name ?? '';
      const bMat = this.matPrimaOptions.find(m => m.id === b.matPrima)?.name ?? '';
      return aMat.localeCompare(bMat, 'es', { sensitivity: 'base' });
    });
  }

  private toPayload(row: any) {
    return {
      idCompany: this.idCompany,
      idSucursal: row.sucursal ?? null,
      idMatPrima: row.matPrima ?? null,
      fecha: row.fecha || null,
      nombre: row.nombre || null,
      cuantoQueda: row.cuantoQueda ?? null,
      jugo: row.jugo ?? null,
      liberCompra: row.liberPorCompra ?? false,
      columna1: row.adicional || null,
      ohJugos: row.ohJugos ?? null,
      bote: row.bote || null,
      parametros: row.parametros || null,
      active: row.active ?? true,
    };
  }

  toggleCascade(node: any) {
    if (!node.data?.idAlm) return;

    if (this.activeExpandedNodeId === node.id && this.activeDetailType === 'inventario') {
      node.setExpanded(false);
      node.data.__detailType = null;
      this.activeExpandedNodeId = null;
      this.activeDetailType = null;
      this.activeMatPrimaFilter = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      this.gridApi.onFilterChanged();
      return;
    }

    this.collapseActive();
    this.gridApi.forEachNode((n: any) => {
      if (n.id !== node.id) n.setRowHeight(0);
    });
    this.activeMatPrimaFilter = node.data.matPrima;
    node.data.__detailType = 'inventario';
    this.activeExpandedNodeId = node.id;
    this.activeDetailType = 'inventario';
    this.gridApi.onRowHeightChanged();
    this.gridApi.onFilterChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  toggleBoteDetail(node: any) {
    if (this.activeExpandedNodeId === node.id && this.activeDetailType === 'bote') {
      node.setExpanded(false);
      node.data.__detailType = null;
      this.activeExpandedNodeId = null;
      this.activeDetailType = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }
    this.collapseActive();
    this.gridApi.forEachNode((n: any) => { if (n.id !== node.id) n.setRowHeight(0); });
    node.data.__detailType = 'bote';
    this.activeExpandedNodeId = node.id;
    this.activeDetailType = 'bote';
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  toggleParametrosDetail(node: any) {
    if (this.activeExpandedNodeId === node.id && this.activeDetailType === 'parametros') {
      node.setExpanded(false);
      node.data.__detailType = null;
      this.activeExpandedNodeId = null;
      this.activeDetailType = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }
    this.collapseActive();
    this.gridApi.forEachNode((n: any) => { if (n.id !== node.id) n.setRowHeight(0); });
    node.data.__detailType = 'parametros';
    this.activeExpandedNodeId = node.id;
    this.activeDetailType = 'parametros';
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  toggleMatPrimaDetail(node: any) {
    if (this.activeExpandedNodeId === node.id && this.activeDetailType === 'matprima') {
      node.setExpanded(false);
      node.data.__detailType = null;
      this.activeExpandedNodeId = null;
      this.activeDetailType = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }

    this.collapseActive();
    this.gridApi.forEachNode((n: any) => {
      if (n.id !== node.id) n.setRowHeight(0);
    });
    node.data.__detailType = 'matprima';
    this.activeExpandedNodeId = node.id;
    this.activeDetailType = 'matprima';
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  private collapseActive() {
    if (!this.activeExpandedNodeId) return;
    const prevId = this.activeExpandedNodeId;
    this.gridApi?.forEachNode((n: any) => {
      if (n.id === prevId) {
        n.data.__detailType = null;
        n.setExpanded(false);
      }
      n.setRowHeight(undefined);
    });
    this.activeMatPrimaFilter = null;
    this.activeExpandedNodeId = null;
    this.activeDetailType = null;
    this.gridApi?.onRowHeightChanged();
    this.gridApi?.onFilterChanged();
  }

  onMatDetailChanged(idMolienda: number, hasDetail: boolean) {
    const node = this.gridApi?.getRowNode(String(idMolienda));
    if (node) {
      node.data.hasMatDetail = hasDetail;
      this.gridApi.refreshCells({ rowNodes: [node], columns: ['matPrima'], force: true });
    }
  }

  addRow() {
    const currentBranch = this.userBranches.length === 1 ? this.userBranches[0].id : null;
    const today = new Date().toISOString().substring(0, 10);
    const userName = this.signalService.getDisplayName()() ?? '';
    const newRow = {
      id: null, __tempId: `new_${Date.now()}`, __isNew: true,
      sucursal: currentBranch, matPrima: null, fecha: today, nombre: userName,
      cantidadUso: null, idAlm: null,
      cuantoQueda: 0, jugo: 0,
      liberPorCompra: false, adicional: '',
      ohJugos: null, bote: null, parametros: '', active: true,
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
        row.id = created.id;
        row.__isNew = false;
      }
      for (const row of modRows) {
        await lastValueFrom(this.productionService.updateMolienda(row.id, this.toPayload(row)));
        row.__modified = false;
      }
      this.sortRowData(this.rowData);
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasChanges = false;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    } catch (e) {
      console.error('Error guardando molienda:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  
    this.cdr.detectChanges();}

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.sortRowData(this.rowData);
    this.hasChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteEntry() {
    if (!this.selectedRow) { alerts.basicAlert('Atención', 'Seleccione un registro', 'warning'); return; }

    if (this.selectedRow.__isNew) {
      const node = this.gridApi?.getRowNode(String(this.selectedRow.__tempId));
      if (node && this.activeExpandedNodeId === node.id) this.collapseActive();
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      return;
    }

    if (this.selectedRow.hasMatDetail) {
      const deactivate = await alerts.userConfirmDelete(
        '¿Desactivar registro?',
        'Este registro tiene datos en el detalle. Se pasará a inactivo en lugar de eliminarse.',
        'Sí, desactivar'
      );
      if (!deactivate.isConfirmed) return;
      try {
        const row = this.selectedRow;
        await lastValueFrom(this.productionService.updateMolienda(row.id, { ...this.toPayload(row), active: false }));
        row.active = false;
        row.__modified = false;
        const orig = this.originalRowData.find(r => r.id === row.id);
        if (orig) orig.active = false;
        this.sortRowData(this.rowData);
        this.selectedRow = null;
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.redrawRows();
        }
        alerts.reqSuccessToast('Registro desactivado');
      } catch (e) {
        console.error('Error desactivando:', e);
        alerts.reqErrorToast('Error al desactivar');
      }
      return;
    }

    const confirmed = await alerts.userConfirmDelete('¿Eliminar registro?', 'Esta acción no se puede deshacer.');
    if (!confirmed.isConfirmed) return;

    try {
      const rowToDelete = this.selectedRow;
      const nodeId = String(rowToDelete.id);
      if (this.activeExpandedNodeId === this.gridApi?.getRowNode(nodeId)?.id) this.collapseActive();

      await lastValueFrom(this.productionService.deleteMolienda(rowToDelete.id));
      this.rowData = this.rowData.filter(r => r !== rowToDelete);
      this.originalRowData = this.originalRowData.filter(r => r.id !== rowToDelete.id);
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      alerts.reqSuccessToast('Registro eliminado');
    } catch (e) {
      console.error('Error eliminando:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  
    this.cdr.detectChanges();}
}
