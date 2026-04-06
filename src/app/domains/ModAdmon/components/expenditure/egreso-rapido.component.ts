import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { AdministrationService } from 'app/services/administration.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { CustomersService } from 'app/services/customers.service';
import { EmployeesService } from 'app/services/employees.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { DetallesExpenditureComponent } from './detalles-expenditure.component';
import { ButtonCellRendererExpenditure2Component } from './button-cell-renderer-expenditure2.component';

@Component({
  selector: 'app-egreso-rapido',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, AgGridModule, DetallesExpenditureComponent,
    ButtonCellRendererExpenditure2Component],
  template: `
<div class="container-fluid px-2 px-md-3 py-3">

  <!-- Header -->
  <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
    <div>
      <h5 class="mb-0 fw-bold"><i class="bi bi-lightning-charge-fill text-warning me-2"></i>Egreso Rápido</h5>
      <small class="text-muted">Captura y consulta de egresos</small>
    </div>
    <div class="d-flex gap-2 align-items-center">
      <span class="badge bg-dark fs-6">{{ signalsService.getCompanyNameSmall()() || 'Sin empresa' }}</span>
      <button class="btn btn-sm btn-outline-secondary" (click)="formVisible = !formVisible">
        <i class="bi" [class.bi-chevron-up]="formVisible" [class.bi-chevron-down]="!formVisible"></i>
        {{ formVisible ? 'Ocultar Forma' : 'Nuevo Egreso' }}
      </button>
    </div>
  </div>

  <!-- FORM CARD -->
  <div class="card border-0 shadow-sm mb-3" *ngIf="formVisible">
    <div class="card-header bg-warning bg-opacity-10 border-0 py-2">
      <span class="fw-semibold"><i class="bi bi-plus-circle me-1 text-warning"></i>Captura Rápida</span>
    </div>
    <div class="card-body pb-2">

      <div class="row g-2">

        <!-- Cuenta bancaria -->
        <div class="col-12 col-md-6 col-lg-4">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-bank2 me-1 text-primary"></i>Cuenta Bancaria <span class="text-danger">*</span>
          </label>
          <ng-select
            [items]="bankAccounts"
            bindValue="id"
            bindLabel="nameAccount"
            [(ngModel)]="form.idAccount"
            placeholder="Selecciona cuenta..."
            [clearable]="false"
            [searchable]="true"
            notFoundText="Sin cuentas disponibles">
          </ng-select>
        </div>

        <!-- Fecha -->
        <div class="col-6 col-md-3 col-lg-2">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-calendar3 me-1 text-primary"></i>Fecha <span class="text-danger">*</span>
          </label>
          <input type="date" class="form-control form-control-sm" [(ngModel)]="form.date">
        </div>

        <!-- Tipo de gasto -->
        <div class="col-12 col-md-6 col-lg-4">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-tag me-1 text-primary"></i>Tipo de Gasto <span class="text-danger">*</span>
          </label>
          <ng-select
            [items]="tiposGasto"
            bindValue="id"
            [(ngModel)]="form.idExpend"
            placeholder="Selecciona tipo..."
            [clearable]="false"
            [searchable]="true">
            <ng-template ng-label-tmp let-item="item">{{ item.codigo }} - {{ item.nombre }}</ng-template>
            <ng-template ng-option-tmp let-item="item">{{ item.codigo }} - {{ item.nombre }}</ng-template>
          </ng-select>
        </div>

        <!-- Descripción -->
        <div class="col-12 col-md-6 col-lg-4">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-card-text me-1 text-primary"></i>Descripción <span class="text-danger">*</span>
          </label>
          <input type="text" class="form-control form-control-sm text-uppercase"
            [(ngModel)]="form.description" placeholder="Descripción del egreso..." maxlength="200">
        </div>

        <!-- Tipo beneficiario -->
        <div class="col-6 col-md-3 col-lg-2">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-people me-1 text-primary"></i>Tipo
          </label>
          <select class="form-select form-select-sm" [(ngModel)]="form.typeExpense" (ngModelChange)="onTipoChange()">
            <option value="PROVEEDORES">Proveedor</option>
            <option value="EMPLEADOS">Empleado</option>
            <option value="OTROS">Otros</option>
          </select>
        </div>

        <!-- Beneficiario -->
        <div class="col-12 col-md-6 col-lg-4">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-person me-1 text-primary"></i>
            {{ form.typeExpense === 'EMPLEADOS' ? 'Empleado' : form.typeExpense === 'PROVEEDORES' ? 'Proveedor' : 'Cuenta' }}
          </label>
          <ng-select
            [items]="beneficiariosList"
            bindValue="id"
            [(ngModel)]="form.idSpend"
            placeholder="Selecciona..."
            [clearable]="true"
            [searchable]="true">
            <ng-template ng-label-tmp let-item="item">{{ item.label }}</ng-template>
            <ng-template ng-option-tmp let-item="item">{{ item.label }}</ng-template>
          </ng-select>
        </div>

        <!-- Cantidad y Precio -->
        <div class="col-6 col-md-3 col-lg-2">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-hash me-1 text-primary"></i>Cantidad
          </label>
          <input type="number" class="form-control form-control-sm text-end"
            [(ngModel)]="form.quantity" min="0.01" step="0.01">
        </div>

        <div class="col-6 col-md-3 col-lg-2">
          <label class="form-label form-label-sm fw-semibold mb-1">
            <i class="bi bi-currency-dollar me-1 text-primary"></i>Precio
          </label>
          <input type="number" class="form-control form-control-sm text-end"
            [(ngModel)]="form.price" min="0" step="0.01" (ngModelChange)="recalcular()">
        </div>

        <!-- IVA + Totales -->
        <div class="col-6 col-md-2 col-lg-2 d-flex align-items-end pb-1">
          <div class="form-check form-switch ms-1">
            <input class="form-check-input" type="checkbox" id="switchIva"
              [(ngModel)]="form.iva" (ngModelChange)="recalcular()">
            <label class="form-check-label fw-semibold" for="switchIva">IVA 16%</label>
          </div>
        </div>

        <!-- Totales resumen -->
        <div class="col-12">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="badge bg-secondary">Subtotal: {{ subtotal | currency:'MXN':'symbol':'1.2-2' }}</span>
            <span class="badge bg-info text-dark">IVA: {{ ivaAmount | currency:'MXN':'symbol':'1.2-2' }}</span>
            <span class="badge bg-primary fs-6">Total: {{ total | currency:'MXN':'symbol':'1.2-2' }}</span>
          </div>
        </div>

        <!-- Botones -->
        <div class="col-12 d-flex gap-2 justify-content-end pt-1 pb-1">
          <button class="btn btn-sm btn-outline-secondary" (click)="limpiarForm()">
            <i class="bi bi-arrow-clockwise me-1"></i>Limpiar
          </button>
          <button class="btn btn-sm btn-success" (click)="guardarEgreso()" [disabled]="saving">
            <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>
            <i *ngIf="!saving" class="bi bi-floppy me-1"></i>
            {{ saving ? 'Guardando...' : 'Guardar Egreso' }}
          </button>
        </div>

      </div>
    </div>
  </div>

  <!-- GRID EGRESOS -->
  <div class="card border-0 shadow-sm">
    <div class="card-header border-0 py-2 d-flex align-items-center justify-content-between">
      <span class="fw-semibold"><i class="bi bi-table me-1 text-primary"></i>Egresos Registrados</span>
      <div class="d-flex gap-2 align-items-center">
        <ng-select
          [items]="bankAccounts"
          bindValue="id"
          bindLabel="nameAccount"
          [(ngModel)]="filtroIdAccount"
          placeholder="Filtrar cuenta..."
          [clearable]="true"
          [searchable]="false"
          (ngModelChange)="onFiltroChange()"
          style="min-width: 200px; font-size: 0.8rem;">
        </ng-select>
        <button class="btn btn-sm btn-outline-primary" (click)="recargar()" title="Recargar">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
    </div>
    <div class="card-body p-0">
      <ag-grid-angular
        class="ag-theme-quartz"
        style="width: 100%; height: 60vh;"
        [rowData]="incomes"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        [defaultColDef]="defaultColDef"
        [pagination]="true"
        [paginationPageSize]="20"
        (gridReady)="onGridReady($event)">
      </ag-grid-angular>
    </div>
  </div>

</div>
  `,
  styles: [`
    :host { display: block; }
    .form-label-sm { font-size: 0.78rem; }
    ng-select { font-size: 0.85rem; }
    @media (max-width: 576px) {
      .card-body { padding: 0.75rem !important; }
    }
  `]
})
export class EgresoRapidoComponent {

  signalsService     = inject(SignalsService);
  private iaeSvc     = inject(IncomesAndExpensesService);
  private adminSvc   = inject(AdministrationService);
  private catalogSvc = inject(CatalogadmonService);
  private ccSvc      = inject(CuentasContablesService);
  private custSvc    = inject(CustomersService);
  private empSvc     = inject(EmployeesService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // --- Estado ---
  idRoot    = 0;
  idBranch  = 0;
  formVisible = true;
  saving    = false;

  // --- Catálogos ---
  bankAccounts: any[]    = [];
  tiposGasto: any[]      = [];
  providers: any[]       = [];
  employees: any[]       = [];
  cuentasContables: any[]= [];

  // --- Grid ---
  gridApi!: GridApi;
  incomes: any[] = [];
  filtroIdAccount: number | null = null;
  private allIncomes: any[] = [];

  // --- Form ---
  form = this.emptyForm();
  subtotal  = 0;
  ivaAmount = 0;
  total     = 0;

  get beneficiariosList(): any[] {
    if (this.form.typeExpense === 'EMPLEADOS')
      return this.employees.map(e => ({ id: e.id, label: e.name }));
    if (this.form.typeExpense === 'PROVEEDORES')
      return this.providers.map(p => ({ id: p.id, label: p.name || p.company || p.nameContact }));
    return this.cuentasContables.map(c => ({ id: c.id, label: `${c.codigo} - ${c.nombre}` }));
  }

  constructor() {
    effect(async () => {
      this.idRoot   = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (!this.idRoot) return;
      await Promise.all([
        this.loadBankAccounts(),
        this.loadTiposGasto(),
        this.loadProviders(),
        this.loadEmployees(),
        this.loadCuentasContables(),
      ]);
      await this.loadIncomes();
    });
  }

  // ─── Cargas ───────────────────────────────────────────────────────────────

  private loadBankAccounts(): Promise<void> {
    return new Promise(resolve => {
      this.adminSvc.getAccountBanks(this.idRoot).subscribe({
        next: (data: any) => { this.bankAccounts = data || []; resolve(); },
        error: () => resolve()
      });
    });
  }

  private loadTiposGasto(): Promise<void> {
    return new Promise(resolve => {
      this.ccSvc.getHojas(this.idRoot).subscribe({
        next: (data: any) => {
          this.tiposGasto = (data || []).filter((c: any) => c.nivel === 2);
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  private loadProviders(): Promise<void> {
    return new Promise(resolve => {
      this.custSvc.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
        next: (data: any) => {
          this.providers = (data || []).map((p: any) => ({
            id: p.id, name: p.name || p.company || p.nameContact || 'Sin nombre'
          }));
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  private loadEmployees(): Promise<void> {
    return new Promise(resolve => {
      this.empSvc.getEmployees(-Math.abs(this.idRoot)).subscribe({
        next: (data: any) => {
          this.employees = (data || []).map((e: any) => ({ id: e.id, name: e.name }));
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  private loadCuentasContables(): Promise<void> {
    return new Promise(resolve => {
      this.ccSvc.getHojas(this.idRoot).subscribe({
        next: (data: any) => {
          this.cuentasContables = (data || []).filter((c: any) => c.nivel === 2);
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  private loadIncomes(): Promise<void> {
    return new Promise(resolve => {
      this.iaeSvc.getIncomesAndExpenses(this.idRoot).subscribe({
        next: (data: any) => {
          this.allIncomes = (data || [])
            .filter((i: any) => i.type === 'GASTO')
            .map((i: any) => ({
              ...i,
              countItems: i.countItems || i.countitems || 0,
              detailType: null
            }))
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          this.aplicarFiltro();
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  // ─── Grid ─────────────────────────────────────────────────────────────────

  defaultColDef: ColDef = {
    sortable: true, resizable: true, filter: true
  };

  colDefs: ColDef[] = [
    {
      field: 'countitems',
      headerName: '',
      width: 60,
      cellRenderer: ButtonCellRendererExpenditure2Component,
      cellRendererParams: { onClick: (node: any) => this.toggleDetalle(node) },
      valueGetter: p => p.data?.countItems || 0,
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textAlign: 'center' },
      pinned: 'left'
    },
    {
      field: 'date',
      headerName: 'Fecha',
      width: 110,
      valueFormatter: p => {
        if (!p.value) return '';
        const d = new Date(p.value);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      },
      sort: 'desc'
    },
    {
      field: 'description',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 150,
      cellStyle: { whiteSpace: 'normal', lineHeight: '1.3' }
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      type: 'numericColumn',
      valueFormatter: p => p.value != null ? (p.value as number).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '',
      cellStyle: p => ({ fontWeight: 'bold', color: p.value > 0 ? '#c0392b' : '#000' })
    },
    {
      field: 'status',
      headerName: 'Estatus',
      width: 110,
      cellRenderer: (p: ICellRendererParams) => {
        const map: any = {
          Pendiente: 'bg-primary', Pagada: 'bg-success',
          Cancelada: 'bg-danger', Entregada: 'bg-warning text-dark'
        };
        const cls = map[p.value] || 'bg-secondary';
        return `<span class="badge ${cls}">${p.value || ''}</span>`;
      }
    },
    {
      field: 'numberDocument',
      headerName: '# Doc',
      width: 100,
      hide: true
    }
  ];

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 38,
    masterDetail: true,
    detailRowHeight: 500,
    detailCellRenderer: DetallesExpenditureComponent,
    animateRows: true,
    getRowStyle: (p: any) => {
      if (!p.data) return {};
      const map: any = {
        Pendiente: '#cce5ff', Pagada: '#d4edda',
        Cancelada: '#f8d7da', Entregada: '#fff3cd'
      };
      return { backgroundColor: map[p.data.status] || '#fff' };
    },
    context: {
      componentParent: this,  // DetallesExpenditureComponent lee employees/providers/cuentasContables del componentParent
      CONCEPTS: {
        load: (id: number, cb: (data: any[]) => void) => {
          this.iaeSvc.getConceptsFromIncomesAndExpenses(id).subscribe({
            next: (d: any) => cb(d || []),
            error: () => cb([])
          });
        },
        updateCount: (id: number, count: number) => {
          const row = this.allIncomes.find(r => r.id === id);
          if (row) row.countItems = count;
        }
      }
    }
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  toggleDetalle(node: any) {
    node.setExpanded(!node.expanded);
  }

  aplicarFiltro() {
    this.incomes = this.filtroIdAccount
      ? this.allIncomes.filter(i => i.idAccount === this.filtroIdAccount)
      : [...this.allIncomes];
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.incomes);
  }

  onFiltroChange() { this.aplicarFiltro(); }

  async recargar() {
    await this.loadIncomes();
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  emptyForm() {
    return {
      idAccount:   null as number | null,
      date:        new Date().toLocaleDateString('en-CA'),
      idExpend:    null as number | null,
      description: '',
      typeExpense: 'PROVEEDORES',
      idSpend:     null as number | null,
      quantity:    1,
      price:       0,
      iva:         false
    };
  }

  onTipoChange() {
    this.form.idSpend = null;
  }

  recalcular() {
    this.subtotal  = (this.form.quantity || 0) * (this.form.price || 0);
    this.ivaAmount = this.form.iva ? Math.round(this.subtotal * 0.16 * 100) / 100 : 0;
    this.total     = this.subtotal + this.ivaAmount;
  }

  limpiarForm() {
    this.form = this.emptyForm();
    this.subtotal = this.ivaAmount = this.total = 0;
  }

  async guardarEgreso() {
    if (!this.form.idAccount)   { alerts.basicAlert('⚠️', 'Selecciona una cuenta bancaria', 'warning'); return; }
    if (!this.form.date)        { alerts.basicAlert('⚠️', 'Ingresa la fecha', 'warning'); return; }
    if (!this.form.idExpend)    { alerts.basicAlert('⚠️', 'Selecciona el tipo de gasto', 'warning'); return; }
    if (!this.form.description?.trim()) { alerts.basicAlert('⚠️', 'Ingresa una descripción', 'warning'); return; }
    if ((this.form.price || 0) <= 0)    { alerts.basicAlert('⚠️', 'Ingresa un precio válido', 'warning'); return; }

    this.recalcular();
    this.saving = true;

    const cabecera = {
      idAccount:    this.form.idAccount,
      idBusinnes:   this.idRoot,
      idBranch:     this.idBranch > 0 ? this.idBranch : null,
      date:         this.form.date,
      idExpend:     this.form.idExpend,
      description:  this.form.description.trim().toUpperCase(),
      subtotal:     this.subtotal,
      tax:          this.ivaAmount,
      total:        this.total,
      countitems:   1,
      status:       'Pendiente',
      type:         'GASTO',
      uuid:         'NA',
      createdBy:    localStorage.getItem('mail') || 'WEB',
      createdAt:    new Date().toISOString(),
      modifiedAt:   new Date().toISOString(),
      active:       true
    };

    try {
      const res: any = await lastValueFrom(this.iaeSvc.addIncomesAndExpenses(cabecera));
      const newId = res?.id || res;

      if (newId) {
        const concepto = {
          idIncorexp:    newId,
          typeexpense:   this.form.typeExpense,
          id_spend:      this.form.idSpend || 0,
          dateexpend:    this.form.date,
          quantity:      this.form.quantity,
          price:         this.form.price,
          iva:           this.form.iva,
          iva2:          this.ivaAmount,
          total:         this.total,
          description:   this.form.description.trim().toUpperCase(),
          comment:       'NA',
          active:        true
        };
        await lastValueFrom(this.iaeSvc.addConceptFromIncomesAndExpenses(concepto));
      }

      alerts.basicAlert('✅', 'Egreso guardado correctamente', 'success');
      this.limpiarForm();
      await this.loadIncomes();
    } catch (err) {
      console.error(err);
      alerts.basicAlert('❌', 'Error al guardar el egreso', 'error');
    } finally {
      this.saving = false;
    }
  }
}
