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
import { PedimentosXRequisicionComponent } from './pedimentos-x-requisicion.component';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { AuthService } from 'app/services/auth.service';
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
    PedimentosXRequisicionComponent
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
        this.branchesMap.clear();
        this.branches.forEach(b => this.branchesMap.set(b.id, b.name));
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
      return;
    }
    if (this.idBranch < 0) {
      this.loadFromAllBranches();
    } else {
      this.loadFromSingleBranch(this.idBranch);
    }
  }

  private mapOcRow(oc: any, branchName: string): any {
    return {
      id:           oc.id,
      sucursal:     branchName,
      folio:        oc.folio || '',
      ocCount:      oc.countItems ?? 0,
      catalogo:     '',
      idReference:  oc.idReq || oc.id,
      idCompany:    this.idRoot,
      active:       oc.active !== false,
      detailType:   null,
      idProvider:   oc.idProvider,
      reqFolio:     oc.reqFolio || '',
      dateModified: oc.dateModified || null,
      dateCreate:   oc.dateCreate   || null
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
      new Promise<{ ocs: any[]; branch: any }>((resolve) => {
        this.ocAndReqsService.getOcsByBranch(branch.id).subscribe({
          next: (data: any) => resolve({ ocs: Array.isArray(data) ? data : [], branch }),
          error: () => resolve({ ocs: [], branch })
        });
      })
    );

    const branchResults: any[] = await Promise.all(branchPromises);
    const allOcs = branchResults.flatMap(({ ocs, branch }) =>
      ocs.map((oc: any) => ({ oc, branchName: branch.name }))
    );

    const mapped = allOcs.map(({ oc, branchName }) => this.mapOcRow(oc, branchName));

    this.fullRowData = mapped.sort((a, b) => {
      const dateA = new Date(a.dateModified || a.dateCreate || 0).getTime();
      const dateB = new Date(b.dateModified || b.dateCreate || 0).getTime();
      return dateB - dateA;
    });
    this.rowData = [...this.fullRowData];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.refreshCells({ force: true });
      if (this.columnState) {
        this.gridApi.applyColumnState({ state: this.columnState });
      }
    }
  }

  private async loadFromSingleBranch(branchId: number) {
    const branch = this.branches.find(b => b.id === branchId);
    const branchName = branch?.name || '';

    try {
      const data: any = await lastValueFrom(this.ocAndReqsService.getOcsByBranch(branchId));
      const ocs = Array.isArray(data) ? data : [];

      const allMapped = ocs.map((oc: any) => this.mapOcRow(oc, branchName));
      this.fullRowData = allMapped.sort((a, b) => {
        const dateA = new Date(a.dateModified || a.dateCreate || 0).getTime();
        const dateB = new Date(b.dateModified || b.dateCreate || 0).getTime();
        return dateB - dateA;
      });

      this.rowData = [...this.fullRowData];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
        if (this.columnState) {
          this.gridApi.applyColumnState({ state: this.columnState });
        }
      }
    } catch {
      alerts.basicAlert('Error', 'No se pudieron cargar las órdenes de compra', 'error');
      this.fullRowData = [];
      this.rowData = [];
    }
  }

  private async getPedimentoCount(idRequisicion: number): Promise<number> {
    try {
      const pedimentos = await lastValueFrom(this.ocAndReqsService.getPedimentosByRequisicion(idRequisicion));
      return Array.isArray(pedimentos) ? pedimentos.length : 0;
    } catch {
      return 0;
    }
  }

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
    onColumnMoved: () => this.saveColumnState()
  };

  get colMaster(): ColDef[] {
    return [
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
        field: 'ocCount',
        headerName: 'Departamento',
        width: 100,
        editable: false,
        type: 'numericColumn',
        cellStyle: { fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f1f8e9' }
      },
      {
        field: 'reqFolio',
        headerName: '# Requisición',
        width: 160,
        filter: true,
        editable: false,
        cellStyle: { backgroundColor: '#fff8e1', fontWeight: '400' }
      },
      {
        field: 'folio',
        headerName: '# Pedimentos',
        width: 160,
        filter: true,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' },
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

    if (this.columnState) {
      this.gridApi.applyColumnState({ state: this.columnState });
    }
  }

  private saveColumnState() {
    if (this.gridApi) {
      this.columnState = this.gridApi.getColumnState();
    }
  }

  onSelectionChanged(_event: any) {}
  onCellValueChanged(_event: any) { this.hasUnsavedChanges = true; }

  // ==================== UTILS ====================

  refreshData() {
    this.loadPurchaseOrders();
  }
}
