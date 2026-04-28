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
import { Cascada1OcComponent } from './cascada1-oc.component';
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
    DetailCellRendererPurchaseOrderReportComponent,
    Cascada1OcComponent
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

  private mapRequisitionRow(req: any, branchName: string, ocCount: number): any {
    return {
      id:           req.id,
      sucursal:     branchName,
      folio:        req.folio || '',
      ocCount:      ocCount,
      catalogo:     '', // TODO: get catalog info from materials if available
      idReference:  req.idReference || req.id_reference,
      idCompany:    this.idRoot,
      active:       req.active !== false,
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
        this.ocAndReqsService.getRequisitionsByBranch(branch.id).subscribe({
          next: (data: any) => {
            const reqs = Array.isArray(data) ? data : [];
            const mapped = reqs.map((req: any) => {
              const ocCount = req.countitem || 0;
              return this.mapRequisitionRow(req, branch.name, ocCount);
            });
            resolve(mapped);
          },
          error: () => resolve([])
        });
      })
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

    this.ocAndReqsService.getRequisitionsByBranch(branchId).subscribe({
      next: (data: any) => {
        const reqs = Array.isArray(data) ? data : [];
        this.fullRowData = reqs.map((req: any) => {
          const ocCount = req.countitem || 0;
          return this.mapRequisitionRow(req, branchName, ocCount);
        });
        this.rowData = [...this.fullRowData];
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshCells({ force: true });
        }
      },
      error: () => {
        alerts.basicAlert('Error', 'No se pudieron cargar las requisiciones', 'error');
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
    detailRowHeight: 800,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) => {
      return { component: Cascada1OcComponent };
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
        field: 'folio',
        headerName: '# Requisición',
        width: 160,
        filter: true,
        editable: false,
        cellStyle: { backgroundColor: '#f0f0f0', fontWeight: '500', cursor: 'pointer' },
        onCellClicked: (event: any) => {
          const isExpanding = !event.node.expanded;
          if (isExpanding) {
            // Colapsa todas las demás filas antes de expandir esta
            event.api.forEachNode((node: any) => {
              if (node.id !== event.node.id && node.expanded) {
                node.setExpanded(false);
              }
            });
          }
          event.node.setExpanded(isExpanding);
        }
      },
      {
        field: 'ocCount',
        headerName: 'OC',
        width: 100,
        editable: false,
        type: 'numericColumn',
        cellStyle: { backgroundColor: '#fff3e0', fontWeight: 'bold', textAlign: 'center' }
      },
      {
        field: 'catalogo',
        headerName: 'Catálogo',
        width: 200,
        filter: true,
        editable: false
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

  // ==================== UTILS ====================

  refreshData() {
    this.loadPurchaseOrders();
  }
}
