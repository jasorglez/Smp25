import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StoresService } from 'app/services/stores.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { PosDbService } from 'app/services/pos-db.service';
import { PosSyncService } from 'app/services/pos-sync.service';
import { SignalsService } from 'app/services/signals.service';
import { CajeroTurnoService } from 'app/services/cajero-turno.service';

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
  private cajeroTurnoService = inject(CajeroTurnoService);

  stores: any[] = [];
  cashRegisters: any[] = [];
  selectedStoreId: number | null = null;
  selectedCashRegisterId: number | null = null;
  existingSession: any = null;
  pendingCount = 0;
  loading = false;
  errorMsg = '';

  // Nuevo turno
  fondoInicial: number = 0;
  cajeroNombre: string = '';

  // Cierre de turno
  showCierreModal = false;
  turnoResumen: any = null;
  loadingCierre = false;
  efectivoContado: number | null = null;
  notasCierre: string = '';

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
      // Crear turno en el servidor
      const turno = await firstValueFrom(
        this.cajeroTurnoService.createTurno({
          idCompany,
          idCashRegister: cashReg.id,
          idBranch,
          cajero: this.cajeroNombre || undefined,
          fondoInicial: this.fondoInicial || 0,
        })
      );

      const [products, clients] = await Promise.all([
        firstValueFrom(this.materialsService.getMaterialsForPosCache(idCompany)),
        firstValueFrom(this.customersService.getCustomersByCompany(idCompany, 'CUSTOMERS').pipe(catchError(() => of([])))),
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
        fondoInicial: this.fondoInicial || 0,
        idTurno: turno.id,
        cajero: this.cajeroNombre || undefined,
      });

      this.router.navigate(['/procsales/pos']);
    } catch (err) {
      console.error('Error al iniciar turno:', err);
      this.errorMsg = 'Error al descargar datos o crear turno. Verifica tu conexión.';
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
    const { idCompany } = this.existingSession;
    try {
      const [products, clients] = await Promise.all([
        firstValueFrom(this.materialsService.getMaterialsForPosCache(idCompany)),
        firstValueFrom(this.customersService.getCustomersByCompany(idCompany, 'CUSTOMERS').pipe(catchError(() => of([])))),
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

  /** Abre el modal de cierre cargando el resumen del turno */
  async openCierreModal() {
    if (!this.existingSession?.idTurno) {
      // Si no hay idTurno (sesión antigua sin turno registrado), cerrar directo
      await this.endSessionDirect();
      return;
    }
    this.loadingCierre = true;
    this.showCierreModal = true;
    this.efectivoContado = null;
    this.notasCierre = '';
    try {
      this.turnoResumen = await firstValueFrom(
        this.cajeroTurnoService.getTurno(this.existingSession.idTurno)
      );
    } catch {
      this.turnoResumen = null;
    } finally {
      this.loadingCierre = false;
    }
  }

  closeCierreModal() {
    this.showCierreModal = false;
    this.turnoResumen = null;
  }

  get efectivoEsperado(): number {
    if (!this.existingSession) return 0;
    return (this.existingSession.fondoInicial || 0);
  }

  get diferencia(): number {
    return (this.efectivoContado ?? 0) - this.efectivoEsperado;
  }

  async confirmarCierre() {
    if (this.efectivoContado === null) return;
    this.loadingCierre = true;
    try {
      if (this.existingSession?.idTurno) {
        await firstValueFrom(
          this.cajeroTurnoService.cerrarTurno(
            this.existingSession.idTurno,
            this.efectivoContado,
            this.notasCierre || undefined
          )
        );
      }
    } catch (err) {
      console.error('Error al cerrar turno:', err);
    } finally {
      this.loadingCierre = false;
    }
    await this.endSessionDirect();
  }

  private async endSessionDirect() {
    this.showCierreModal = false;
    await this.posDb.clearSession();
    this.existingSession = null;
    this.pendingCount = 0;
    this.turnoResumen = null;
    this.fondoInicial = 0;
    this.cajeroNombre = '';
    this.loadStores();
  }
}
