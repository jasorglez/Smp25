import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import Swal from 'sweetalert2';
import { SignalsService } from 'app/services/signals.service';
import { InventarioWarehouseService } from 'app/services/inventario-warehouse.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { MaterialsService } from 'app/services/materials.service';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { InventoryMovementsDetailComponent } from './inventory-movements-detail.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, InventoryMovementsDetailComponent, TranslateModule],
  template: `
    <!-- Barra superior -->
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2 px-1">

      <!-- Selector de almacén -->
      <div class="d-flex align-items-center gap-1">
        <small class="text-muted fw-semibold">{{ 'modules.warehouses.ui.inventory.warehouse' | translate }}:</small>
        <select class="form-select form-select-sm" style="min-width:180px; max-width:240px"
                [(ngModel)]="selectedWarehouse" (ngModelChange)="loadData()">
          <option [ngValue]="0" disabled>— {{ 'modules.warehouses.ui.inventory.select' | translate }} —</option>
          <option *ngFor="let w of warehouses" [ngValue]="warehouseId(w)">{{ warehouseName(w) }}</option>
        </select>
      </div>

      <div class="input-group input-group-sm" style="width:min(340px, 100%)">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input type="search" class="form-control" [(ngModel)]="searchTerm"
          (ngModelChange)="applyTextFilter()" [placeholder]="'modules.warehouses.ui.inventory.searchPlaceholder' | translate"
          [attr.aria-label]="'modules.warehouses.ui.inventory.searchPlaceholder' | translate">
        <button *ngIf="searchTerm" class="btn btn-outline-secondary" type="button"
          (click)="searchTerm = ''; applyTextFilter()" [title]="'modules.warehouses.ui.inventory.clearSearch' | translate">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <!-- Botón refrescar -->
      <button class="btn btn-sm btn-outline-secondary" (click)="loadData()" [title]="'modules.warehouses.ui.inventory.refresh' | translate" [attr.aria-label]="'modules.warehouses.ui.inventory.refresh' | translate">
        <i class="bi bi-arrow-clockwise"></i>
      </button>

      <button class="btn btn-sm btn-outline-success" (click)="exportExcel()" [disabled]="loading || !rowData.length"
        [title]="'modules.warehouses.ui.inventory.exportExcel' | translate">
        <i class="bi bi-file-earmark-excel me-1"></i>{{ 'modules.warehouses.ui.inventory.excel' | translate }}
      </button>
      <button class="btn btn-sm btn-outline-danger" (click)="exportPdf()" [disabled]="loading || !rowData.length"
        [title]="'modules.warehouses.ui.inventory.exportPdf' | translate">
        <i class="bi bi-file-earmark-pdf me-1"></i>{{ 'modules.warehouses.ui.inventory.pdf' | translate }}
      </button>

      <label class="form-check form-switch d-flex align-items-center gap-2 mb-0 ms-1 small text-nowrap">
        <input class="form-check-input m-0" type="checkbox" [(ngModel)]="showZeroStock"
          (ngModelChange)="applyInventoryFilter()">
        <span>{{ 'modules.warehouses.ui.inventory.showZero' | translate }} <span class="badge bg-light text-secondary">{{ zeroStockCount }}</span></span>
      </label>

      <!-- Separador -->
      <div class="vr mx-1"></div>

      <!-- Chips resumen -->
      <span class="badge bg-secondary fs-xs">
        <i class="bi bi-box-seam me-1"></i>{{ totalMateriales }} {{ 'modules.warehouses.ui.inventory.materials' | translate }}
      </span>
      <span class="badge bg-danger fs-xs" *ngIf="criticos > 0" [title]="'modules.warehouses.ui.inventory.criticalStock' | translate">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>{{ criticos }} {{ 'modules.warehouses.ui.inventory.critical' | translate }}
      </span>
      <span class="badge bg-warning text-dark fs-xs" *ngIf="bajos > 0" [title]="'modules.warehouses.ui.inventory.lowStock' | translate">
        <i class="bi bi-arrow-down-circle me-1"></i>{{ bajos }} {{ 'modules.warehouses.ui.inventory.low' | translate }}
      </span>
      <span class="badge bg-success fs-xs" *ngIf="optimos > 0" [title]="'modules.warehouses.ui.inventory.optimalStock' | translate">
        <i class="bi bi-check-circle me-1"></i>{{ optimos }} {{ 'modules.warehouses.ui.inventory.optimal' | translate }}
      </span>
      <span class="badge bg-primary fs-xs" *ngIf="altos > 0" [title]="'modules.warehouses.ui.inventory.highStock' | translate">
        <i class="bi bi-arrow-up-circle me-1"></i>{{ altos }} {{ 'modules.warehouses.ui.inventory.high' | translate }}
      </span>

      <!-- Valor total (derecha) -->
      <span class="ms-auto badge bg-dark fs-xs">
        {{ 'modules.warehouses.ui.inventory.totalValue' | translate }}: {{ valorTotal | currency:'MXN':'symbol':'1.0-0' }}
      </span>
    </div>

    <!-- Spinner -->
    <div *ngIf="loading" class="text-center py-4">
      <div class="spinner-border text-primary" style="width:2rem;height:2rem;"></div>
      <p class="text-muted mt-2 small">{{ 'modules.warehouses.ui.inventory.loading' | translate }}</p>
    </div>

    <div *ngIf="dataWarnings.length" class="alert alert-warning py-2 small" role="alert">
      <strong><i class="bi bi-exclamation-triangle-fill me-1"></i>{{ 'modules.warehouses.ui.inventory.incompleteWarning' | translate }}</strong>
      <div *ngFor="let warning of dataWarnings">{{ warning }}</div>
    </div>

    <!-- Grid -->
    <ag-grid-angular *ngIf="!loading"
      style="width:100%; height:calc(100vh - 220px);"
      class="ag-theme-quartz small-text-ag-grid"
      [rowData]="rowData"
      [columnDefs]="colDefs"
      [defaultColDef]="defaultColDef"
      [gridOptions]="gridOptions"
      [rowClassRules]="rowClassRules"
      [animateRows]="true"
      (gridReady)="onGridReady($event)"
      (columnResized)="onColumnResized($event)"
    ></ag-grid-angular>
  `,
})
export class InventarioComponent {
  private translate = inject(TranslateService);
  private router = inject(Router);
  private signalsService     = inject(SignalsService);
  private inventarioService  = inject(InventarioWarehouseService);
  private permitionsService  = inject(PermitionsService);
  private trackingService    = inject(TrackingService);
  private materialsService   = inject(MaterialsService);

  rowData:           any[]   = [];
  private allInventoryRows: any[] = [];
  showZeroStock = false;
  searchTerm = '';
  warehouses:        any[]   = [];
  selectedWarehouse: number  = 0;
  loading:           boolean = false;
  dataWarnings: string[] = [];
  idCompany:         number  = 0;
  projectId:         number  = 0;
  private loadedCompany: number = 0;
  private gridApi!: GridApi;

  private readonly exportFields = [
    'insumo', 'description', 'measure', 'brand', 'entrada', 'salida', 'existencia',
    'stockMin', 'stockMax', 'costoMN', 'total', 'ventaMN', 'ventaTotal', 'estadoStock',
  ];

  private getExportRows(): any[] {
    if (!this.gridApi) return [...this.rowData];
    const rows: any[] = [];
    this.gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data) rows.push(node.data);
    });
    return rows;
  }

  private getExportHeaders(): string[] {
    const keys = ['code', 'description', 'unit', 'brand', 'receipts', 'issues', 'onHand',
      'minimum', 'maximum', 'unitCost', 'inventoryValue', 'salePrice', 'saleValue', 'status'];
    return keys.map(key => this.translate.instant(`modules.warehouses.ui.inventory.${key}`));
  }

  private getExportWarehouse(): string {
    const warehouse = this.warehouses.find(item => this.warehouseId(item) === Number(this.selectedWarehouse));
    return warehouse ? this.warehouseName(warehouse) : String(this.selectedWarehouse);
  }

  private getExportFileName(extension: string): string {
    const warehouse = this.getExportWarehouse().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 50);
    const date = new Date().toISOString().slice(0, 10);
    return `Inventario_${warehouse}_${date}.${extension}`;
  }

  exportExcel(): void {
    const rows = this.getExportRows();
    if (!rows.length) return;
    try {
      const headers = this.getExportHeaders();
      const sheet = XLSX.utils.aoa_to_sheet([
        [this.translate.instant('modules.warehouses.ui.inventory.title'), this.getExportWarehouse()],
        [this.translate.instant('modules.warehouses.ui.inventory.generatedAt'), new Date().toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX')],
        [],
        headers,
        ...rows.map(row => this.exportFields.map(field => row[field] ?? '')),
        [],
        [this.translate.instant('modules.warehouses.ui.inventory.totalValue'), ...Array(9).fill(''),
          rows.reduce((sum, row) => sum + this.toNumber(row.total), 0)],
      ]);
      sheet['!cols'] = [14, 42, 12, 22, ...Array(10).fill(16)].map(width => ({ wch: width }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Inventario');
      XLSX.writeFile(workbook, this.getExportFileName('xlsx'));
    } catch (error) {
      console.error('Error exporting inventory to Excel:', error);
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.inventory.error'), this.translate.instant('modules.warehouses.ui.inventory.exportFailed'), 'error');
    }
  }

  exportPdf(): void {
    const rows = this.getExportRows();
    if (!rows.length) return;
    try {
      const numericFields = new Set(['entrada', 'salida', 'existencia', 'stockMin', 'stockMax']);
      const currencyFields = new Set(['costoMN', 'total', 'ventaMN', 'ventaTotal']);
      const body: any[] = [this.getExportHeaders().map(text => ({ text, bold: true, color: '#ffffff', fillColor: '#17365d' }))];
      rows.forEach(row => body.push(this.exportFields.map(field =>
        numericFields.has(field) ? this.formatQuantity(row[field])
          : currencyFields.has(field) ? this.formatCurrency(row[field]) : String(row[field] ?? '')
      )));
      body.push([{ text: this.translate.instant('modules.warehouses.ui.inventory.totalValue'), bold: true, colSpan: 10 },
        ...Array(9).fill(''), { text: this.formatCurrency(rows.reduce((sum, row) => sum + this.toNumber(row.total), 0)), bold: true },
        '', '', '']);
      const doc: any = {
        pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 32, 24, 32],
        content: [
          { text: this.translate.instant('modules.warehouses.ui.inventory.title'), style: 'title' },
          { text: `${this.translate.instant('modules.warehouses.ui.inventory.warehouse')}: ${this.getExportWarehouse()}  ·  ${this.translate.instant('modules.warehouses.ui.inventory.generatedAt')}: ${new Date().toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX')}`, margin: [0, 0, 0, 10] },
          ...(this.dataWarnings.length ? [{ text: this.translate.instant('modules.warehouses.ui.inventory.incompleteWarning'), color: '#a15c00', margin: [0, 0, 0, 8] }] : []),
          { table: { headerRows: 1, widths: [65, '*', 43, 80, 45, 45, 55, 40, 40, 65, 75, 65, 75, 60], body }, layout: 'lightHorizontalLines' },
        ],
        styles: { title: { fontSize: 16, bold: true, margin: [0, 0, 0, 6] } },
        defaultStyle: { fontSize: 7 },
      };
      pdfMake.createPdf(doc).download(this.getExportFileName('pdf'));
    } catch (error) {
      console.error('Error exporting inventory to PDF:', error);
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.inventory.error'), this.translate.instant('modules.warehouses.ui.inventory.exportFailed'), 'error');
    }
  }

  // ── Chips ──────────────────────────────────────────────────────
  get totalMateriales() { return new Set(this.rowData.map(row => Number(row.id))).size; }
  get criticos()        { return this.rowData.filter(r => r.estadoStock === 'CRÍTICO').length; }
  get bajos()           { return this.rowData.filter(r => r.estadoStock === 'BAJO').length; }
  get optimos()         { return this.rowData.filter(r => r.estadoStock === 'ÓPTIMO').length; }
  get altos()           { return this.rowData.filter(r => r.estadoStock === 'ALTO').length; }
  get valorTotal()      { return this.rowData.reduce((s, r) => s + this.toNumber(r.total), 0); }
  get zeroStockCount()  { return this.allInventoryRows.filter(row => Math.abs(this.toNumber(row.existencia)) <= 0.000001).length; }

  // ── Grid colors ────────────────────────────────────────────────
  rowClassRules = {
    'inv-critico': (p: any) => p.data?.estadoStock === 'CRÍTICO',
    'inv-bajo':    (p: any) => p.data?.estadoStock === 'BAJO',
    'inv-optimo':  (p: any) => p.data?.estadoStock === 'ÓPTIMO',
    'inv-alto':    (p: any) => p.data?.estadoStock === 'ALTO',
  };

  defaultColDef: ColDef = { sortable: true, resizable: true, suppressMovable: true };

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 26,
    suppressDragLeaveHidesColumns: true,
    masterDetail: true,
    detailRowHeight: 240,
    isRowMaster: (row: any) => (row?.movements?.length ?? 0) > 0,
    detailCellRenderer: InventoryMovementsDetailComponent,
    getRowId: (params: any) => `${params.data?.id}-${params.data?.idBrand ?? 0}`,
  };

  colDefs: ColDef[] = [
    {
      headerName: '#', width: 48, editable: false,
      valueGetter: p => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { textAlign: 'center', color: '#999' },
    },
    { field: 'insumo',      headerName: this.translate.instant('modules.warehouses.ui.inventory.code'),       width: 100, filter: 'agTextColumnFilter' },
    {
      field: 'description', headerName: this.translate.instant('modules.warehouses.ui.inventory.description'), width: 320, minWidth: 200,
      resizable: true, suppressSizeToFit: true, filter: 'agTextColumnFilter',
      cellRenderer: 'agGroupCellRenderer',
      cellRendererParams: { suppressCount: true, innerRenderer: (p: any) => p.value ?? '' },
    },
    { field: 'measure',     headerName: this.translate.instant('modules.warehouses.ui.inventory.unit'),       width: 90, filter: 'agTextColumnFilter' },
    { field: 'brand',       headerName: this.translate.instant('modules.warehouses.ui.inventory.brand'),        width: 180, minWidth: 150, filter: 'agTextColumnFilter' },
    {
      field: 'entrada', headerName: this.translate.instant('modules.warehouses.ui.inventory.receipts'), width: 90, type: 'numericColumn',
      cellStyle: { color: '#198754', fontWeight: '600' },
      valueFormatter: p => this.formatQuantity(p.value),
    },
    {
      field: 'salida', headerName: this.translate.instant('modules.warehouses.ui.inventory.issues'), width: 90, type: 'numericColumn',
      cellStyle: { color: '#dc3545', fontWeight: '600' },
      valueFormatter: p => this.formatQuantity(p.value),
    },
    {
      field: 'existencia', headerName: this.translate.instant('modules.warehouses.ui.inventory.onHand'), width: 100, type: 'numericColumn',
      cellRenderer: (p: any) => {
        const c: any = { 'CRÍTICO': '#dc3545', 'BAJO': '#fd7e14', 'ÓPTIMO': '#198754', 'ALTO': '#0d6efd' };
        const color  = c[p.data?.estadoStock] || '#333';
        return `<strong style="color:${color}; font-size:1rem">${this.formatQuantity(p.value)}</strong>`;
      },
    },
    {
      headerName: this.translate.instant('modules.warehouses.ui.inventory.kardex'), width: 82, editable: false, sortable: false, resizable: false,
      cellStyle: { textAlign: 'center', paddingTop: '3px' },
      cellRenderer: () =>
        `<button class="btn btn-sm btn-outline-primary py-0 px-1" style="font-size:0.7rem" title="${this.translate.instant('modules.warehouses.ui.inventory.viewKardex')}">
           <i class="bi bi-journal-arrow-up"></i> ${this.translate.instant('modules.warehouses.ui.inventory.kardex')}
         </button>`,
      onCellClicked: params => this.openKardex(params.data),
    },
    {
      field: 'stockMin', headerName: this.translate.instant('modules.warehouses.ui.inventory.minimum'), width: 68, type: 'numericColumn',
      cellStyle: { color: '#aaa', fontSize: '0.8rem' },
    },
    {
      field: 'stockMax', headerName: this.translate.instant('modules.warehouses.ui.inventory.maximum'), width: 68, type: 'numericColumn',
      cellStyle: { color: '#aaa', fontSize: '0.8rem' },
    },
    {
      field: 'costoMN', headerName: this.translate.instant('modules.warehouses.ui.inventory.unitCost'), width: 115, type: 'numericColumn',
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'total', headerName: this.translate.instant('modules.warehouses.ui.inventory.inventoryValue'), flex: 1, minWidth: 135, type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'ventaMN', headerName: this.translate.instant('modules.warehouses.ui.inventory.salePrice'), width: 110, type: 'numericColumn',
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'ventaTotal', headerName: this.translate.instant('modules.warehouses.ui.inventory.saleValue'), flex: 1, minWidth: 120, type: 'numericColumn',
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'estadoStock', headerName: this.translate.instant('modules.warehouses.ui.inventory.status'), width: 90,
      cellRenderer: (p: any) => {
        const m: any = { 'CRÍTICO': 'bg-danger', 'BAJO': 'bg-warning text-dark', 'ÓPTIMO': 'bg-success', 'ALTO': 'bg-primary' };
        const statusKeys: any = { 'CRÍTICO': 'critical', 'BAJO': 'low', 'ÓPTIMO': 'optimal', 'ALTO': 'high' };
        const label = statusKeys[p.value] ? this.translate.instant(`modules.warehouses.ui.inventory.${statusKeys[p.value]}`) : (p.value ?? '');
        return `<span class="badge ${m[p.value] ?? 'bg-secondary'}" style="font-size:0.68rem">${label}</span>`;
      },
    },
    {
      headerName: '', width: 72, editable: false, sortable: false, resizable: false,
      cellStyle: { textAlign: 'center', paddingTop: '3px' },
      cellRenderer: () =>
        `<button class="btn btn-sm btn-outline-warning py-0 px-1" style="font-size:0.7rem" title="${this.translate.instant('modules.warehouses.ui.inventory.physicalAdjustment')}">
           <i class="bi bi-pencil-square"></i> ${this.translate.instant('modules.warehouses.ui.inventory.adjust')}
         </button>`,
      onCellClicked: p => this.openAjuste(p.data),
    },
  ];

  constructor() {
    effect(() => {
      const company = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
      this.projectId = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
      const companyChanged = company !== this.loadedCompany;
      this.idCompany = company;

      if (companyChanged) {
        this.loadedCompany = company;
        this.selectedWarehouse = 0;
        this.loadWarehouses();
      } else if (this.selectedWarehouse) {
        this.loadData();
      }
    });
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    const savedWidth = this.getSavedDescriptionWidth();
    if (savedWidth) {
      e.api.applyColumnState({
        state: [{ colId: 'description', width: savedWidth }],
        applyOrder: false,
      });
    }
    e.api.setGridOption('quickFilterText', this.searchTerm);
  }

  applyTextFilter(): void {
    this.gridApi?.setGridOption('quickFilterText', this.searchTerm.trim());
  }

  onColumnResized(event: any): void {
    if (!event?.finished || event.column?.getColId() !== 'description') return;
    const width = this.gridApi?.getColumnState().find(column => column.colId === 'description')?.width;
    if (!width || width < 200) return;
    try {
      localStorage.setItem(this.descriptionWidthStorageKey(), String(width));
    } catch {
      // Si el navegador bloquea el almacenamiento local, la columna sigue siendo redimensionable.
    }
  }

  private getSavedDescriptionWidth(): number | null {
    try {
      const width = Number(localStorage.getItem(this.descriptionWidthStorageKey()));
      return Number.isFinite(width) && width >= 200 ? width : null;
    } catch {
      return null;
    }
  }

  private descriptionWidthStorageKey(): string {
    const user = this.trackingService.getEmail().trim().toLocaleLowerCase() || 'usuario';
    return `biapp:grid-width:${encodeURIComponent(user)}:warehouses-inventory:description`;
  }

  loadWarehouses() {
    const email = this.trackingService.getEmail();
    if (!email) return;
    this.permitionsService.getPermisionswarehousexEmail(email).subscribe({
      next: (data: any[]) => {
        this.warehouses = Array.isArray(data) ? data : [];
        const stillAvailable = this.warehouses.some(w => this.warehouseId(w) === Number(this.selectedWarehouse));
        if (!stillAvailable) this.selectedWarehouse = this.warehouses.length ? this.warehouseId(this.warehouses[0]) : 0;
        this.loadData();
      },
      error: () => {
        this.warehouses = [];
        this.selectedWarehouse = 0;
        this.allInventoryRows = [];
        this.rowData = [];
        this.dataWarnings = ['No se pudieron consultar los almacenes autorizados.'];
      },
    });
  }

  loadData() {
    if (!this.idCompany || !this.selectedWarehouse) {
      this.allInventoryRows = [];
      this.rowData = [];
      this.dataWarnings = [];
      return;
    }

    this.loading = true;
    this.dataWarnings = [];
    const warn = (message: string) => {
      if (!this.dataWarnings.includes(message)) this.dataWarnings = [...this.dataWarnings, message];
    };
    const forSelectedWarehouse = (masters: any[]) => this.asArray(masters).filter(master =>
      Number(master.idWarehouse ?? master.IdWarehouse) === Number(this.selectedWarehouse) &&
      master.active !== false && Number(master.active) !== 0
    );
    const movementRequests = (['IN', 'OUT'] as const).map(type =>
      this.inventarioService.getWarehouseMovements(this.selectedWarehouse, type).pipe(
        catchError(() => of(null as any)),
        switchMap((warehouseRows: any[]) => {
          const selectedWarehouseRows = forSelectedWarehouse(warehouseRows);
          // Compatibilidad mientras se actualiza el contenedor: las versiones
          // anteriores exigían idProject, aunque Inventario es por almacén.
          if (selectedWarehouseRows.length || !this.projectId) {
            if (warehouseRows === null) warn(this.translate.instant('modules.warehouses.ui.inventory.warnings.movementHeaders'));
            return of(selectedWarehouseRows);
          }
          return this.inventarioService.getMovements(this.projectId, this.selectedWarehouse, type).pipe(
            map(rows => forSelectedWarehouse(rows)),
            catchError(() => {
              warn(this.translate.instant('modules.warehouses.ui.inventory.warnings.movementHeadersByType', { type: this.translate.instant(type === 'IN' ? 'modules.warehouses.ui.inventory.receipts' : 'modules.warehouses.ui.inventory.issues') }));
              return of([]);
            })
          );
        }),
        switchMap((masters: any[]) => {
          const movementMasters = this.asArray(masters);
          if (!movementMasters.length) return of({ type, details: [] as any[] });

          return forkJoin(
            movementMasters.map(master =>
              this.inventarioService.getMovementItems(Number(master.id ?? master.Id)).pipe(
                catchError(() => {
                  warn(this.translate.instant('modules.warehouses.ui.inventory.warnings.movementItems', { folio: master.folio || master.id || master.Id }));
                  return of([]);
                }),
              map(details => this.asArray(details).map(detail => ({
                ...detail,
                __movement: master,
                __movementType: type,
              })))
              )
            )
          ).pipe(map(detailGroups => ({ type, details: detailGroups.flat() })));
        })
      )
    );

    forkJoin({
      materials: this.materialsService.getMaterialsForPosCache(this.idCompany).pipe(catchError(() => {
        warn(this.translate.instant('modules.warehouses.ui.inventory.warnings.materialCatalog'));
        return of([]);
      })),
      brands: this.materialsService.getMaterialBrands(this.idCompany).pipe(catchError(() => {
        warn(this.translate.instant('modules.warehouses.ui.inventory.warnings.brandCatalog'));
        return of([]);
      })),
      movements: forkJoin(movementRequests),
    }).subscribe({
      next: result => {
        this.allInventoryRows = this.buildInventoryRows(result.materials as any[], result.movements, result.brands as any[]);
        this.applyInventoryFilter();
        this.loading = false;
      },
      error: error => {
        console.error('Error loading inventory:', error);
        this.allInventoryRows = [];
        this.rowData = [];
        this.loading = false;
        warn(this.translate.instant('modules.warehouses.ui.inventory.warnings.stockQuery'));
      },
    });
  }

  applyInventoryFilter(): void {
    this.rowData = this.showZeroStock
      ? [...this.allInventoryRows]
      : this.allInventoryRows.filter(row => Math.abs(this.toNumber(row.existencia)) > 0.000001);
  }

  private buildInventoryRows(materials: any[], movements: Array<{ type: 'IN' | 'OUT'; details: any[] }>, brands: any[] = []): any[] {
    const materialMap = new Map<number, any>();
    this.asArray(materials).forEach(material => materialMap.set(Number(material.id ?? material.Id), material));
    const rows = new Map<number, any>();

    movements.forEach(group => {
      group.details.filter((detail: any) => detail.active !== false && Number(detail.active) !== 0).forEach(detail => {
        const idMaterial = Number(detail.idProduct ?? detail.IdProduct);
        if (!idMaterial) return;
        const material = materialMap.get(idMaterial);
        // Los detalles históricos conservan el código y descripción del material,
        // pero Inventarios solo debe mostrar productos que sigan activos en el catálogo.
        if (!material) return;
        const quantity = this.toNumber(detail.quantity ?? detail.Quantity ?? detail.total ?? detail.Total);
        const current = rows.get(idMaterial) || {
          id: idMaterial,
          insumo: detail.code ?? detail.Code ?? material.insumo ?? material.barCode ?? '',
          description: detail.description ?? detail.Description ?? material.description ?? `Material #${idMaterial}`,
          measure: detail.measure ?? detail.Measure ?? material.measure ?? '',
          entrada: 0,
          salida: 0,
          stockMin: this.toNumber(material.stockMin ?? material.stockmin),
          stockMax: this.toNumber(material.stockMax ?? material.stockmax),
          costoMN: this.toNumber(material.costoMN ?? material.CostoMN),
          ventaMN: this.toNumber(material.ventaMN ?? material.VentaMN ?? material.sellingprice),
          movementDetails: [],
          brandStocks: new Map<number | string, { name: string; quantity: number; entrada: number; salida: number }>(),
        };

        current.movementDetails.push(detail);

        if (group.type === 'IN') current.entrada += quantity;
        else current.salida += quantity;
        const brandId = detail.idBrand ?? detail.IdBrand;
        const brandName = detail.brand ?? detail.Brand ?? detail.brandName ?? detail.BrandName;
        const brandKey: number | string = brandId == null ? 'unbranded' : Number(brandId);
        const configured = brands.find(item => Number(item.idMaterial ?? item.IdMaterial) === idMaterial && Number(item.id) === Number(brandId));
        const stockName = brandId == null ? 'Sin marca' : (brandName || configured?.brand || configured?.Brand || `Marca ${brandId}`);
        const brandStock = current.brandStocks.get(brandKey) || { name: stockName, quantity: 0, entrada: 0, salida: 0 };
        if (group.type === 'IN') brandStock.entrada += quantity;
        else brandStock.salida += quantity;
        brandStock.quantity = brandStock.entrada - brandStock.salida;
        current.brandStocks.set(brandKey, brandStock);
        rows.set(idMaterial, current);
      });
    });

    return [...rows.values()].flatMap(row => {
      const materialBrands = brands.filter(item => Number(item.idMaterial ?? item.IdMaterial) === row.id);
      materialBrands.forEach(brand => {
        const brandId = Number(brand.id ?? brand.Id);
        if (!row.brandStocks.has(brandId)) row.brandStocks.set(brandId, { name: brand.brand ?? brand.Brand, quantity: 0, entrada: 0, salida: 0 });
      });
      const unbranded = row.brandStocks.get('unbranded');
      if (unbranded && materialBrands.length === 1) {
        const onlyBrandId = Number(materialBrands[0].id ?? materialBrands[0].Id);
        const onlyBrand = row.brandStocks.get(onlyBrandId)!;
        onlyBrand.entrada += unbranded.entrada;
        onlyBrand.salida += unbranded.salida;
        onlyBrand.quantity = onlyBrand.entrada - onlyBrand.salida;
        row.brandStocks.delete('unbranded');
      } else if (unbranded && materialBrands.length > 1) {
        row.brandStocks.set(0, { name: 'Sin marca', quantity: unbranded.quantity, entrada: unbranded.entrada, salida: unbranded.salida });
        row.brandStocks.delete('unbranded');
      }
      if (materialBrands.length > 1 && !row.brandStocks.has(0)) {
        row.brandStocks.set(0, { name: 'Sin marca', quantity: 0, entrada: 0, salida: 0 });
      }
      const brandStocks = [...row.brandStocks.entries()].map(([key, value]) => ({ idBrand: key === 'unbranded' ? 0 : Number(key), ...value }));
      return brandStocks.map(stock => ({
        ...row,
        idBrand: stock.idBrand,
        brand: stock.name || 'Sin marca',
        brands: materialBrands.map(brand => ({ id: Number(brand.id ?? brand.Id), brand: brand.brand ?? brand.Brand })),
        brandStocks,
        movements: this.buildMovementHistory(row.movementDetails, stock.idBrand, materialBrands),
        entrada: stock.entrada,
        salida: stock.salida,
        existencia: stock.quantity,
        total: stock.quantity * row.costoMN,
        ventaTotal: stock.quantity * row.ventaMN,
        estadoStock: this.stockStatus(stock.quantity, row.stockMin, row.stockMax),
      }));
    }).sort((a, b) => String(a.description).localeCompare(String(b.description), 'es'));
  }

  private buildMovementHistory(details: any[], rowBrandId: number, materialBrands: any[]): any[] {
    const targetBrand = Number(rowBrandId || 0);
    const history = (details || []).filter(detail => {
      const rawBrandId = detail.idBrand ?? detail.IdBrand;
      const effectiveBrandId = rawBrandId == null
        ? (materialBrands.length === 1 ? Number(materialBrands[0].id ?? materialBrands[0].Id) : 0)
        : Number(rawBrandId);
      return effectiveBrandId === targetBrand;
    }).map(detail => {
      const master = detail.__movement || {};
      const type = detail.__movementType === 'IN' ? 'IN' : 'OUT';
      const quantity = this.toNumber(detail.quantity ?? detail.Quantity ?? detail.total ?? detail.Total);
      return {
        fecha: master.date ?? master.Date ?? master.deliveryDate ?? master.DeliveryDate,
        folio: master.folio ?? master.Folio ?? master.id ?? master.Id,
        tipo: type,
        entrada: type === 'IN' ? quantity : 0,
        salida: type === 'OUT' ? quantity : 0,
        saldo: 0,
        referencia: master.comment ?? master.Comment ?? '',
      };
    }).sort((a, b) => new Date(a.fecha ?? 0).getTime() - new Date(b.fecha ?? 0).getTime()
      || String(a.folio).localeCompare(String(b.folio), 'es', { numeric: true }));

    let balance = 0;
    for (const movement of history) {
      balance += movement.entrada - movement.salida;
      movement.saldo = balance;
    }
    return history.reverse();
  }

  private stockStatus(existence: number, minimum: number, maximum: number): string {
    if (existence <= 0) return 'CRÍTICO';
    if (minimum > 0 && existence <= minimum) return 'BAJO';
    if (maximum > 0 && existence > maximum) return 'ALTO';
    return 'ÓPTIMO';
  }

  private asArray(value: any): any[] {
    return Array.isArray(value) ? value : (value?.data || value?.result || value?.items || []);
  }

  warehouseId(warehouse: any): number {
    return Number(warehouse?.idAlmacen ?? warehouse?.idWarehouse ?? warehouse?.id ?? 0);
  }

  warehouseName(warehouse: any): string {
    return warehouse?.nombreAlmacen ?? warehouse?.nameWarehouse ?? warehouse?.name ?? warehouse?.description ?? `Almacén #${this.warehouseId(warehouse)}`;
  }

  private toNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private formatQuantity(value: unknown): string {
    return new Intl.NumberFormat(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX', { maximumFractionDigits: 3 }).format(this.toNumber(value));
  }

  private formatCurrency(value: unknown): string {
    return new Intl.NumberFormat(this.translate.currentLang === 'en' ? 'en-US' : 'es-MX', { style: 'currency', currency: 'MXN' }).format(this.toNumber(value));
  }

  async openAjuste(row: any): Promise<void> {
    if (!this.selectedWarehouse) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.inventory.warehouseRequired'), this.translate.instant('modules.warehouses.ui.inventory.selectWarehouseForAdjustment'), 'warning');
      return;
    }

    const brandOptions = row.brands?.length > 1
      ? `<label class="form-label fw-semibold mb-1" style="font-size:0.85rem">${this.translate.instant('modules.warehouses.ui.inventory.brand')}:</label>
         <select id="aju-brand" class="swal2-select" style="display:block;width:100%;margin:0 0 10px 0">
           ${row.brandStocks.map((stock: any) => `<option value="${stock.idBrand}" ${Number(stock.idBrand) === Number(row.idBrand) ? 'selected' : ''}>${stock.name} (${this.formatQuantity(stock.quantity)})</option>`).join('')}
         </select>`
      : '';
    const chosenBrand = row.brands?.length === 1 ? row.brands[0] : null;
    const initialStock = Number(row.existencia || 0);
    const result = await Swal.fire({
      title:  this.translate.instant('modules.warehouses.ui.inventory.adjustmentTitle'),
      width:  460,
      html: `
        <div class="text-start px-1">
          <div class="mb-1 fw-semibold" style="font-size:0.95rem">${row.description}</div>
          <div class="mb-3 text-muted" style="font-size:0.8rem">
            ${this.translate.instant('modules.warehouses.ui.inventory.code')}: <code>${row.insumo}</code> &nbsp;|&nbsp; ${this.translate.instant('modules.warehouses.ui.inventory.brand')}: <strong>${row.brand || this.translate.instant('modules.warehouses.ui.inventory.noBrand')}</strong>
            &nbsp;|&nbsp; ${this.translate.instant('modules.warehouses.ui.inventory.currentStock')}: <strong id="aju-current">${this.formatQuantity(initialStock)}</strong>
            &nbsp;|&nbsp; ${this.translate.instant('modules.warehouses.ui.inventory.status')}: <strong>${row.estadoStock ? this.translate.instant(`modules.warehouses.ui.inventory.${row.estadoStock === 'CRÍTICO' ? 'critical' : row.estadoStock === 'BAJO' ? 'low' : row.estadoStock === 'ÓPTIMO' ? 'optimal' : 'high'}`) : '—'}</strong>
          </div>

          ${brandOptions}

          <label class="form-label fw-semibold mb-1" style="font-size:0.85rem">${this.translate.instant('modules.warehouses.ui.inventory.physicalQuantity')}:</label>
          <input id="aju-qty" type="number" min="0" step="0.01" value="${initialStock}"
                 class="swal2-input" style="margin:0 0 6px 0; width:100%">

          <div id="aju-delta" class="text-center fw-bold mb-2" style="font-size:1.05rem; min-height:1.6rem"></div>

          <label class="form-label fw-semibold mb-1" style="font-size:0.85rem">${this.translate.instant('modules.warehouses.ui.inventory.commentOptional')}:</label>
          <textarea id="aju-comment" class="swal2-textarea"
                    style="margin:0; width:100%; height:58px; font-size:0.85rem"
                    placeholder="${this.translate.instant('modules.warehouses.ui.inventory.adjustmentReason')}"></textarea>
        </div>
      `,
      showCancelButton:  true,
      confirmButtonText: `<i class="bi bi-floppy me-1"></i>${this.translate.instant('modules.warehouses.ui.inventory.saveAdjustment')}`,
      cancelButtonText:  this.translate.instant('modules.warehouses.ui.inventory.cancel'),
      confirmButtonColor: '#0d6efd',
      focusConfirm: false,
      didOpen: () => {
        const qEl = document.getElementById('aju-qty')   as HTMLInputElement;
        const dEl = document.getElementById('aju-delta') as HTMLElement;
        const brandEl = document.getElementById('aju-brand') as HTMLSelectElement | null;
        const currentEl = document.getElementById('aju-current') as HTMLElement;
        const getCurrent = () => brandEl
          ? Number(row.brandStocks.find((stock: any) => String(stock.idBrand) === brandEl.value)?.quantity || 0)
          : initialStock;
        const update = () => {
          const delta = (parseFloat(qEl.value) || 0) - getCurrent();
          dEl.innerHTML = delta === 0
            ? `<span class="text-muted small">${this.translate.instant('modules.warehouses.ui.inventory.noChange')}</span>`
            : delta > 0
              ? `<span class="text-success">▲ +${delta.toFixed(0)} — ${this.translate.instant('modules.warehouses.ui.inventory.receiptWillBeCreated')} <em>${this.translate.instant('modules.warehouses.ui.inventory.receipts').toLocaleLowerCase()}</em></span>`
              : `<span class="text-danger">▼ ${delta.toFixed(0)} — ${this.translate.instant('modules.warehouses.ui.inventory.issueWillBeCreated')} <em>${this.translate.instant('modules.warehouses.ui.inventory.issues').toLocaleLowerCase()}</em></span>`;
        };
        qEl.addEventListener('input', update);
        brandEl?.addEventListener('change', () => {
          const current = getCurrent();
          currentEl.textContent = this.formatQuantity(current);
          qEl.value = String(current);
          update();
        });
        update();
      },
      preConfirm: (): { qty: number; comment: string; idBrand: number | null } | null => {
        const qty = parseFloat((document.getElementById('aju-qty') as HTMLInputElement).value);
        if (isNaN(qty) || qty < 0) {
          Swal.showValidationMessage(this.translate.instant('modules.warehouses.ui.inventory.enterValidQuantity'));
          return null;
        }
        const comment = (document.getElementById('aju-comment') as HTMLTextAreaElement).value;
        const selected = row.brands?.length > 1
          ? Number((document.getElementById('aju-brand') as HTMLSelectElement).value)
          : (chosenBrand ? Number(chosenBrand.id) : (Number(row.idBrand) === 0 ? 0 : null));
        return { qty, comment, idBrand: selected };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      await this.inventarioService.ajustar({
        idMaterial:     row.id,
        idWarehouse:    this.selectedWarehouse,
        cantidadFisica: result.value.qty,
        comentario:     result.value.comment,
        idCompany:      this.idCompany,
        idBrand:        result.value.idBrand,
      }).toPromise();
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.inventory.adjustmentSaved'), this.translate.instant('modules.warehouses.ui.inventory.inventoryUpdated'), 'success');
      this.loadData();
    } catch {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.inventory.error'), this.translate.instant('modules.warehouses.ui.inventory.adjustmentFailed'), 'error');
    }
  }

  openKardex(row: any): void {
    const materialId = Number(row?.id);
    if (!Number.isInteger(materialId) || materialId <= 0) return;
    void this.router.navigate(['/warehousesTD/kardex'], { queryParams: { materialId } });
  }
}
