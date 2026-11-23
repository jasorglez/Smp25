import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { CustomersService } from 'app/services/customers.service';
import { CobranzaOfflineService } from 'app/services/cobranza-offline.service';
import { CobranzaOfflineStoreService } from 'app/services/cobranza-offline-store.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { StoresService } from 'app/services/stores.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { UsersService } from 'app/services/users.service';
import { CortesCobranzaService } from 'app/services/cortes-cobranza.service';
import { firstValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { CobranzaOfflineSyncService } from 'app/services/cobranza-offline-sync.service';
import { BranchsService } from 'app/services/branchs.service';
import { InegiService } from 'app/services/inegi.service';

@Component({
  selector: 'app-cobranza',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="col-md-12"><div class="card">
      <div class="alert mb-0 rounded-0 d-flex align-items-center justify-content-between gap-2 flex-wrap"
        [class.alert-warning]="offline.isOffline" [class.alert-info]="!offline.isOffline && offline.pendingCount() === 0"
        [class.alert-primary]="!offline.isOffline && offline.pendingCount() > 0" role="status">
        <div>
          <strong><i class="bi me-1" [class.bi-wifi-off]="offline.isOffline" [class.bi-wifi]="!offline.isOffline"></i>
            {{ offline.isOffline ? 'Cobranza sin conexión' : 'Cobranza en línea' }}</strong>
          <span class="ms-2 small" *ngIf="offline.lastSyncAt()">Última preparación: {{ offline.lastSyncAt() | date:'short' }}</span>
          <span class="ms-2 small" *ngIf="offline.pendingCount()">{{ offline.pendingCount() }} movimiento(s) local(es) pendiente(s) de sincronizar.</span>
          <span class="ms-2 small text-danger" *ngIf="offline.syncError()">{{ offline.syncError() }}</span>
          <span class="ms-2 small" *ngIf="offline.preparationProgress()">{{ offline.preparationProgress() }}</span>
        </div>
        <button *ngIf="!offline.isOffline" class="btn btn-sm btn-outline-primary" (click)="prepareOffline()" [disabled]="preparingOffline">
          <span *ngIf="preparingOffline" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!preparingOffline" class="bi bi-cloud-download me-1"></i>
          {{ preparingOffline ? 'Preparando…' : 'Preparar esta caja offline' }}
        </button>
        <button *ngIf="!offline.isOffline && offline.pendingCount() > 0" class="btn btn-sm btn-primary" (click)="syncNow()" [disabled]="syncingOffline">
          <span *ngIf="syncingOffline" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!syncingOffline" class="bi bi-arrow-repeat me-1"></i>Sincronizar pendientes
        </button>
      </div>
      <div class="card-header px-2"><ul class="nav nav-pills">
        <li class="nav-item" *ngFor="let item of menuItems(); trackBy: trackMenuItem" [style.order]="item.order">
          <a class="nav-link green-tab" [routerLink]="item.path" routerLinkActive="active"><i class="bi" [ngClass]="item.icon"></i><span>{{ item.name }}</span></a>
        </li>
      </ul></div>
      <router-outlet></router-outlet>
    </div></div>
  `,
  styleUrl: '../../ModSales/pages/procsales/procsales.component.scss'
})
export class CobranzaComponent {
  authService = inject(AuthService);
  readonly offline = inject(CobranzaOfflineService);
  private offlineStore = inject(CobranzaOfflineStoreService);
  private customers = inject(CustomersService);
  private signals = inject(SignalsService);
  private catalogs = inject(CatalogsService);
  private stores = inject(StoresService);
  private cashRegisters = inject(CashRegistersService);
  private users = inject(UsersService);
  private cashCuts = inject(CortesCobranzaService);
  private offlineSync = inject(CobranzaOfflineSyncService);
  private branches = inject(BranchsService);
  private inegi = inject(InegiService);
  preparingOffline = false;
  syncingOffline = false;

  constructor() {
    const companyId = Number(localStorage.getItem('company') || 0);
    if (companyId) void this.offline.refreshPendingCount(companyId);
  }

  private readonly menuRoutes: Record<string, string> = {
    cliente: 'clientes',
    cobr: 'cobradores',
    cortecaja: 'corte-caja',
    aperturas: 'apertura-caja'
  };

  private readonly menuIcons: Record<string, string> = {
    cliente: 'bi-people',
    cobr: 'bi-person-badge',
    dashboard: 'bi-speedometer2',
    cortecaja: 'bi-calculator',
    aperturas: 'bi-unlock',
    cajas: 'bi-cash-stack'
  };

  readonly menuItems = computed((): { identifier: string; name: string; order: number; path: string; icon: string }[] => {
    const children = this.authService.getUserPermissions()?.cobranzas?.children || {};
    return Object.entries(children)
      .filter(([, permission]: [string, any]) => permission?.active === true)
      .map(([identifier, permission]: [string, any]) => ({
        identifier,
        name: permission.permissionName || permission.description || identifier,
        order: Number.isFinite(Number(permission.order)) ? Number(permission.order) : 10000,
        path: this.menuRoutes[identifier] || identifier,
        icon: this.menuIcons[identifier] || 'bi-grid'
      }))
      .sort((a, b) => a.order - b.order);
  });

  trackMenuItem(_index: number, item: { identifier: string }): string {
    return item.identifier;
  }

  async syncNow(): Promise<void> {
    if (this.syncingOffline || this.offline.isOffline) return;
    this.syncingOffline = true;
    try {
      const companyId = Number(localStorage.getItem('company') || 0);
      await this.offlineSync.retryFailed(companyId);
      await this.offline.refreshPendingCount(companyId);
      if (this.offline.pendingCount() === 0) alerts.basicAlert('Sincronización lista', 'Los movimientos locales de Cobranza ya se enviaron al servidor.', 'success');
      else alerts.basicAlert('Sincronización pendiente', 'Algunas operaciones requieren atención. Revisa el estado de conexión y vuelve a intentar.', 'warning');
    } finally { this.syncingOffline = false; }
  }

  async prepareOffline(): Promise<void> {
    if (this.preparingOffline || !navigator.onLine) return;
    const companyId = Number(this.signals.getRootSelectedBySidebar()() || localStorage.getItem('company') || 0);
    const branchId = Number(this.signals.getBranchSelectedBySidebar()() || localStorage.getItem('branch') || 0);
    if (!companyId || !branchId) {
      alerts.basicAlert('No se pudo preparar', 'Selecciona la empresa y sucursal de la caja antes de descargar Cobranza.', 'warning');
      return;
    }
    this.preparingOffline = true;
    const failures: string[] = [];
    const safeCache = async (label: string, key: string, category: string, load: () => Promise<any>): Promise<any> => {
      try {
        const value = await load();
        await this.offlineStore.saveSnapshot({ key, companyId, category, value });
        return value;
      } catch (error) {
        console.warn(`No se pudieron preparar datos offline (${label}):`, error);
        failures.push(label);
        return null;
      }
    };
    const collection = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items : [];
    try {
      this.offline.preparationProgress.set('Descargando pantallas de Cobranza para esta caja…');
      const screenLoads = await Promise.allSettled([
        import('../components/clientes-cobranzas/clientes-cobranzas.component'),
        import('./cobranza-dashboard.component'),
        import('./corte-caja-cobranza.component'),
        import('./cobradores-cobranza.component'),
        import('app/domains/SMP/Components/cashRegisters/cashRegisters.component')
      ]);
      if (screenLoads.some(result => result.status === 'rejected')) failures.push('pantallas de Cobranza');

      this.offline.preparationProgress.set('Descargando clientes de la empresa y sucursal…');
      const [companyCustomersResponse, branchCustomersResponse, dashboard] = await Promise.all([
        safeCache('clientes de la empresa', this.offline.snapshotKey('customers-company', companyId, 'CUSTOMERS'), 'clientes', () => firstValueFrom(this.customers.getCustomersByCompany(companyId, 'CUSTOMERS'))),
        safeCache('clientes de la sucursal', this.offline.snapshotKey('customers-branch', companyId, branchId, 'CUSTOMERS'), 'clientes', () => firstValueFrom(this.customers.getCobranzaCustomersByBranch(branchId, companyId, 'CUSTOMERS'))),
        safeCache('resumen de préstamos', this.offline.snapshotKey('dashboard', companyId), 'préstamos', () => firstValueFrom(this.customers.getCobranzaDashboard(companyId)))
      ]);
      const allCustomers = collection(companyCustomersResponse);
      const branchCustomers = collection(branchCustomersResponse);
      const customers = [...new Map([...allCustomers, ...branchCustomers].map(customer => [Number(customer.id), customer])).values()]
        .filter(customer => Number.isFinite(Number(customer.id)) && Number(customer.id) > 0);
      if (!customers.length) failures.push('clientes de Cobranza');

      await Promise.all([
        safeCache('sucursales', this.offline.snapshotKey('branches', companyId), 'sucursales', () => firstValueFrom(this.branches.getBrancheswoa(companyId))),
        safeCache('tipos de cliente', this.offline.snapshotKey('catalog', companyId, 'TIPO-CLIENTE'), 'catálogos', () => firstValueFrom(this.catalogs.getCatalogsFromAdmon(companyId, 'TIPO-CLIENTE'))),
        safeCache('estados', this.offline.snapshotKey('mexico-states', companyId), 'catálogos', () => firstValueFrom(this.inegi.getEstados()))
      ]);

      for (let index = 0; index < customers.length; index++) {
        const customer = customers[index];
        this.offline.preparationProgress.set(`Descargando préstamos y pagos (${index + 1}/${customers.length})…`);
        await safeCache(`préstamo ${customer.id}`, this.offline.snapshotKey('loans-customer', companyId, customer.id), 'préstamos', () => firstValueFrom(this.customers.getCobranzaLoans(Number(customer.id))));
        await safeCache(`pagos ${customer.id}`, this.offline.snapshotKey('payments-customer', companyId, customer.id), 'pagos', () => firstValueFrom(this.customers.getCobranzaPayments(Number(customer.id))));
      }

      this.offline.preparationProgress.set('Descargando caja, catálogos y usuarios…');
      const [paymentTypes, stores, turns, collectorUsers, cashUsers] = await Promise.all([
        safeCache('tipos de pago', this.offline.snapshotKey('payment-types', companyId), 'catálogos', () => firstValueFrom(this.catalogs.getCatalogsFromAdmon(companyId, 'COBRO_PAGO'))),
        safeCache('tiendas', this.offline.snapshotKey('stores', companyId), 'caja', () => firstValueFrom(this.stores.getStoreCompany(companyId))),
        safeCache('turnos de caja', this.offline.snapshotKey('cash-turns', companyId), 'caja', () => firstValueFrom(this.cashCuts.getTurnos(companyId))),
        safeCache('cobradores y responsables', this.offline.snapshotKey('collector-users', companyId), 'usuarios', () => firstValueFrom(this.users.get2fieldsUsers(companyId))),
        safeCache('usuarios de caja', this.offline.snapshotKey('cash-users', companyId), 'usuarios', () => firstValueFrom(this.users.getDataUsers(companyId)))
      ]);
      await Promise.all([
        safeCache('cajas registradoras de la empresa', this.offline.snapshotKey('cash-registers-company', companyId), 'caja', () => firstValueFrom(this.cashRegisters.getCashRegisterByCompany(companyId))),
        safeCache('cajas registradoras de la sucursal', this.offline.snapshotKey('cash-registers-branch', companyId, branchId), 'caja', () => firstValueFrom(this.cashRegisters.getCashRegisterByBranch(branchId))),
        safeCache('tiendas de la sucursal', this.offline.snapshotKey('stores-branch', companyId, branchId), 'caja', () => firstValueFrom(this.stores.getStoreList(branchId)))
      ]);
      for (const store of collection(stores).filter(item => item.active !== false)) {
        const storeId = Number(store.id || store.idStore || store.id_store);
        if (!storeId) continue;
        await this.offlineStore.saveSnapshot({ key: this.offline.snapshotKey('store', companyId, storeId), companyId, category: 'caja', value: store });
        const registers = await safeCache(`cajas de tienda ${storeId}`, this.offline.snapshotKey('cash-registers', companyId, storeId), 'caja', () => firstValueFrom(this.cashRegisters.getCashRegisterList(storeId)));
        for (const register of collection(registers)) {
          const registerId = Number(register.id || register.idCashRegister || register.id_cash_register);
          if (registerId) await this.offlineStore.saveSnapshot({ key: this.offline.snapshotKey('cash-register', companyId, registerId), companyId, category: 'caja', value: register });
        }
      }
      await safeCache('manifest de preparación', this.offline.snapshotKey('prepared', companyId, branchId), 'preparación', async () => ({
        companyId, branchId, customerCount: customers.length, loanSummaryCount: collection(dashboard).length,
        paymentTypeCount: collection(paymentTypes).length, storeCount: collection(stores).length,
        turnCount: collection(turns).length, preparedAt: new Date().toISOString()
      }));
      await this.offline.markSnapshotSynced();
      await this.offline.refreshPendingCount(companyId);
      alerts.basicAlert(failures.length ? 'Preparación incompleta' : 'Caja preparada', failures.length
        ? `Se guardaron los datos disponibles; faltó preparar: ${[...new Set(failures)].join(', ')}.`
        : `Se guardaron ${customers.length} clientes, sus préstamos y los catálogos de Cobranza para esta computadora.`, failures.length ? 'warning' : 'success');
    } catch (error) {
      console.error('No se pudo preparar Cobranza para trabajar offline:', error);
      alerts.basicAlert('Error', 'No se pudo preparar la información local de Cobranza.', 'error');
    } finally {
      this.preparingOffline = false;
      this.offline.preparationProgress.set('');
    }
  }
}

@Component({
  selector: 'app-cobranza-en-construccion',
  standalone: true,
  template: `<div class="card-body"><h5>{{ title }}</h5><p>En construcción</p></div>`
})
export class CobranzaEnConstruccionComponent {
  title = inject(ActivatedRoute).snapshot.data['title'];
}
