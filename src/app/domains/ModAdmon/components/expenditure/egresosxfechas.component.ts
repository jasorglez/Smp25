import { Component, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-egresosxfechas',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  template: `
    <div class="col-12">

      <!-- Cuentas + fechas + buscar en un solo renglón -->
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-3">
        <ul class="nav nav-tabs flex-nowrap overflow-auto mb-0 border-0">
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

        <div class="d-flex align-items-center gap-1 ms-auto">
          <label class="small fw-semibold mb-0 text-nowrap">Inicio</label>
          <input type="date" class="form-control form-control-sm" style="width:140px;"
                 [(ngModel)]="startDate" />
          <label class="small fw-semibold mb-0 text-nowrap">Fin</label>
          <input type="date" class="form-control form-control-sm" style="width:140px;"
                 [(ngModel)]="endDate" />
          <button class="btn btn-sm btn-primary" (click)="onFilterChange()">
            <i class="bi bi-search"></i>
          </button>
        </div>
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
        style="height: calc(100vh - 260px); width: 100%;"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [pinnedBottomRowData]="pinnedBottomRow"
        [pagination]="true"
        [paginationPageSize]="50"
        [paginationPageSizeSelector]="[25,50,100,200]"
        (gridReady)="onGridReady($event)"
        (filterChanged)="onGridFilterChanged()"
      />

      <!-- Sin datos -->
      <div *ngIf="!loading && rowData.length === 0 && idAccount"
           class="text-center text-muted mt-4">
        <i class="bi bi-inbox" style="font-size:2rem;"></i>
        <p class="mt-2">No hay conceptos en el rango de fechas seleccionado para esta cuenta.</p>
      </div>

      <div *ngIf="!idAccount" class="text-center text-muted mt-4">
        <i class="bi bi-bank" style="font-size:2rem;"></i>
        <p class="mt-2">Seleccione una pestaña de cuenta bancaria para ver los egresos por fechas.</p>
      </div>

    </div>
  `
})
export class EgresosxfechasComponent {

  private signalsServicePriv = inject(SignalsService);
  public  signalsService     = inject(SignalsService);
  private administrationService   = inject(AdministrationService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  public  trackingService    = inject(TrackingService);

  idRoot: number;
  idAccount: number | null = null;
  bankAccounts: any[] = [];
  loading = false;

  private allData: any[] = [];
  rowData: any[] = [];

  totalSubtotal = 0;
  totalIva      = 0;
  totalFinal    = 0;

  pinnedBottomRow: any[] = [];

  startDate: string;
  endDate:   string;

  private gridApi!: GridApi;

  constructor() {
    // Default: Jan 1 current year → today
    const now = new Date();
    this.startDate = `${now.getFullYear()}-01-01`;
    this.endDate   = now.toISOString().substring(0, 10);

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
          this.idAccount = null;
          this.rowData = [];
          this.allData = [];
          if (this.bankAccounts.length === 1) {
            this.idAccount = this.bankAccounts[0].id;
            await this.onFilterChange();
          }
          resolve();
        },
        error: () => { this.bankAccounts = []; resolve(); }
      });
    });
  }

  async selectAccount(accountId: number) {
    this.idAccount = accountId;
    await this.onFilterChange();
  }

  async onFilterChange() {
    if (!this.idAccount) { this.rowData = []; return; }
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
      const matchAccount = c.idAccount === this.idAccount;
      if (!matchAccount) return false;

      if (!c.dateExpend) return false;
      const ds = String(c.dateExpend).substring(0, 10);
      return ds >= this.startDate && ds <= this.endDate;
    });

    this.rowData = filtered;
    this.totalSubtotal = filtered.reduce((s, c) => s + (c.total || 0), 0);
    this.totalIva      = filtered.reduce((s, c) => s + (c.iva2 || 0), 0);
    this.totalFinal    = filtered.reduce((s, c) => s + (c.totalFinal || 0), 0);

    this.pinnedBottomRow = filtered.length > 0 ? [{
      dateExpend:     'TOTAL',
      numberDocument: `${filtered.length} registros`,
      total:          this.totalSubtotal,
      iva2:           this.totalIva,
      totalFinal:     this.totalFinal,
    }] : [];
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onGridFilterChanged() {
    let subtotal = 0, iva = 0, total = 0, count = 0;
    this.gridApi.forEachNodeAfterFilter(node => {
      if (!node.data) return;
      subtotal += node.data.total     || 0;
      iva      += node.data.iva2      || 0;
      total    += node.data.totalFinal || 0;
      count++;
    });
    this.pinnedBottomRow = count > 0 ? [{
      dateExpend:     'TOTAL',
      numberDocument: `${count} registros`,
      total:          subtotal,
      iva2:           iva,
      totalFinal:     total,
    }] : [];
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    minWidth: 80,
  };

  public colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 55,
      valueGetter: p => (p.node!.rowIndex! % 50) + 1,
      pinned: 'left',
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
      filter: false,
    },
    {
      field: 'dateExpend',
      headerName: 'Fecha',
      width: 150,
      sort: 'desc',
      valueFormatter: p => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).substring(0, 10).split('-');
        return `${d}/${m}/${y}`;
      },
    },
    {
      field: 'numberDocument',
      headerName: '# Documento',
      width: 150,
    },
    {
      field: 'entityType',
      headerName: 'Tipo',
      width: 140,
      cellRenderer: (p: any) => {
        const map: any = {
          'PROVEEDOR': '<span class="badge bg-primary">P</span> Proveedor',
          'EMPLEADO':  '<span class="badge bg-warning text-dark">E</span> Empleado',
          'OTRO':      '<span class="badge bg-secondary">O</span> Otro',
        };
        return map[p.value] || p.value || '';
      },
    },
    {
      field: 'entityName',
      headerName: 'Proveedor / Empleado',
      width: 250,
      filter: true,
    },
    {
      field: 'description',
      headerName: 'Descripción',
      width: 250,
      filter: true,
      cellStyle: { whiteSpace: 'normal', lineHeight: '1.3' },
    },
    {
      field: 'quantity',
      headerName: 'Cantidad',
      width: 150,
      type: 'numericColumn',
      valueFormatter: p => p.value != null ? Number(p.value).toFixed(2) : '',
    },
    {
      field: 'price',
      headerName: 'Precio',
      width: 150,
      type: 'numericColumn',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
    },
    {
      field: 'total',
      headerName: 'Subtotal',
      width: 150,
      type: 'numericColumn',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: p => p.node.rowPinned
        ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : { fontWeight: '500' },
    },
    {
      field: 'iva2',
      headerName: 'IVA',
      width: 130,
      type: 'numericColumn',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: p => p.node.rowPinned
        ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff' }
        : {},
    },
    {
      field: 'totalFinal',
      headerName: 'Total Final',
      width: 150,
      type: 'numericColumn',
      valueFormatter: p => p.value != null
        ? Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: p => p.node.rowPinned
        ? { fontWeight: 'bold', backgroundColor: '#1a5276', color: '#fff', fontSize: '0.95rem' }
        : { fontWeight: 'bold', color: '#155724' },
    },
  ];
}
