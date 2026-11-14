import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { UsersService } from 'app/services/users.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CobradoresCobranzaDetailComponent } from './cobradores-cobranza-detail.component';

@Component({
  selector: 'app-cobradores-cobranza',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <section class="card border-0 shadow-sm">
      <div class="card-body p-3 p-md-4">
        <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-4">
          <div><small class="text-primary fw-bold">COBRANZA</small><h4 class="mb-1">Cobradores</h4><small class="text-muted">Usuarios activos registrados en esta empresa.</small></div>
          <button class="btn btn-outline-primary btn-sm" type="button" (click)="refresh()" [disabled]="loading"><i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>
        </div>
        <div *ngIf="loading" class="text-center text-muted py-5" role="status"><span class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></span>Cargando cobradores…</div>
        <div *ngIf="error" class="alert alert-warning mb-0" role="alert"><i class="bi bi-exclamation-circle me-2"></i>{{ error }}</div>
        <div *ngIf="!loading && !error && users.length" class="grid-shell">
          <ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="width:100%;height: min(55vh, 520px);min-height:280px"
            [rowData]="users" [columnDefs]="columns" [defaultColDef]="defaultColDef" [localeText]="localeText" [gridOptions]="gridOptions">
          </ag-grid-angular>
        </div>
        <div *ngIf="!loading && !error && !users.length" class="empty-state text-center py-5 px-3">
          <i class="bi bi-person-badge fs-2 text-primary" aria-hidden="true"></i>
          <h6 class="mt-3 mb-1">No hay usuarios activos</h6>
          <p class="text-muted small mb-0">Los usuarios activos de la empresa aparecerán aquí.</p>
        </div>
      </div>
    </section>
  `,
  styles: [':host { display:block; } .card { border-radius:12px; } .grid-shell { overflow:hidden; border:1px solid #e5eaf0; border-radius:10px; } .empty-state { border:1px dashed #cbd8e6; border-radius:10px; background:#f8fbff; }']
})
export class CobradoresCobranzaComponent {
  private signalsService = inject(SignalsService);
  private usersService = inject(UsersService);
  private customersService = inject(CustomersService);
  private catalogsService = inject(CatalogsService);
  private refreshVersion = signal(0);

  users: any[] = [];
  loading = false;
  error = '';
  readonly localeText = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = { sortable: true, filter: true, floatingFilter: true, resizable: true, flex: 1, minWidth: 180, suppressHeaderMenuButton: true };
  readonly gridOptions: any = { animateRows: true, rowHeight: 38, masterDetail: true, detailRowHeight: 310, isRowMaster: (user: any) => (user?.cobros?.length || 0) > 0, detailCellRenderer: CobradoresCobranzaDetailComponent };
  readonly columns: ColDef[] = [
    { headerName: 'Nombre', valueGetter: params => params.data?.displayName || params.data?.usersmall || '', minWidth: 180 },
    { field: 'email', headerName: 'Correo', minWidth: 220 },
    { colId: 'detalleCobros', headerName: 'Pagos', valueGetter: params => `${params.data?.cobros?.length || 0} cobros · ver detalle`, cellRenderer: 'agGroupCellRenderer', cellRendererParams: { suppressCount: true }, minWidth: 190, sortable: false, filter: false },
    { headerName: 'Total cobrado', valueGetter: params => (params.data?.cobros || []).reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0), valueFormatter: params => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(params.value || 0)), minWidth: 150 }
  ];

  constructor() {
    effect(onCleanup => {
      const companyId = Number(this.signalsService.getRootSelectedBySidebar()()) || 0;
      this.refreshVersion();
      this.users = [];
      this.error = '';
      if (companyId <= 0) { this.loading = false; this.error = 'Selecciona una empresa para consultar sus cobradores.'; return; }

      this.loading = true;
      const subscription = forkJoin({
        users: this.usersService.get2fieldsUsers(companyId),
        loans: this.customersService.getCobranzaDashboard(companyId),
        paymentTypes: this.catalogsService.getCatalogsFromAdmon(companyId, 'COBRO_PAGO').pipe(catchError(() => of([])))
      }).pipe(
        switchMap(({ users, loans, paymentTypes }: any) => users?.status === false || !Array.isArray(loans)
          ? throwError(() => new Error('No se pudo consultar la lista de usuarios y cobros de la empresa.'))
          : of({ users: Array.isArray(users?.data) ? users.data : [], loans, paymentTypes }))
      ).subscribe({
        next: ({ users, loans, paymentTypes }) => {
          const paymentTypeNames = new Map<number, string>((paymentTypes || []).map((type: any) => [Number(type.id), type.description]));
          const paymentsByUser = new Map<number, any[]>();
          for (const loan of loans) {
            for (const installment of loan.cuotas || []) {
              for (const payment of installment.abonos || []) {
                if (payment.active === false || !payment.idUsuarioCobrador) continue;
                const userId = Number(payment.idUsuarioCobrador);
                const payments = paymentsByUser.get(userId) || [];
                payments.push({ ...payment, cliente: loan.cliente || `Cliente #${loan.idCustomer}`, prestamo: loan.id, cuota: installment.numeroCuota, tipoPago: paymentTypeNames.get(Number(payment.idTipoPago)) || '—', origen: payment.origenCobro === 'NEGOCIO' ? 'Caja del negocio' : 'Domicilio del cliente' });
                paymentsByUser.set(userId, payments);
              }
            }
          }
          this.users = users.map((user: any) => ({ ...user, cobros: (paymentsByUser.get(Number(user.id)) || []).sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago))) }))
            .sort((a: any, b: any) => String(a.displayName || a.usersmall || a.email || '').localeCompare(String(b.displayName || b.usersmall || b.email || ''), 'es'));
          this.loading = false;
        },
        error: error => { console.error('Error al cargar cobradores:', error); this.error = 'No se pudieron cargar los cobradores. Intenta actualizar.'; this.loading = false; }
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  refresh(): void { this.refreshVersion.update(value => value + 1); }
}
