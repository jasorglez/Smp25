import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { PosDbService, PosSession } from 'app/services/pos-db.service';
import { PosSyncService } from 'app/services/pos-sync.service';
import { PosTicketService } from 'app/services/pos-ticket.service';
import { PosService } from 'app/services/pos.service';
import { MaterialsService } from 'app/services/materials.service';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
})
export class PosComponent implements OnInit {
  private posDb = inject(PosDbService);
  private posSync = inject(PosSyncService);
  private posTicket = inject(PosTicketService);
  private posService = inject(PosService);
  private materialsService = inject(MaterialsService);
  private customersService = inject(CustomersService);
  private router = inject(Router);

  session: PosSession | null = null;
  pendingCount = 0;
  isOnline = navigator.onLine;

  // Data
  clients: any[] = [];
  allProducts: any[] = [];
  productSearch = '';
  filteredProducts: any[] = [];
  idCustomer: number | null = null;
  lector = false;
  credit = false;
  paymentType: 'EFECTIVO' | 'CHEQUE' | 'VALES' | 'TARJETA' = 'EFECTIVO';

  // Celular para ventas al público
  phoneNumber = '';
  loyaltyAccount: { totalPoints: number } | null = null;
  loyaltyFactor = 0.10;
  loyaltyToast: { points: number; newTotal: number } | null = null;
  private loyaltyToastTimer: any = null;

  get isPublicSale(): boolean {
    const name = (this.selectedClient?.company ?? '').toUpperCase();
    return name.includes('PUBLICO') || name.includes('PÚBLICO');
  }

  get phoneValid(): boolean {
    if (!this.isPublicSale) return true;
    const p = this.phoneNumber.trim();
    return p.length === 0 || p.length === 10;
  }

  get pointsWillEarn(): number {
    return Math.round(this._total * this.loyaltyFactor * 100) / 100;
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
    this.phoneNumber = input.value;
    if (this.phoneNumber.length === 10 && this.session) {
      this.loadLoyaltyAccount();
    } else {
      this.loyaltyAccount = null;
    }
  }

  private async loadLoyaltyAccount() {
    if (!this.session) return;
    try {
      const result = await firstValueFrom(this.posService.getLoyaltyAccount(this.phoneNumber, this.session.idCompany));
      this.loyaltyAccount = result;
    } catch {
      this.loyaltyAccount = null;
    }
  }

  // Modal cambio (Efectivo)
  showChangeModal = false;
  pagoConAmount: number | null = null;

  get cambio(): number {
    if (this.pagoConAmount == null) return 0;
    return Math.max(0, this.pagoConAmount - this._total);
  }

  get pagoInsuficiente(): boolean {
    return this.pagoConAmount != null && this.pagoConAmount < this._total;
  }

  // Modal pago no-efectivo (Tarjeta / Cheque / Vales)
  showPaymentModal  = false;
  paymentReference  = '';
  paymentAmount: number | null = null;

  get paymentInsuficiente(): boolean {
    return this.paymentAmount != null && this.paymentAmount < this._total;
  }

  get paymentModalTitle(): string {
    return { TARJETA: 'Cobro con Tarjeta', CHEQUE: 'Cobro con Cheque', VALES: 'Cobro con Vale' }[this.paymentType] ?? 'Cobro';
  }

  get paymentModalIcon(): string {
    return { TARJETA: 'bi-credit-card text-primary', CHEQUE: 'bi-file-earmark-text text-warning', VALES: 'bi-ticket-perforated text-info' }[this.paymentType] ?? 'bi-cash';
  }

  get paymentReferenceLabel(): string {
    return { TARJETA: 'Últimos 4 dígitos / Referencia', CHEQUE: 'Número de cheque', VALES: 'Número / Folio de vale' }[this.paymentType] ?? 'Referencia';
  }

  get paymentReferencePlaceholder(): string {
    return { TARJETA: '**** **** **** 1234', CHEQUE: 'Ej. 001234', VALES: 'Ej. VALE-0001' }[this.paymentType] ?? '';
  }

  // Grid
  rowData: any[] = [];
  selectedRowData: any = null;
  private gridApi: GridApi;
  private tempId = 0;
  private _total = 0;

  // Grid config
  rowSelection: 'single' | 'multiple' = 'single';
  rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';
  paginationPageSize = 15;
  paginationPageSizeSelector = [15, 50, 100];

  get total() { return this._total; }

  get selectedClient(): any {
    return this.clients.find(c => c.id === this.idCustomer) ?? null;
  }

  async ngOnInit() {
    this.session = await this.posDb.getSession();
    if (!this.session) {
      this.router.navigate(['/procsales/before-pos']);
      return;
    }

    this.clients = (await this.posDb.getClients()).sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''));
    this.allProducts = await this.posDb.getProducts();
    this.filteredProducts = this.allProducts.slice(0, 50);
    this.pendingCount = await this.posDb.countPendingSales();

    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);

    // Cargar factor de puntos de fidelidad
    this.posService.getLoyaltyConfig(this.session.idCompany).subscribe({
      next: (cfg) => { this.loyaltyFactor = cfg.factorPuntos ?? 0.10; },
      error: () => {}
    });

    // Refresca catálogo en background si hay internet — sin bloquear al cajero
    if (navigator.onLine) this.refreshCatalogSilently();
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  private onOnline = () => {
    this.isOnline = true;
    this.posSync.syncPending().then(() => this.refreshPendingCount());
    this.refreshCatalogSilently();
  };
  private onOffline = () => { this.isOnline = false; };

  private async refreshCatalogSilently(): Promise<void> {
    if (!this.session) return;
    try {
      const [products, clients] = await Promise.all([
        firstValueFrom(this.materialsService.getMaterialsForPosCache(this.session.idCompany)),
        firstValueFrom(this.customersService.getCustomersByCompany(this.session.idCompany, 'CUSTOMERS')),
      ]);
      await this.posDb.saveProducts(products as any[]);
      await this.posDb.saveClients(clients as any[]);
      // Actualiza en memoria sin interrumpir la venta en curso
      this.allProducts = await this.posDb.getProducts();
      this.clients = (await this.posDb.getClients()).sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''));
      if (!this.productSearch) this.filteredProducts = this.allProducts.slice(0, 50);
    } catch {
      // Silencioso — si falla no hay que molestar al cajero
    }
  }

  async refreshPendingCount() {
    this.pendingCount = await this.posDb.countPendingSales();
  }

  onProductSearchChange(term: string) {
    this.productSearch = term;
    if (!term) { this.filteredProducts = this.allProducts.slice(0, 50); return; }
    const t = term.toLowerCase();
    this.filteredProducts = this.allProducts.filter(p =>
      (p.description && p.description.toLowerCase().includes(t)) ||
      (p.insumo && p.insumo.toLowerCase().includes(t)) ||
      (p.barCode && String(p.barCode).toLowerCase().includes(t)) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(t))
    ).slice(0, 50);
  }

  onProductSelect(product: any) {
    if (!product) return;
    if (this.idCustomer == null) {
      alerts.basicAlert('Error', 'Seleccione un cliente antes de agregar un producto.', 'error');
      return;
    }

    // price ya fue normalizado en getMaterialsForPosCache (ventaMN → price)
    const price = Number(product.price ?? product.ventaMN ?? product.sellingprice ?? 0);
    const existing = this.rowData.findIndex(r => r.idProduct === product.id);
    if (existing !== -1) {
      const updated = [...this.rowData];
      updated[existing] = {
        ...updated[existing],
        quantity: (updated[existing].quantity || 0) + 1,
        total: price * ((updated[existing].quantity || 0) + 1),
      };
      this.rowData = updated;
    } else {
      const id = `temp_${this.tempId++}`;
      this.rowData = [...this.rowData, {
        id, idProduct: product.id, quantity: 1,
        pu: price, total: price, unit: true,
        boxNumber: 0, unitNumber: 0, active: true,
      }];
    }
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.calculateTotal();
    // reset selector
    this.productSearch = '';
    this.filteredProducts = this.allProducts.slice(0, 50);
  }

  onClientChange(client: any) {
    this.idCustomer = client?.id ?? null;
    this.phoneNumber = '';
  }

  deleteRow() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Error', 'Seleccione una fila para eliminar.', 'error');
      return;
    }
    this.rowData = this.rowData.filter(r => r.id !== this.selectedRowData.id);
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.selectedRowData = null;
    this.calculateTotal();
  }

  printReceipt() {
    if (!this.session) return;
    if (this.rowData.length === 0) {
      alerts.basicAlert('Error', 'No hay productos en la venta.', 'error');
      return;
    }
    if (this.idCustomer == null) {
      alerts.basicAlert('Error', 'Seleccione un cliente.', 'error');
      return;
    }
    if (!this.phoneValid) {
      alerts.basicAlert('Celular inválido', 'El número de celular debe tener exactamente 10 dígitos.', 'warning');
      return;
    }
    if (this.paymentType === 'EFECTIVO') {
      this.pagoConAmount = null;
      this.showChangeModal = true;
      return;
    }
    this.paymentReference = '';
    this.paymentAmount    = this._total;
    this.showPaymentModal = true;
  }

  async confirmChange() {
    if (this.pagoInsuficiente) return;
    this.showChangeModal = false;
    await this.executeReceipt();
  }

  async confirmPayment() {
    if (this.paymentInsuficiente) return;
    this.showPaymentModal = false;
    await this.executeReceipt();
  }

  private async executeReceipt() {
    if (!this.session) return;

    // Capturar datos de loyalty antes de limpiar
    const hadPhone = this.isPublicSale && this.phoneNumber.trim().length === 10;
    const capturedAmount = this._total;
    const capturedPrevPoints = this.loyaltyAccount?.totalPoints ?? 0;

    const consecutive = await this.posDb.incrementConsecutive();
    const numbernote = `${this.session.prefix}-${String(consecutive).padStart(4, '0')}`;
    const localId = `${this.session.prefix}-${Date.now()}`;
    const date = new Date().toISOString();

    const sale = {
      localId,
      idCustomer: this.idCustomer,
      numbernote,
      date,
      lector: this.lector,
      credit: this.credit,
      amount: this._total,
      id_cashregister: this.session.idCashRegister,
      payment_type: this.paymentType,
      phone_number: this.isPublicSale && this.phoneNumber.trim() ? this.phoneNumber.trim() : null,
      id_company: this.session.idCompany,
      active: true,
    };

    const concepts = this.rowData.map((row, i) => {
      const prod = this.allProducts.find(p => p.id === row.idProduct);
      return {
        localId: `${localId}-c${i}`,
        localSaleId: localId,
        id_product: row.idProduct,
        description: prod?.description || prod?.insumo || '',
        quantity: row.quantity,
        pu: row.pu,
        total: Number(row.quantity) * Number(row.pu),
        unit: row.unit,
        boxnumber: row.boxNumber ?? 0,
        unitnumber: row.unitNumber ?? 0,
        active: true,
      };
    });

    await this.posDb.savePendingSale(sale, concepts);

    const client = this.selectedClient;
    const clientName = client?.company ?? `Cliente ${this.idCustomer}`;

    await this.posTicket.print(
      sale,
      concepts.map(c => ({ idProduct: c.id_product, description: c.description, quantity: c.quantity, pu: c.pu })),
      this.allProducts,
      clientName,
      this.session.storeName,
      this.session.cashRegisterDesc,
      this.paymentType,
      this.paymentReference || undefined,
      this.paymentType === 'EFECTIVO' ? (this.pagoConAmount ?? undefined) : undefined,
      this.session.idCompany,
    );

    this.pendingCount = await this.posDb.countPendingSales();

    // Intenta sincronizar en background si hay internet
    if (navigator.onLine) {
      this.posSync.syncPending().then(() => this.refreshPendingCount());
    }

    // Limpiar
    this.rowData = [];
    this.gridApi?.setGridOption('rowData', []);
    this._total = 0;
    this.idCustomer = null;
    this.phoneNumber = '';
    this.loyaltyAccount = null;
    this.paymentType = 'EFECTIVO';

    // Mostrar toast de puntos ganados
    if (hadPhone) {
      const pointsEarned = Math.round(capturedAmount * this.loyaltyFactor * 100) / 100;
      this.loyaltyToast = { points: pointsEarned, newTotal: capturedPrevPoints + pointsEarned };
      clearTimeout(this.loyaltyToastTimer);
      this.loyaltyToastTimer = setTimeout(() => { this.loyaltyToast = null; }, 6000);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.addEventListener('selectionChanged', () => {
      const rows = this.gridApi.getSelectedRows();
      this.selectedRowData = rows.length > 0 ? rows[0] : null;
    });
    this.gridApi.addEventListener('cellValueChanged', () => this.calculateTotal());
  }

  private calculateTotal() {
    this._total = this.rowData.reduce((sum, r) =>
      sum + (Number(r.quantity) || 0) * (Number(r.pu) || 0), 0);
  }

  formatCurrency(v: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
  }

  get colMaster(): ColDef[] {
    return [
      { field: 'id', hide: true },
      {
        field: 'idProduct',
        headerName: 'Producto',
        flex: 3,
        editable: false,
        valueFormatter: p => {
          const prod = this.allProducts.find(x => x.id === p.value);
          return prod ? (prod.description || prod.insumo || `#${p.value}`) : String(p.value ?? '');
        },
      },
      {
        field: 'quantity', headerName: 'Cantidad', flex: 1, editable: true,
        type: 'numericColumn', valueParser: p => Number(p.newValue),
      },
      {
        field: 'pu', headerName: 'Precio Unitario', flex: 1, editable: true,
        valueFormatter: p => this.formatCurrency(p.value),
      },
      {
        field: 'total', headerName: 'Total', flex: 1, editable: false,
        valueGetter: p => (Number(p.data.quantity) || 0) * (Number(p.data.pu) || 0),
        valueFormatter: p => this.formatCurrency(p.value),
      },
      { field: 'unit', headerName: '¿Menudeo?', flex: 1, editable: true, cellDataType: 'boolean' },
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    onRowClicked: (event: any) => event.node.setSelected(true),
  };
}
