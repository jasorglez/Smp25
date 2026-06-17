import { Component, OnInit, OnDestroy, inject, effect, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from '../purchaseorder/button-cell-renderer.component';
import { PdfButtonCellRendererPurchaseOrderComponent } from '../purchaseorder/pdf-button-cell-renderer-purchaseorder.component';
import { DetailCellRendererPurchaseOrderItemsComponent } from '../purchaseorder/detail-cell-renderer-purchase-order-items.component';
import { DetailCellRendererPurchaseOrderReportComponent } from '../purchaseorder/detail-cell-renderer-purchaseorder-report.component';
import { PedimentosXRequisicionComponent } from './pedimentos-x-requisicion.component';
import { CompraRapidaDetalleComponent } from './compra-rapida-detalle.component';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { AuthService } from 'app/services/auth.service';
import { ConditionsPendingService } from 'app/services/conditions-pending.service';
import { EntregasPendingService } from 'app/services/entregas-pending.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-purchaseorderdelison',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AgGridModule,
    ButtonCellRendererComponent,
    PdfButtonCellRendererPurchaseOrderComponent,
    DetailCellRendererPurchaseOrderItemsComponent,
    DetailCellRendererPurchaseOrderReportComponent,
    PedimentosXRequisicionComponent,
    CompraRapidaDetalleComponent
  ],
  templateUrl: './purchaseorderdelison.component.html',
  styleUrl: './purchaseorderdelison.component.scss',
  styles: [`
    :host ::ng-deep .expanded-oc {
      background-color: #e8f5e9 !important;
    }
  `]
})
export class PurchaseOrderDelisonComponent implements OnInit, OnDestroy {

  private signalsService          = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private ocAndReqsService        = inject(OcAndReqsService);
  private branchsService          = inject(BranchsService);
  private providersService        = inject(ProvidersService);
  private customersService        = inject(CustomersService);
  private materialsService        = inject(MaterialsService);
  public  authService             = inject(AuthService);
  private conditionsPendingService = inject(ConditionsPendingService);
  private entregasPendingService   = inject(EntregasPendingService);

  private pendingSub: Subscription;

  private gridApi!: GridApi;
  private isInitialized = false;
  private expandedRowId: string | null = null;

  activeTab: 'oc' | 'compraRapida' = 'oc';
  get hasNupnpn() { return this.signalsService.getHasNupnpnCompraRapida()(); }
  rowData: any[] | null = null;
  fullRowData: any[] = [];
  gridHeight         = '80vh';
  hasUnsavedChanges  = false;
  private columnState: any = null;

  idRoot: number   = null;
  idBranch: number = null;
  idUser: number   = null;

  branches: any[]   = [];
  proveedores: any[] = [];
  productos: any[] = [];
  branchesLoaded    = false;
  branchesMap: Map<number, string> = new Map();

  /** Contexto del grid maestro: AG Grid lo inyecta en params.context del detalle (ITEMS.load, proveedores…). */
  gridContext: Record<string, unknown> = {};

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    wrapHeaderText: true,
    autoHeaderHeight: true
  };

  constructor() {
    this.pendingSub = combineLatest([
      this.conditionsPendingService.hasPending$,
      this.entregasPendingService.hasPending$,
    ]).subscribe(([condiciones, entregas]) => (this.hasUnsavedChanges = condiciones || entregas));

    // Recalcular badge NUPNPN cuando el detalle guarda una clasificación.
    // Se omite el disparo inicial (trigger === 0) para no resetear a false antes de cargar datos.
    effect(() => {
      const trigger = this.signalsService.getNupnpnRecheckTrigger()();
      if (trigger === 0) return;
      const hasNupnpn = this.compraRapidaRowData.some(row =>
        (row.items || []).some((it: any) => String(it.numArticle || '').toUpperCase().startsWith('NUPNPN'))
      );
      this.signalsService.setHasNupnpnCompraRapida(hasNupnpn);
      // Refrescar columna reqFolio para actualizar el badge de nivel 1
      if (this.compraRapidaGridApi && !this.compraRapidaGridApi.isDestroyed()) {
        this.compraRapidaGridApi.refreshCells({ columns: ['reqFolio'], force: true });
      }
    });

    effect(() => {
      const newIdBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (newIdBranch !== undefined && newIdBranch !== null && newIdBranch !== this.idBranch) {
        this.idBranch = newIdBranch;
        if (this.branchesLoaded) {
          this.loadPurchaseOrders();
          if (this.activeTab === 'compraRapida') this.loadCompraRapida();
        }
      } else if (!newIdBranch && newIdBranch !== 0 && this.isInitialized) {
        this.idBranch = null;
        this.fullRowData = [];
        this.rowData = [];
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', []);
        }
        alerts.basicAlert(
          'Sucursal requerida',
          'Por favor, seleccione una sucursal en el sidebar para ver las órdenes de compra',
          'warning'
        );
      }
    });
  }

  ngOnInit() {
    const tryInit = (attempt = 0) => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();

      if (this.idRoot && this.idUser) {
        this.loadBranches();
        this.loadProviders();
        this.loadMaterials();
        this.isInitialized = true;
      } else if (attempt < 10) {
        // Auth o empresa aún no listos → reintentar con backoff suave
        setTimeout(() => tryInit(attempt + 1), 300);
      } else {
        this.isInitialized = true;
      }
    };
    setTimeout(() => tryInit(), 200);
  }

  // ==================== CARGA INICIAL ====================

  loadBranches() {
    this.branchsService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe({
      next: (data: any) => {
        this.branches = (data.project || []).map((row: any) => ({
          id: row.idPermission || row.idBranch || row.id,
          name: row.name || row.description || ''
        }));
        this.branchesMap.clear();
        this.branches.forEach(b => this.branchesMap.set(b.id, b.name));
        this.branchesLoaded = true;

        const current = this.signalsService.getBranchSelectedBySidebar()();
        if (current !== null && current !== undefined) {
          this.idBranch = current;
          this.loadPurchaseOrders();
          this.loadCompraRapida(); // carga en background para mostrar badge NUPNPN sin necesidad de ir al tab
        }
      },
      error: () => {
        this.branches = [];
        this.branchesLoaded = true;
      }
    });
  }

  loadProviders() {
    this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
      next: (data: any) => {
        this.proveedores = (Array.isArray(data) ? data : []).map((p: any) => ({
          id:   p.id,
          name: (p.name ?? '').trim() || (p.Description ?? p.description ?? '').trim() || `Proveedor ${p.id}`
        }));
        this.patchGridContext();
      },
      error: () => {}
    });
  }

  loadMaterials() {
    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data: any) => {
        this.productos = Array.isArray(data) ? data : [];
        this.patchGridContext();
      },
      error: () => {
        console.warn('Error cargando materiales', this.idRoot);
      }
    });
  }

  private patchGridContext(): void {
    this.gridContext['proveedores'] = this.proveedores;
    this.gridContext['productos'] = this.productos;
    this.gridApi?.setGridOption('context', this.gridContext);
  }

  private buildInitialGridContext(): void {
    this.gridContext = {
      componentParent: this
    };
  }

  getProviderName(idProvider: number): string {
    if (!idProvider) return '';
    const found = this.proveedores.find(p => p.id === idProvider);
    return found?.name || found?.description || `Prov. ${idProvider}`;
  }

  // ==================== CARGA OC ====================

  loadPurchaseOrders() {
    if (this.idBranch === null || this.idBranch === undefined) {
      this.fullRowData = [];
      this.rowData = [];
      if (this.gridApi) this.gridApi.setGridOption('rowData', []);
      return;
    }
    this.rowData = null;
    if (this.gridApi) this.gridApi.showLoadingOverlay();

    if (this.idBranch < 0) {
      this.loadFromAllBranches();
    } else {
      this.loadFromSingleBranch(this.idBranch);
    }
  }

  private mapOcRow(oc: any): any {
    const branchName = this.branchesMap.get(oc.idReference) || `Sucursal ${oc.idReference}`;

    return {
      id:           oc.reqId,
      sucursal:     branchName,
      folio:        '',
      ocCount:      oc.countPedimentos ?? 0,
      catalogo:     '',
      idReference:  oc.idReference,
      idCompany:    this.idRoot,
      active:       true,
      detailType:   null,
      idProvider:   null,
      idDepartament: oc.idDepartament ?? null,
      department:   oc.departmentName || 'Sin Departamento',
      reqFolio:     oc.reqFolio || '',
      dateModified: oc.dateModified || null,
      dateCreate:   oc.dateModified || null
    };
  }

  private mapRequisitionRow(req: any, branchName: string, ocCount: number): any {
    return {
      id:           req.id,
      sucursal:     branchName,
      folio:        req.folio || '',
      ocCount:      ocCount,
      catalogo:     '',
      idReference:  req.idReference || req.id_reference,
      idCompany:    this.idRoot,
      active:       req.active !== false,
      detailType:   null,
      dateModified: req.dateModified || null,
      dateCreate:   req.dateCreate || null
    };
  }

  private async loadFromAllBranches() {
    if (!this.branches || this.branches.length === 0) {
      this.fullRowData = [];
      this.rowData = [];
      if (this.gridApi) { this.gridApi.setGridOption('rowData', []); }
      return;
    }

    const branchPromises = this.branches.map(branch =>
      new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getOcsByBranch(branch.id).subscribe({
          next: (data: any) => resolve(Array.isArray(data) ? data : []),
          error: () => resolve([])
        });
      })
    );

    const branchResults = await Promise.all(branchPromises);
    const allOcs = branchResults.flat();

    const mapped = allOcs.map((oc: any) => this.mapOcRow(oc));

    this.fullRowData = mapped.sort((a, b) => {
      const dateA = new Date(a.dateModified || a.dateCreate || 0).getTime();
      const dateB = new Date(b.dateModified || b.dateCreate || 0).getTime();
      return dateB - dateA;
    });
    this.rowData = [...this.fullRowData];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.refreshCells({ force: true });
    }
  
    this.cdr.detectChanges();}

  private async loadFromSingleBranch(branchId: number) {
    try {
      const data: any = await lastValueFrom(this.ocAndReqsService.getOcsByBranch(branchId));
      const ocs = Array.isArray(data) ? data : [];

      const allMapped = ocs.map((oc: any) => this.mapOcRow(oc));
      this.fullRowData = allMapped.sort((a, b) => {
        const dateA = new Date(a.dateModified || a.dateCreate || 0).getTime();
        const dateB = new Date(b.dateModified || b.dateCreate || 0).getTime();
        return dateB - dateA;
      });

      this.rowData = [...this.fullRowData];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
    } catch {
      alerts.basicAlert('Error', 'No se pudieron cargar las órdenes de compra', 'error');
      this.fullRowData = [];
      this.rowData = [];
    }
  
    this.cdr.detectChanges();}

  private async getPedimentoCount(idRequisicion: number): Promise<number> {
    try {
      const pedimentos = await lastValueFrom(this.ocAndReqsService.getPedimentosByRequisicion(idRequisicion));
      return Array.isArray(pedimentos) ? pedimentos.length : 0;
    } catch {
      return 0;
    }
  
    this.cdr.detectChanges();}

  // ==================== GRID CONFIG ====================

  public gridOptions: any = {
    headerHeight: 56,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 1200,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) => {
      return { component: PedimentosXRequisicionComponent };
    },
    getRowClass: (params: any) => {
      if (params.node.isSelected())   return 'selected-row';
      if (params.data?.__isNew)       return 'new-row-highlight';
      if (params.data?.isExpanded)    return 'expanded-oc';
      return '';
    },
    onRowClicked: (event: any) => {
      const colId = event.column?.getColId();
      if (colId === 'countrow' || colId === 'pdf') return;
      event.node.setSelected(true);
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected() && event.api) {
        event.api.forEachNode((node: any) => {
          if (node.id !== event.node.id) node.setSelected(false);
        });
      }
    },
    onColumnResized: () => this.saveColumnState(),
    onColumnMoved: () => this.saveColumnState(),
    onColumnVisible: () => this.saveColumnState()
  };

  colMaster: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'sucursal',
      headerName: 'Sucursal',
      width: 180,
      filter: true,
      editable: false
    },
    {
      field: 'department',
      headerName: 'Departamento',
      width: 150,
      editable: false,
      cellStyle: { fontWeight: '500', textAlign: 'left' }
    },
    {
      field: 'reqFolio',
      headerName: '# Requisición',
      width: 160,
      filter: true,
      editable: false,
      cellStyle: { backgroundColor: '#c8e6c9', fontWeight: '400', cursor: 'pointer', textDecoration: 'underline' },
      onCellClicked: (event: any) => {
        const isExpanding = !event.node.expanded;
        if (isExpanding) {
          event.api.forEachNode((node: any) => {
            if (node.id !== event.node.id) {
              node.setExpanded(false);
              node.setRowHeight(0);
            }
          });
          event.api.onRowHeightChanged();
        } else {
          event.api.forEachNode((node: any) => {
            node.setRowHeight(undefined);
          });
          event.api.onRowHeightChanged();
        }
        event.node.setExpanded(isExpanding);
      }
    },
    {
      field: 'ocCount',
      headerName: '# Pedimentos',
      width: 160,
      filter: true,
      editable: false,
      valueFormatter: (p) => p.value || 0,
      cellStyle: { fontWeight: '500', textAlign: 'center' }
    }
  ];

  // ==================== COMPRA RAPIDA ====================

  compraRapidaRowData: any[] = [];
  private compraRapidaGridApi!: GridApi;

  // Nivel 1 (maestro): agrupado por # Requisición.
  compraRapidaColDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    { field: 'sucursal', headerName: 'Sucursal', width: 160, filter: true },
    {
      field: 'reqFolio',
      headerName: '# Requisición',
      width: 150,
      filter: true,
      cellRenderer: (params: any) => {
        const folio = params.value || '';
        const hasNupnpn = (params.data?.items || []).some(
          (it: any) => String(it.numArticle || '').toUpperCase().startsWith('NUPNPN')
        );
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; gap:6px;';
        div.innerHTML = `<span>${folio}</span>`;
        if (hasNupnpn) {
          const dot = document.createElement('span');
          dot.style.cssText = 'width:8px; height:8px; background:#d32f2f; border-radius:50%; flex-shrink:0; display:inline-block;';
          dot.title = 'Contiene artículos nuevos sin nomenclatura (NUPNPN)';
          div.appendChild(dot);
        }
        return div;
      }
    },
    {
      headerName: '# Compras Rapidas',
      width: 160,
      valueGetter: (p) => p.data?.items?.length ?? 0,
      cellStyle: { backgroundColor: '#c8e6c9', textAlign: 'center', fontWeight: '600', cursor: 'pointer' },
      onCellClicked: (params: any) => {
        const isExpanding = !params.node.expanded;
        // Acordeón: al expandir una fila, ocultar las demás (altura 0); al cerrar, restaurarlas.
        if (isExpanding) {
          params.api.forEachNode((node: any) => {
            if (node.id !== params.node.id) {
              node.setExpanded(false);
              node.setRowHeight(0);
            }
          });
          params.api.onRowHeightChanged();
        } else {
          params.api.forEachNode((node: any) => {
            node.setRowHeight(undefined);
          });
          params.api.onRowHeightChanged();
        }
        params.node.setExpanded(isExpanding);
      },
    },
  ];

  compraRapidaGridOptions: any = {
    headerHeight: 56,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    isRowMaster: (data: any) => Array.isArray(data?.items) && data.items.length > 0,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
    detailCellRendererSelector: () => ({ component: CompraRapidaDetalleComponent }),
    // Altura del detalle: título + header + filas + espacio para panel de clasificación NUPNPN.
    getRowHeight: (params: any) => {
      if (params.node?.detail) {
        const count = params.data?.items?.length ?? 0;
        return 30 + 25 + count * 28 + 500;
      }
      return undefined;
    },
    onColumnResized: () => this.saveCompraRapidaColumnState(),
    onColumnMoved: () => this.saveCompraRapidaColumnState(),
    onColumnVisible: () => this.saveCompraRapidaColumnState()
  };

  onCompraRapidaGridReady(params: GridReadyEvent) {
    this.compraRapidaGridApi = params.api;
    if (this.compraRapidaRowData.length) {
      this.compraRapidaGridApi.setGridOption('rowData', this.compraRapidaRowData);
    }
    setTimeout(() => this.loadCompraRapidaColumnStateFromStorage(), 50);
  }

  onTabChange(tab: 'oc' | 'compraRapida') {
    this.activeTab = tab;
    if (tab === 'compraRapida') {
      this.loadCompraRapida();
    }
  }

  async loadCompraRapida() {
    if (this.idBranch === null || this.idBranch === undefined) {
      this.setCompraRapidaRows([]);
      return;
    }

    let rawItems: any[] = [];
    if (this.idBranch < 0) {
      // "Todas las sucursales" → agregamos los items de cada sucursal del usuario en paralelo.
      if (!this.branches || this.branches.length === 0) { this.setCompraRapidaRows([]); return; }
      const results = await Promise.all(
        this.branches.map(branch =>
          new Promise<any[]>((resolve) => {
            this.ocAndReqsService.getCompraRapidaItems(branch.id).subscribe({
              next: (d: any) => resolve(Array.isArray(d) ? d : []),
              error: () => resolve([])
            });
          })
        )
      );
      rawItems = results.flat();
    } else {
      rawItems = await new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getCompraRapidaItems(this.idBranch).subscribe({
          next: (d: any) => resolve(Array.isArray(d) ? d : []),
          error: () => resolve([])
        });
      });
    }

    this.setCompraRapidaRows(rawItems);
  
    this.cdr.detectChanges();}

  private setCompraRapidaRows(list: any[]) {
    // Agrupar por requisición (# Requisición). Cada maestro lleva sus items en `items`.
    const byReq = new Map<number, any>();
    for (const it of (list || [])) {
      const key = it.reqId;
      if (!byReq.has(key)) {
        byReq.set(key, {
          reqId: it.reqId,
          reqFolio: it.reqFolio || '',
          sucursal: this.branchesMap.get(it.idReference) || `Sucursal ${it.idReference}`,
          items: [],
        });
      }
      byReq.get(key).items.push({
        folioCr: it.folioCr || '',
        department: it.departmentName || 'Sin Departamento',
        solicitedBy: it.solicitedBy || '',
        recurrent: it.recurrent || '',
        article: it.article || '',
        numArticle: it.numArticle || '',
        idSupplie: it.idSupplie || 0,
        // Proveedor capturado al pagar la CR en la Hoja de Gastos.
        proveedor: it.proveedor ?? it.nameProvider ?? it.provint ?? '',
        quantity: it.quantity || 0,
        caducidadMinimaRequerida: it.caducidadMinimaRequerida || '',
        comment: it.comment || '',
        // Para el tooltip de la columna Artículo (datos del pago de la CR):
        // price = precio en MXN (celda); precioUnitarioOriginal = precio en moneda original (tooltip).
        price: it.precioUnitarioMxn ?? it.precioUnitario ?? it.price ?? 0,
        precioUnitarioOriginal: it.precioUnitarioOriginal ?? it.precioUnitario ?? 0,
        total: it.totalPagado ?? it.total ?? 0,
        notaFactura: it.notaFactura || '',
        fechaEntradaAlmacen: it.fechaEntradaAlmacen || '',
        cantidadEntradaAlmacen: it.cantidadEntradaAlmacen ?? '',
        // Total CR: costo total en MXN (lleno solo al pagar la CR en Captura de Gastos).
        totalCr: it.totalCr ?? null,
        moneda: it.moneda || 'MXN',
        crId: it.crId ?? null,            // documento CR (para PDF compartido con almacén molienda)
      });
    }
    this.compraRapidaRowData = Array.from(byReq.values());

    // Detectar artículos NUPNPN y notificar al signal global para badges en sidebar/tabs
    const hasNupnpn = this.compraRapidaRowData.some(row =>
      (row.items || []).some((it: any) => String(it.numArticle || '').toUpperCase().startsWith('NUPNPN'))
    );
    this.signalsService.setHasNupnpnCompraRapida(hasNupnpn);

    if (this.compraRapidaGridApi && !this.compraRapidaGridApi.isDestroyed()) {
      this.compraRapidaGridApi.setGridOption('rowData', this.compraRapidaRowData);
      setTimeout(() => {
        if (this.compraRapidaGridApi && !this.compraRapidaGridApi.isDestroyed()) {
          this.compraRapidaGridApi.autoSizeAllColumns();
        }
      });
    }
  }

  // ==================== GRID EVENTS ====================

  onFirstDataRendered(params: any) {
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.autoSizeAllColumns();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.buildInitialGridContext();
    this.gridApi.setGridOption('context', this.gridContext);

    // Si rowData aún es null cuando el grid está listo, mostrar overlay de carga
    if (this.rowData === null) this.gridApi.showLoadingOverlay();

    this.gridApi.setGridOption('detailCellRendererParams', {
      // El detalle lo carga el cell renderer con ITEMS.load (no el sub-grid por defecto).
      getDetailRowData: (p: any) => {
        p.successCallback([]);
      }
    });

    // Cargar estado de columnas de localStorage una sola vez (con pequeño delay)
    setTimeout(() => this.loadColumnStateFromStorage(), 50);
  }

  private getColKey(suffix: string): string {
    const email = localStorage.getItem('mail') ?? 'guest';
    return `${suffix}_${email}`;
  }

  private saveColumnState() {
    if (this.gridApi) {
      this.columnState = this.gridApi.getColumnState();
      localStorage.setItem(this.getColKey('purchaseOrderMain'), JSON.stringify(this.columnState));
    }
  }

  private loadColumnStateFromStorage() {
    try {
      const stored = localStorage.getItem(this.getColKey('purchaseOrderMain'));
      if (stored && this.gridApi) {
        this.columnState = JSON.parse(stored);
        this.gridApi.applyColumnState({ state: this.columnState });
      }
    } catch (e) {
      console.warn('Error cargando estado de columnas:', e);
    }
  }

  private saveCompraRapidaColumnState() {
    if (this.compraRapidaGridApi && !this.compraRapidaGridApi.isDestroyed()) {
      const state = this.compraRapidaGridApi.getColumnState();
      localStorage.setItem(this.getColKey('purchaseOrderCompraRapida'), JSON.stringify(state));
    }
  }

  private loadCompraRapidaColumnStateFromStorage() {
    try {
      const stored = localStorage.getItem(this.getColKey('purchaseOrderCompraRapida'));
      if (stored && this.compraRapidaGridApi) {
        this.compraRapidaGridApi.applyColumnState({ state: JSON.parse(stored) });
      }
    } catch (e) {
      console.warn('Error cargando estado de columnas (compra rápida):', e);
    }
  }

  onSelectionChanged(_event: any) {}

  // ==================== UTILS ====================

  refreshData() {
    this.loadPurchaseOrders();
  }

  async saveConditions(): Promise<void> {
    // Validar antes de guardar: las fechas de entrega de cada ítem deben ser únicas.
    if (this.entregasPendingService.findItemWithDuplicateDates() != null) {
      alerts.reqErrorToast(
        'Fechas duplicadas',
        'Hay entregas con fechas iguales. Todas las fechas deben ser diferentes para guardar.'
      );
      return;
    }
    const pending = this.conditionsPendingService.getPending();

    try {
      if (pending.length) {
        await Promise.all(
          pending.map(async ({ item, condicionesPago }) => {
            // Eliminar campos sintéticos del frontend antes de enviar al backend
            const { conditions, ...cleanItem } = item;
            await lastValueFrom(
              this.ocAndReqsService.updateReqItem(
                String(item.id),
                { ...cleanItem, diasCondicionCompra: condicionesPago }
              )
            );
            // PATCH dedicado para datepostpone_confirmada: el PUT completo no
            // estaba persistiendo este flag, así que se fuerza por endpoint propio.
            if (item.datepostponeConfirmada === true) {
              await lastValueFrom(
                this.ocAndReqsService.patchDatePostponeConfirmada(Number(item.id), true)
              );
            }
          })
        );
        this.conditionsPendingService.clear();
      }
      // Persistir también las entregas del nivel 5 registradas como pendientes
      await this.entregasPendingService.flush();
      alerts.reqSuccessToast('Guardado', 'Cambios actualizados.');
    } catch {
      alerts.reqErrorToast('Error', 'No se pudieron guardar los cambios.');
    }
  
    this.cdr.detectChanges();}

  revertConditions(): void {
    this.conditionsPendingService.clear();
    this.entregasPendingService.clear();
    this.loadPurchaseOrders();
  }

  ngOnDestroy(): void {
    this.pendingSub.unsubscribe();
    this.conditionsPendingService.clear();
    this.entregasPendingService.clear();
  }
}
