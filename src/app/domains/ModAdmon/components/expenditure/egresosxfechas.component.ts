import { CommonModule } from '@angular/common';
import { Component, effect, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';

import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { PdfReportsService } from 'app/services/pdf-reports.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-egresosxfechas',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  template: `
    <div class="col-12">

      <!-- Cuentas + fechas + buscar en un solo renglón -->
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-3">
        <ul class="nav nav-tabs flex-nowrap overflow-auto mb-0 border-0" *ngIf="!allAccounts">
          <li class="nav-item" *ngFor="let account of bankAccounts">
            <a class="nav-link py-1 px-3 border"
               [class.active]="idAccount === account.id"
               (click)="selectAccount(account.id)"
               style="cursor:pointer; font-size:0.8rem; white-space:nowrap;">
              {{ account.nameAccount }} - {{ account.bankName }}
            </a>
          </li>
          <li *ngIf="!bankAccounts?.length" class="nav-item">
            <span class="nav-link disabled py-1 px-3" style="font-size:0.8rem;">No hay cuentas</span>
          </li>
        </ul>

        <div class="d-flex align-items-center gap-1 ms-auto flex-wrap">
          <label class="small fw-semibold mb-0 text-nowrap">Inicio</label>
          <input type="date" class="form-control form-control-sm" style="width:140px;"
                 [(ngModel)]="startDate" [class.is-invalid]="dateError" />
          <label class="small fw-semibold mb-0 text-nowrap">Fin</label>
          <input type="date" class="form-control form-control-sm" style="width:140px;"
                 [(ngModel)]="endDate" [class.is-invalid]="dateError" />
          <button class="btn btn-sm btn-primary" (click)="onFilterChange()">
            <i class="bi bi-search"></i>
          </button>
          <span *ngIf="dateError" class="text-danger small fw-semibold ms-1">
            <i class="bi bi-exclamation-triangle-fill me-1"></i>La fecha de inicio no puede ser mayor que la fecha de fin.
          </span>
        </div>
      </div>

      <!-- Tipo de Reporte — solo en tab Todas -->
      <div *ngIf="allAccounts" class="d-flex align-items-center gap-2 mb-2">
        <span class="small fw-semibold text-muted">Reporte:</span>
        <div class="btn-group btn-group-sm">
          <button class="btn"
                  [class.btn-primary]="reportType==='detalle'"
                  [class.btn-outline-secondary]="reportType!=='detalle'"
                  (click)="setReportType('detalle')">
            <i class="bi bi-list-ul me-1"></i>Detalle
          </button>
          <button class="btn"
                  [class.btn-warning]="reportType==='proveedor'"
                  [class.btn-outline-secondary]="reportType!=='proveedor'"
                  (click)="setReportType('proveedor')">
            <i class="bi bi-people me-1"></i>Por Proveedor
          </button>
          <button class="btn"
                  [class.btn-info]="reportType==='mes'"
                  [class.btn-outline-secondary]="reportType!=='mes'"
                  (click)="setReportType('mes')">
            <i class="bi bi-calendar3 me-1"></i>Por Mes
          </button>
        </div>
        <button class="btn btn-sm btn-danger ms-2" (click)="downloadPdf()" [disabled]="rowData.length === 0 || generatingPdf">
          <i class="bi bi-file-earmark-pdf me-1"></i>{{ generatingPdf ? 'Generando...' : 'PDF' }}
        </button>
      </div>

      <!-- Totales -->
      <div class="row mb-2" *ngIf="rowData.length > 0">
        <div class="col-12">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="badge bg-secondary px-3 py-2">
              <i class="bi bi-list-ul me-1"></i>{{ rowData.length }} registros
            </span>
            <span class="badge bg-primary px-3 py-2">
              <i class="bi bi-cash me-1"></i>Subtotal: {{ totalSubtotal | currency:'MXN':'symbol':'1.2-2' }}
            </span>
            <span class="badge bg-info text-dark px-3 py-2">
              <i class="bi bi-percent me-1"></i>IVA: {{ totalIva | currency:'MXN':'symbol':'1.2-2' }}
            </span>
            <span class="badge bg-success px-3 py-2" style="font-size:0.9rem;">
              <i class="bi bi-currency-dollar me-1"></i>Total: {{ totalFinal | currency:'MXN':'symbol':'1.2-2' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Grid -->
      <ag-grid-angular
        class="ag-theme-quartz"
        style="height: calc(100vh - 260px); width: 100%; --ag-font-size: 12px; --ag-list-item-height: 30px; --ag-header-height: 30px; --ag-row-height: 30px;"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        [pinnedBottomRowData]="pinnedBottomRow"
        [pagination]="true"
        [paginationPageSize]="50"
        [paginationPageSizeSelector]="[25,50,100,200]"
        (gridReady)="onGridReady($event)"
        (filterChanged)="onGridFilterChanged()"
      />

      <!-- Sin datos -->
      <div *ngIf="!loading && rowData.length === 0 && (allAccounts || idAccount)"
           class="text-center text-muted mt-4">
        <i class="bi bi-inbox" style="font-size:2rem;"></i>
        <p class="mt-2">No hay conceptos en el rango de fechas seleccionado.</p>
      </div>

      <div *ngIf="!allAccounts && !idAccount" class="text-center text-muted mt-4">
        <i class="bi bi-bank" style="font-size:2rem;"></i>
        <p class="mt-2">Seleccione una pestaña de cuenta bancaria para ver los egresos por fechas.</p>
      </div>

    </div>
  `
})
export class EgresosxfechasComponent {

  @Input() allAccounts = false;

  reportType: 'detalle' | 'proveedor' | 'mes' = 'detalle';
  generatingPdf = false;
  dateError = false;

  private signalsServicePriv = inject(SignalsService);
  public signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private pdfReportsService = inject(PdfReportsService);
  public trackingService = inject(TrackingService);

  idRoot: number;
  idAccount: number | null = null;
  bankAccounts: any[] = [];
  loading = false;

  private allData: any[] = [];
  rowData: any[] = [];

  totalSubtotal = 0;
  totalIva = 0;
  totalFinal = 0;

  pinnedBottomRow: any[] = [];

  startDate: string;
  endDate: string;

  private gridApi!: GridApi;

  public gridOptions: any = {
    animateRows: true,
    headerHeight: 30,
    rowHeight: 30,
    groupDisplayType: 'singleColumn',
    groupDefaultExpanded: 0,
    groupIncludeFooter: true,
    groupIncludeTotalFooter: false,
    suppressAggFuncInHeader: true,
    autoGroupColumnDef: {
      headerName: 'Fecha',
      width: 150,
      minWidth: 95,
      maxWidth: 160,
      pinned: 'left',
      sort: 'desc',
      cellStyle: {
        fontSize: '12px',
      },
      cellRendererParams: {
        suppressCount: false,
        footerValueGetter: (params: any) => {
          return `Subtotal ${this.formatDate(params.value)}`;
        }
      }
    },
    getRowStyle: (params: any) => {
      if (params.node?.footer) {
        return { fontWeight: 'bold', backgroundColor: '#eaf4ff' };
      }
      return null;
    }
  };

  constructor() {
    const now = new Date();
    this.startDate = `${now.getFullYear()}-01-01`;
    this.endDate = now.toISOString().substring(0, 10);

    effect(async () => {
      this.idRoot = this.signalsServicePriv.getRootSelectedBySidebar()();
      if (!this.idRoot) return;
      await this.loadBankAccounts();
    });
  }

  async loadBankAccounts() {
    return new Promise<void>(resolve => {
      this.administrationService.getAccountBanks(this.idRoot).subscribe({
        next: async (data: any) => {
          this.bankAccounts = data || [];
          if (this.allAccounts) {
            await this.onFilterChange();
          } else {
            this.idAccount = null;
            this.rowData = [];
            this.allData = [];
            if (this.bankAccounts.length === 1) {
              this.idAccount = this.bankAccounts[0].id;
              await this.onFilterChange();
            }
          }
          resolve();
        },
        error: () => {
          this.bankAccounts = [];
          resolve();
        }
      });
    });
  }

  async selectAccount(accountId: number) {
    this.idAccount = accountId;
    await this.onFilterChange();
  }

  async onFilterChange() {
    if (this.startDate > this.endDate) {
      this.dateError = true;
      return;
    }
    this.dateError = false;

    if (!this.allAccounts && !this.idAccount) {
      this.rowData = [];
      this.pinnedBottomRow = [];
      return;
    }

    this.loading = true;

    const data: any[] = await lastValueFrom(
      this.incomesAndExpensesService.getConceptsDailyByRoot(this.idRoot)
    ).catch(() => []);

    this.allData = data || [];
    this.applyFilters();
    this.loading = false;
  }

  private applyFilters() {
    const filtered = this.allData.filter(c => {
      if (!this.allAccounts) {
        if (c.idAccount !== this.idAccount) return false;
      }
      if (!c.dateExpend) return false;
      const ds = String(c.dateExpend).substring(0, 10);
      return ds >= this.startDate && ds <= this.endDate;
    });

    this.rowData = filtered;
    this.totalSubtotal = filtered.reduce((s, c) => s + (c.total || 0), 0);
    this.totalIva = filtered.reduce((s, c) => s + (c.iva2 || 0), 0);
    this.totalFinal = filtered.reduce((s, c) => s + (c.totalFinal || 0), 0);

    this.pinnedBottomRow = filtered.length > 0 ? [{
      numberDocument: `${filtered.length} registros`,
      total: this.totalSubtotal,
      iva2: this.totalIva,
      totalFinal: this.totalFinal,
    }] : [];
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onGridFilterChanged() {
    if (!this.gridApi) return;

    let subtotal = 0;
    let iva = 0;
    let total = 0;
    let count = 0;

    this.gridApi.forEachNodeAfterFilter(node => {
      if (!node.data || node.group || node.footer || node.rowPinned) return;
      subtotal += node.data.total || 0;
      iva += node.data.iva2 || 0;
      total += node.data.totalFinal || 0;
      count++;
    });

    this.pinnedBottomRow = count > 0 ? [{
      numberDocument: `${count} registros`,
      total: subtotal,
      iva2: iva,
      totalFinal: total,
    }] : [];
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    minWidth: 80,
    cellStyle: {
      fontSize: '12px',
    },
  };

  public colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 55,
      valueGetter: p => p.node?.group || p.node?.footer ? '' : (p.node!.rowIndex! % 50) + 1,
      pinned: 'left',
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
      filter: false,
    },
    {
      field: 'dateExpend',
      rowGroup: true,
      hide: true,
      sort: 'desc',
      valueGetter: p => String(p.data?.dateExpend || '').substring(0, 10),
      comparator: (a, b) => String(a || '').localeCompare(String(b || '')),
    },
    {
      field: 'numberDocument',
      headerName: '# Documento',
      width: 140,
      valueFormatter: p => p.node?.group || p.node?.footer ? '' : (p.value || ''),
    },
    {
      field: 'entityType',
      headerName: 'Tipo',
      width: 130,
      cellRenderer: (p: any) => {
        if (p.node?.group || p.node?.footer) return '';

        const map: any = {
          PROVEEDOR: '<span class="badge bg-primary">P</span> Proveedor',
          EMPLEADO: '<span class="badge bg-warning text-dark">E</span> Empleado',
          OTRO: '<span class="badge bg-secondary">O</span> Otro',
        };
        return map[p.value] || p.value || '';
      },
    },
    {
      field: 'entityName',
      headerName: 'Proveedor / Empleado',
      width: 220,
      filter: true,
      valueFormatter: p => p.node?.group || p.node?.footer ? '' : (p.value || ''),
    },
    {
      field: 'description',
      headerName: 'Descripcion',
      width: 230,
      filter: true,
      valueFormatter: p => p.node?.group || p.node?.footer ? '' : (p.value || ''),
      cellStyle: { whiteSpace: 'normal', lineHeight: '1.3' },
    },
    {
      field: 'quantity',
      headerName: 'Cantidad',
      width: 130,
      type: 'numericColumn',
      valueFormatter: p => p.node?.group || p.node?.footer ? '' : (p.value != null ? Number(p.value).toFixed(2) : ''),
    },
    {
      field: 'price',
      headerName: 'Precio',
      width: 120,
      type: 'numericColumn',
      valueFormatter: p => p.node?.group || p.node?.footer ? '' : (
        p.value != null
          ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
          : ''
      ),
    },
    {
      field: 'total',
      headerName: 'Subtotal',
      width: 120,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
        : '',
      cellStyle: p => p.node.rowPinned
        ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : p.node?.footer
          ? { fontWeight: 'bold', color: '#0b5394' }
          : { fontWeight: '500' },
    },
    {
      field: 'iva2',
      headerName: 'IVA',
      width: 120,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
        : '',
      cellStyle: p => p.node.rowPinned
        ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : p.node?.footer
          ? { fontWeight: 'bold', color: '#0b5394' }
          : {},
    },
    {
      field: 'totalFinal',
      headerName: 'Total Final',
      width: 140,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
        : '',
      cellStyle: p => p.node.rowPinned
        ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff', fontSize: '0.95rem' }
        : p.node?.footer
          ? { fontWeight: 'bold', color: '#0b5394', fontSize: '0.95rem' }
          : { fontWeight: 'bold', color: '#155724' },
    },
  ];

  setReportType(type: 'detalle' | 'proveedor' | 'mes') {
    this.reportType = type;
    if (!this.gridApi) return;

    const colsMap = { detalle: this.colDefs, proveedor: this.colDefsProveedor, mes: this.colDefsMes };
    const headerMap = { detalle: 'Fecha', proveedor: 'Proveedor / Empleado', mes: 'Mes' };
    const footerMap: Record<string, (p: any) => string> = {
      detalle:    (p: any) => `Subtotal ${this.formatDate(p.value)}`,
      proveedor:  (p: any) => `Total ${p.value || ''}`,
      mes:        (p: any) => `Total ${this.formatMes(p.value)}`,
    };

    this.gridApi.setGridOption('columnDefs', colsMap[type]);
    this.gridApi.setGridOption('autoGroupColumnDef', {
      ...this.gridOptions.autoGroupColumnDef,
      headerName: headerMap[type],
      valueFormatter: type === 'mes' ? (p: any) => this.formatMes(p.value) : undefined,
      cellRendererParams: { suppressCount: false, footerValueGetter: footerMap[type] },
    });
  }

  private formatMes(val: string): string {
    if (!val) return '';
    const [y, m] = String(val).split('-');
    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[parseInt(m)] || ''} ${y}`;
  }

  private readonly colDefsProveedor: ColDef[] = [
    { field: 'entityName', rowGroup: true, hide: true, sort: 'asc',
      comparator: (a: string, b: string) => String(a || '').localeCompare(String(b || '')) },
    { field: 'numberDocument', headerName: '# Documento', width: 140,
      valueFormatter: (p: any) => p.node?.group || p.node?.footer ? '' : (p.value || '') },
    { field: 'dateExpend', headerName: 'Fecha', width: 110,
      valueGetter: (p: any) => String(p.data?.dateExpend || '').substring(0, 10),
      valueFormatter: (p: any) => {
        if (!p.value || p.node?.group || p.node?.footer) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      }},
    { field: 'description', headerName: 'Descripcion', width: 230,
      valueFormatter: (p: any) => p.node?.group || p.node?.footer ? '' : (p.value || '') },
    { field: 'total', headerName: 'Subtotal', width: 130, type: 'numericColumn', aggFunc: 'sum',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: (p: any) => p.node.rowPinned ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : p.node?.footer ? { fontWeight: 'bold', color: '#0b5394' } : { fontWeight: '500' } },
    { field: 'iva2', headerName: 'IVA', width: 120, type: 'numericColumn', aggFunc: 'sum',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: (p: any) => p.node.rowPinned ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : p.node?.footer ? { fontWeight: 'bold', color: '#0b5394' } : {} },
    { field: 'totalFinal', headerName: 'Total Final', width: 140, type: 'numericColumn', aggFunc: 'sum',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: (p: any) => p.node.rowPinned ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff', fontSize: '0.95rem' }
        : p.node?.footer ? { fontWeight: 'bold', color: '#0b5394', fontSize: '0.95rem' } : { fontWeight: 'bold', color: '#155724' } },
  ];

  private readonly colDefsMes: ColDef[] = [
    { colId: 'mesAnio', rowGroup: true, hide: true, sort: 'asc',
      valueGetter: (p: any) => String(p.data?.dateExpend || '').substring(0, 7),
      comparator: (a: string, b: string) => String(a || '').localeCompare(String(b || '')) },
    { field: 'entityName', headerName: 'Proveedor / Empleado', width: 220,
      valueFormatter: (p: any) => p.node?.group || p.node?.footer ? '' : (p.value || '') },
    { field: 'numberDocument', headerName: '# Documento', width: 140,
      valueFormatter: (p: any) => p.node?.group || p.node?.footer ? '' : (p.value || '') },
    { field: 'description', headerName: 'Descripcion', width: 230,
      valueFormatter: (p: any) => p.node?.group || p.node?.footer ? '' : (p.value || '') },
    { field: 'total', headerName: 'Subtotal', width: 130, type: 'numericColumn', aggFunc: 'sum',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: (p: any) => p.node.rowPinned ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : p.node?.footer ? { fontWeight: 'bold', color: '#0b5394' } : { fontWeight: '500' } },
    { field: 'iva2', headerName: 'IVA', width: 120, type: 'numericColumn', aggFunc: 'sum',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: (p: any) => p.node.rowPinned ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : p.node?.footer ? { fontWeight: 'bold', color: '#0b5394' } : {} },
    { field: 'totalFinal', headerName: 'Total Final', width: 140, type: 'numericColumn', aggFunc: 'sum',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: (p: any) => p.node.rowPinned ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff', fontSize: '0.95rem' }
        : p.node?.footer ? { fontWeight: 'bold', color: '#0b5394', fontSize: '0.95rem' } : { fontWeight: 'bold', color: '#155724' } },
  ];

  async downloadPdf() {
    this.generatingPdf = true;
    try {
      await this.pdfReportsService.generateFinancialReport({
        rows: this.rowData,
        reportType: this.reportType === 'proveedor' ? 'proveedor' : this.reportType,
        title: 'REPORTE DE EGRESOS',
        startDate: this.startDate,
        endDate: this.endDate,
        idRoot: this.idRoot,
      });
    } finally {
      this.generatingPdf = false;
    }
  }

  private formatDate(value: string) {
    if (!value) return '';
    const [y, m, d] = String(value).substring(0, 10).split('-');
    return y && m && d ? `${d}/${m}/${y}` : value;
  }
}
