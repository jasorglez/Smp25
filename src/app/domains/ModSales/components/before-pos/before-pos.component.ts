import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';
import { StoresService } from 'app/services/stores.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { PosDbService } from 'app/services/pos-db.service';
import { PosSyncService } from 'app/services/pos-sync.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-before-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './before-pos.component.html',
})
export class BeforePosComponent implements OnInit {
  private router = inject(Router);
  private storesService = inject(StoresService);
  private cashRegistersService = inject(CashRegistersService);
  private customersService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  private posDb = inject(PosDbService);
  private posSync = inject(PosSyncService);
  private signalsService = inject(SignalsService);

  stores: any[] = [];
  cashRegisters: any[] = [];
  selectedStoreId: number | null = null;
  selectedCashRegisterId: number | null = null;
  existingSession: any = null;
  pendingCount = 0;
  loading = false;
  errorMsg = '';

  async ngOnInit() {
    this.existingSession = await this.posDb.getSession();
    this.pendingCount = await this.posDb.countPendingSales();
    if (!this.existingSession) {
      this.loadStores();
    }
  }

  private loadStores() {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.storesService.getStoreCompany(idCompany).subscribe({
      next: (data: any[]) => this.stores = data.filter(s => s.active),
      error: () => this.errorMsg = 'No se pudieron cargar las tiendas.',
    });
  }

  onStoreChange(store: any) {
    this.selectedCashRegisterId = null;
    this.cashRegisters = [];
    if (!store) return;
    this.cashRegistersService.getCashRegisterList(store.id).subscribe({
      next: (data: any[]) => this.cashRegisters = data.filter(c => c.active),
    });
  }

  async startSession() {
    if (!this.selectedStoreId || !this.selectedCashRegisterId) return;
    this.loading = true;
    this.errorMsg = '';

    const store = this.stores.find(s => s.id === this.selectedStoreId);
    const cashReg = this.cashRegisters.find(c => c.id === this.selectedCashRegisterId);
    const prefix = cashReg.description.replace(/\s+/g, '').toUpperCase();
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = this.signalsService.getBranchSelectedBySidebar()();

    try {
      const clientsObs = idBranch < 0
        ? this.customersService.getCustomersByCompany(idCompany, 'CUSTOMERS')
        : this.customersService.getCustomers(idBranch, 'CUSTOMERS');

      const [products, clients] = await Promise.all([
        firstValueFrom(this.materialsService.getMaterialsForPosCache(idCompany)),
        firstValueFrom(clientsObs),
      ]);

      await this.posDb.saveProducts(products as any[]);
      await this.posDb.saveClients(clients as any[]);
      await this.posDb.saveSession({
        idStore: store.id,
        storeName: store.description,
        idCashRegister: cashReg.id,
        cashRegisterDesc: cashReg.description,
        prefix,
        consecutive: 0,
        idCompany,
        idBranch,
        startedAt: new Date().toISOString(),
      });

      this.router.navigate(['/procsales/pos']);
    } catch (err) {
      console.error('Error al iniciar turno:', err);
      this.errorMsg = 'Error al descargar datos. Verifica tu conexión.';
    } finally {
      this.loading = false;
    }
  }

  continueSession() {
    this.router.navigate(['/procsales/pos']);
  }

  async refreshCatalog() {
    if (!this.existingSession) return;
    this.loading = true;
    this.errorMsg = '';
    const { idCompany, idBranch } = this.existingSession;
    try {
      const clientsObs = idBranch < 0
        ? this.customersService.getCustomersByCompany(idCompany, 'CUSTOMERS')
        : this.customersService.getCustomers(idBranch, 'CUSTOMERS');

      const [products, clients] = await Promise.all([
        firstValueFrom(this.materialsService.getMaterialsForPosCache(idCompany)),
        firstValueFrom(clientsObs),
      ]);
      await this.posDb.saveProducts(products as any[]);
      await this.posDb.saveClients(clients as any[]);
    } catch (err) {
      this.errorMsg = 'Error al actualizar catálogo. Verifica tu conexión.';
    } finally {
      this.loading = false;
    }
  }

  async syncNow() {
    await this.posSync.syncPending();
    this.pendingCount = await this.posDb.countPendingSales();
  }

  async endSession() {
    await this.posDb.clearSession();
    this.existingSession = null;
    this.pendingCount = 0;
    this.loadStores();
  }
}
