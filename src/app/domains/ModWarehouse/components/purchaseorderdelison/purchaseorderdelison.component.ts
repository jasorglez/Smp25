import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from '../purchaseorder/button-cell-renderer.component';
import { PdfButtonCellRendererPurchaseOrderComponent } from '../purchaseorder/pdf-button-cell-renderer-purchaseorder.component';
import { DetailCellRendererPurchaseOrderItemsComponent } from '../purchaseorder/detail-cell-renderer-purchase-order-items.component';
import { DetailCellRendererPurchaseOrderReportComponent } from '../purchaseorder/detail-cell-renderer-purchaseorder-report.component';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { AuthService } from 'app/services/auth.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-purchaseorderdelison',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AgGridModule,
    ButtonCellRendererComponent,
    PdfButtonCellRendererPurchaseOrderComponent,
    DetailCellRendererPurchaseOrderItemsComponent,
    DetailCellRendererPurchaseOrderReportComponent
  ],
  templateUrl: './purchaseorderdelison.component.html',
  styleUrl: './purchaseorderdelison.component.scss',
  styles: [`
    :host ::ng-deep .expanded-oc {
      background-color: #e8f5e9 !important;
    }
  `]
})
export class PurchaseOrderDelisonComponent implements OnInit {

  private signalsService   = inject(SignalsService);
  private ocAndReqsService = inject(OcAndReqsService);
  private branchsService   = inject(BranchsService);
  private providersService = inject(ProvidersService);
  private customersService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  public  authService      = inject(AuthService);

  private gridApi!: GridApi;
  private isInitialized = false;
  private expandedRowId: string | null = null;

  rowData: any[]     = [];
  fullRowData: any[] = [];
  gridHeight         = '80vh';
  hasUnsavedChanges  = false;

  idRoot: number   = null;
  idBranch: number = null;
  idUser: number   = null;

  branches: any[]   = [];
  proveedores: any[] = [];
  productos: any[] = [];
  branchesLoaded    = false;

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
    effect(() => {
      const newIdBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (newIdBranch !== undefined && newIdBranch !== null && newIdBranch !== this.idBranch) {
        this.idBranch = newIdBranch;
        if (this.branchesLoaded) {
          this.loadPurchaseOrders();
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
    setTimeout(() => {
      this.idRoot  = this.signalsService.getRootSelectedBySidebar()();
      this.idUser  = this.signalsService.getIdUSer()();

      if (this.idRoot) {
        this.loadBranches();
        this.loadProviders();
        this.loadMaterials();
      } else {
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {
            this.loadBranches();
            this.loadProviders();
            this.loadMaterials();
          }
        }, 300);
      }
      this.isInitialized = true;
    }, 200);
  }

  // ==================== CARGA INICIAL ====================

  loadBranches() {
    this.branchsService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe({
      next: (data: any) => {
        this.branches = (data.project || []).map((row: any) => ({
          id: row.idPermission || row.idBranch || row.id,
          name: row.name || row.description || ''
        }));
        this.branchesLoaded = true;

        const current = this.signalsService.getBranchSelectedBySidebar()();
        if (current !== null && current !== undefined) {
          this.idBranch = current;
          this.loadPurchaseOrders();
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
      componentParent: this,
      proveedores: this.proveedores,
      productos: this.productos,
      ITEMS: {
        load: (ocId: number, callback: (data: any[]) => void) => {
          this.ocAndReqsService.getReqItems(ocId).subscribe({
            next: (data: any[]) => callback(Array.isArray(data) ? data : []),
            error: (err) => {
              console.error('[Órdenes compra] getReqItems falló', { ocId, err });
              callback([]);
            }
          });
        },
        save: () => {},
        delete: () => {},
        updateCount: (ocId: number, count: number) => {
          this.updateOcCount(ocId, count);
        },
        updateTotal: (ocId: number, total: number) => {
          this.updateOcTotal(ocId, total);
        }
      }
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
      return;
    }
    if (this.idBranch < 0) {
      this.loadFromAllBranches();
    } else {
      this.loadFromSingleBranch(this.idBranch);
    }
  }

  private mapOcRow(oc: any, branchName: string): any {
    const rawCreate = oc.dateCreate ? String(oc.dateCreate).split('T')[0] : '';
    const fechaCreate = rawCreate
      ? (() => { const [y, m, d] = rawCreate.split('-'); return d && m && y ? `${d}/${m}/${y}` : rawCreate; })()
      : '';

    // El backend puede devolver datesupply o dateSupply según el mapeo
    const supplyRaw = oc.datesupply || oc.dateSupply || '';
    const rawSupply = supplyRaw ? String(supplyRaw).split('T')[0] : '';
    const fechaSupply = rawSupply
      ? (() => { const [y, m, d] = rawSupply.split('-'); return d && m && y ? `${d}/${m}/${y}` : rawSupply; })()
      : '';

    return {
      id:           oc.id,
      branch:       branchName,
      idReference:  oc.idReference || oc.id_reference,
      folio:        oc.folio || '',
      fechaCreate,
      fechaSupply,
      idProvider:   oc.idProvider || oc.id_provider || 0,
      providerName: oc.solicit || this.getProviderName(oc.idProvider || oc.id_provider),
      solicit:      oc.solicit || '',
      typeOc:       oc.typeOc || oc.typeoc || '',
      delivery:     oc.delivery || '',
      deliveryTime: oc.deliveryTime || oc.deliverytime || '',
      conditions:   oc.conditions || '',
      countrow:     oc.countrow || oc.countitem || 0,
      total:        oc.total || 0,
      active:       oc.active !== false,
      detailType:   null
    };
  }

  private loadFromAllBranches() {
    if (!this.branches || this.branches.length === 0) {
      this.fullRowData = [];
      this.rowData = [];
      if (this.gridApi) { this.gridApi.setGridOption('rowData', []); }
      return;
    }

    const promises = this.branches.map(branch =>
      new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getOcAndReqs('branch', branch.id, 'OC').subscribe({
          next: (data: any) => resolve(Array.isArray(data) ? data : []),
          error: () => resolve([])
        });
      }).then((ocs: any[]) => ocs.map(oc => this.mapOcRow(oc, branch.name)))
    );

    Promise.all(promises).then((allData: any[][]) => {
      this.fullRowData = allData.flat();
      this.rowData = [...this.fullRowData];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
    });
  }

  private loadFromSingleBranch(branchId: number) {
    const branch = this.branches.find(b => b.id === branchId);
    const branchName = branch?.name || '';

    this.ocAndReqsService.getOcAndReqs('branch', branchId, 'OC').subscribe({
      next: (data: any) => {
        this.fullRowData = Array.isArray(data)
          ? data.map((oc: any) => this.mapOcRow(oc, branchName))
          : [];
        this.rowData = [...this.fullRowData];
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshCells({ force: true });
        }
      },
      error: () => {
        alerts.basicAlert('Error', 'No se pudieron cargar las órdenes de compra', 'error');
        this.fullRowData = [];
        this.rowData = [];
      }
    });
  }

  // ==================== GRID CONFIG ====================

  public gridOptions: any = {
    headerHeight: 56,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 1035,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'report') {
        return { component: DetailCellRendererPurchaseOrderReportComponent, params: {} };
      }
      return { component: DetailCellRendererPurchaseOrderItemsComponent };
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
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'countrow',
        headerName: 'Artículos',
        width: 140,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: { onClick: (node: any) => this.toggleCascade(node) },
        valueGetter: params => params.data?.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 100,
        cellRenderer: PdfButtonCellRendererPurchaseOrderComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportCascade(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Generar reporte PDF de la Orden de Compra'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'folio',
        headerName: '# Orden de Compra',
        width: 180,
        filter: true,
        editable: false,
        cellStyle: { backgroundColor: '#f0f0f0', fontWeight: '500' }
      },
      {
        field: 'providerName',
        headerName: 'Proveedor',
        width: 220,
        filter: true,
        editable: false
      },
      {
        field: 'fechaCreate',
        headerName: 'Fecha Creación',
        width: 155,
        editable: false
      },
      {
        field: 'fechaSupply',
        headerName: 'Fecha Entrega',
        width: 155,
        editable: false
      },
      {
        field: 'branch',
        headerName: 'Sucursal',
        width: 200,
        filter: true,
        editable: false
      },
      {
        field: 'typeOc',
        headerName: 'Tipo OC',
        width: 130,
        filter: true,
        editable: false
      },
      {
        field: 'delivery',
        headerName: 'Entrega',
        width: 120,
        editable: false
      },
      {
        field: 'conditions',
        headerName: 'Condiciones',
        width: 160,
        editable: false
      },
      {
        field: 'solicit',
        headerName: 'Solicitó',
        width: 160,
        editable: false
      },
      {
        field: 'total',
        headerName: 'Total OC',
        width: 150,
        editable: false,
        valueFormatter: (params: any) => {
          const v = params.value || 0;
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
        },
        cellStyle: { backgroundColor: '#e8f5e9', fontWeight: 'bold', textAlign: 'right' }
      }
    ];
  }

  // ==================== GRID EVENTS ====================

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.buildInitialGridContext();
    this.gridApi.setGridOption('context', this.gridContext);

    this.gridApi.setGridOption('detailCellRendererParams', {
      // El detalle lo carga el cell renderer con ITEMS.load (no el sub-grid por defecto).
      getDetailRowData: (p: any) => {
        p.successCallback([]);
      }
    });
  }

  onSelectionChanged(_event: any) {}
  onCellValueChanged(_event: any) { this.hasUnsavedChanges = true; }

  // ==================== CASCADE ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isExpanded = node.expanded && node.data.detailType === 'items' && this.expandedRowId === node.id;

    if (isExpanded) {
      node.setExpanded(false);
      node.data.detailType  = null;
      node.data.isExpanded  = false;
      this.expandedRowId    = null;
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
      api.redrawRows();
    } else {
      // Colapsar fila previa
      if (this.expandedRowId) {
        api.forEachNode((n: any) => {
          if (n.id === this.expandedRowId) {
            n.setExpanded(false);
            n.data.detailType = null;
            n.data.isExpanded = false;
          }
        });
      }
      // Ocultar resto
      api.forEachNode((n: any) => n.setRowHeight(n.id !== node.id ? 0 : undefined));

      node.data.detailType = 'items';
      node.data.isExpanded = true;
      this.expandedRowId   = node.id;

      api.onRowHeightChanged();
      api.redrawRows();
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  toggleReportCascade(node: any) {
    node.setSelected(true);
    const api = this.gridApi;
    const isExpanded = node.expanded && node.data.detailType === 'report' && this.expandedRowId === node.id;

    if (isExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      node.data.isExpanded = false;
      this.expandedRowId   = null;
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
      api.redrawRows();
    } else {
      if (this.expandedRowId) {
        api.forEachNode((n: any) => {
          if (n.id === this.expandedRowId) {
            n.setExpanded(false);
            n.data.detailType = null;
            n.data.isExpanded = false;
          }
        });
      }
      api.forEachNode((n: any) => n.setRowHeight(n.id !== node.id ? 0 : undefined));

      node.data.detailType = 'report';
      node.data.isExpanded = true;
      this.expandedRowId   = node.id;

      api.onRowHeightChanged();
      api.redrawRows();
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  collapseReportDetail() {
    if (this.expandedRowId && this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.id === this.expandedRowId) {
          node.setExpanded(false);
          node.data.isExpanded = false;
          node.data.detailType = null;
        }
        node.setRowHeight(undefined);
      });
      this.expandedRowId = null;
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    }
  }

  // ==================== UTILS ====================

  refreshData() {
    this.loadPurchaseOrders();
  }

  updateOcCount(ocId: number, count: number) {
    const row = this.rowData.find(r => r.id === ocId);
    if (row) {
      row.countrow = count;
      const node = this.gridApi?.getRowNode(String(ocId));
      if (node) this.gridApi.refreshCells({ rowNodes: [node], columns: ['countrow'], force: true });
    }
  }

  updateOcTotal(ocId: number, total: number) {
    // Persiste en BD
    this.ocAndReqsService.setTotal(ocId, total).subscribe();
    // Actualiza celda en el grid master
    const row = this.rowData.find(r => r.id === ocId);
    if (row) {
      row.total = total;
      const node = this.gridApi?.getRowNode(String(ocId));
      if (node) this.gridApi.refreshCells({ rowNodes: [node], columns: ['total'], force: true });
    }
  }
}
