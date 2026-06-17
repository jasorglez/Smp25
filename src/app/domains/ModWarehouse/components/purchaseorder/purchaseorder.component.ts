import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { PdfButtonCellRendererPurchaseOrderComponent } from './pdf-button-cell-renderer-purchaseorder.component';
import { DetailCellRendererPurchaseOrderItemsComponent } from './detail-cell-renderer-purchase-order-items.component';
import { DetailCellRendererPurchaseOrderReportComponent } from './detail-cell-renderer-purchaseorder-report.component';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProvidersService } from 'app/services/providers.service';
import { AuthService } from 'app/services/auth.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-purchaseorder',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AgGridModule],
  templateUrl: './purchaseorder.component.html',
  styleUrl: './purchaseorder.component.scss',
  styles: [`
    :host ::ng-deep .expanded-oc {
      background-color: #e3f2fd !important;
    }
  `]
})
export class PurchaseOrderComponent implements OnInit {

  private signalsService  = inject(SignalsService);
  private ocAndReqsService = inject(OcAndReqsService);
  private branchsService  = inject(BranchsService);
  private providersService = inject(ProvidersService);
  public  authService     = inject(AuthService);

  private gridApi!: GridApi;
  private isInitialized: boolean = false;
  private expandedRowId: string | null = null;

  rowData: any[]     = [];
  fullRowData: any[] = [];
  gridHeight: string = '80vh';
  hasUnsavedChanges: boolean = false;

  idRoot: number   = null;
  idBranch: number = null;
  idUser: number   = null;

  branches: any[]   = [];
  proveedores: any[] = [];
  branchesLoaded: boolean = false;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true
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
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();

      if (this.idRoot) {
        this.loadBranches();
        this.loadProviders();
      } else {
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {
            this.loadBranches();
            this.loadProviders();
          }
        }, 300);
      }

      this.isInitialized = true;
    }, 200);
  }

  loadBranches() {
    this.branchsService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe({
      next: (data: any) => {
        this.branches = (data.project || []).map((row: any) => ({
          id: row.idPermission || row.idBranch || row.id,
          name: row.name || row.description || ''
        }));
        this.branchesLoaded = true;

        const currentIdBranch = this.signalsService.getBranchSelectedBySidebar()();
        if (currentIdBranch !== null && currentIdBranch !== undefined) {
          this.idBranch = currentIdBranch;
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
    this.providersService.getProviders(this.idRoot).subscribe({
      next: (data: any) => { this.proveedores = Array.isArray(data) ? data : []; },
      error: () => {}
    });
  }

  getProviderName(idProvider: number): string {
    if (!idProvider) return '';
    const found = this.proveedores.find(p => p.id === idProvider);
    return found?.name || found?.description || `Prov. ${idProvider}`;
  }

  // ==================== CARGA DE DATOS ====================

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
    const rawFecha = oc.dateCreate ? String(oc.dateCreate).split('T')[0] : '';
    const fechaCreate = rawFecha
      ? (() => { const [y, m, d] = rawFecha.split('-'); return d && m && y ? `${d}/${m}/${y}` : rawFecha; })()
      : '';

    const rawSupply = oc.datesupply ? String(oc.datesupply).split('T')[0] : '';
    const fechaSupply = rawSupply
      ? (() => { const [y, m, d] = rawSupply.split('-'); return d && m && y ? `${d}/${m}/${y}` : rawSupply; })()
      : '';

    return {
      id: oc.id,
      branch: branchName,
      idReference: oc.idReference,
      folio: oc.folio || '',
      fechaCreate,
      fechaSupply,
      idProvider: oc.idProvider || 0,
      providerName: oc.solicit || this.getProviderName(oc.idProvider),
      solicit: oc.solicit || '',
      typeOc: oc.typeOc || '',
      delivery: oc.delivery || '',
      deliveryTime: oc.deliveryTime || '',
      conditions: oc.conditions || '',
      countrow: oc.countrow || 0,
      active: oc.active !== false,
      detailType: null
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
      })
    );

    Promise.all(promises).then((allData: any[][]) => {
      const combined = allData.flat();
      this.fullRowData = combined.map((oc: any) => {
        const branch = this.branches.find(b => b.id === oc.idReference);
        return this.mapOcRow(oc, branch?.name || branch?.description || '');
      });
      this.rowData = [...this.fullRowData];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
    });
  }

  private loadFromSingleBranch(branchId: number) {
    this.ocAndReqsService.getOcAndReqs('branch', branchId, 'OC').subscribe({
      next: (data: any) => {
        const branch = this.branches.find(b => b.id === branchId);
        const branchName = branch?.name || branch?.description || '';
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
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 700,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'report') {
        return { component: DetailCellRendererPurchaseOrderReportComponent, params: {} };
      }
      return { component: DetailCellRendererPurchaseOrderItemsComponent };
    },
    getRowClass: (params: any) => {
      if (params.node.isSelected()) return 'selected-row';
      if (params.data?.__isNew)     return 'new-row-highlight';
      if (params.data?.isExpanded)  return 'expanded-oc';
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
        headerName: 'Items',
        width: 80,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: { onClick: (node: any) => this.toggleCascade(node) },
        valueGetter: params => params.data?.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 60,
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
        headerName: '# OC',
        width: 160,
        filter: true,
        editable: false,
        cellStyle: { backgroundColor: '#f0f0f0' }
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
        width: 140,
        editable: false
      },
      {
        field: 'fechaSupply',
        headerName: 'Fecha Entrega',
        width: 140,
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
        width: 120,
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
      }
    ];
  }

  // ==================== GRID EVENTS ====================

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectionChanged(event: any) {}

  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;
  }

  // ==================== CASCADE (MASTER-DETAIL) ====================

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'items' && this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      node.data.isExpanded = false;
      this.expandedRowId = null;
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
      api.forEachNode((n: any) => {
        n.setRowHeight(n.id !== node.id ? 0 : undefined);
      });

      node.data.detailType = 'items';
      node.data.isExpanded = true;
      this.expandedRowId = node.id;

      api.onRowHeightChanged();
      api.redrawRows();
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  toggleReportCascade(node: any) {
    node.setSelected(true);
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report' && this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      node.data.isExpanded = false;
      this.expandedRowId = null;
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
      api.forEachNode((n: any) => {
        n.setRowHeight(n.id !== node.id ? 0 : undefined);
      });

      node.data.detailType = 'report';
      node.data.isExpanded = true;
      this.expandedRowId = node.id;

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

  // ==================== CRUD ====================

  refreshData() {
    this.loadPurchaseOrders();
  }

  updateOcItemsCount(ocId: number, count: number) {
    const row = this.rowData.find(r => r.id === ocId);
    if (row) {
      row.countrow = count;
      const node = this.gridApi?.getRowNode(String(ocId));
      if (node) this.gridApi.refreshCells({ rowNodes: [node], columns: ['countrow'], force: true });
    }
  }
}
