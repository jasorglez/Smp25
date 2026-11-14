import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { firstValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { CortesCobranzaService } from 'app/services/cortes-cobranza.service';
import { SignalsService } from 'app/services/signals.service';
import { UsersService } from 'app/services/users.service';
import { StoresService } from 'app/services/stores.service';
import { CashRegistersService } from 'app/services/cash-registers.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-corte-caja-cobranza', standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
  <div class="p-3 bg-light">
    <div class="card shadow-sm border-0 mb-3" *ngIf="view === 'apertura' || activeTurn"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div><h5 class="mb-0"><i class="bi bi-cash-coin text-success me-2"></i>Caja de cobranza</h5><small class="text-muted">Apertura con tienda, caja registradora y fondo inicial.</small></div>
        <span *ngIf="activeTurn" class="badge text-bg-success">Turno abierto · {{ activeTurn.fondoInicial | currency:'MXN' }}</span>
      </div>
      <div *ngIf="!activeTurn" class="row g-2 align-items-end">
        <div class="col-md-3"><label class="form-label small">Tienda</label><select class="form-select form-select-sm" [(ngModel)]="storeId" (ngModelChange)="onStoreChange()"><option [ngValue]="null">Selecciona tienda</option><option *ngFor="let store of stores" [ngValue]="store.id">{{ store.description }}</option></select></div>
        <div class="col-md-3"><label class="form-label small">Caja registradora</label><select class="form-select form-select-sm" [(ngModel)]="cashRegisterId"><option [ngValue]="null">Selecciona caja</option><option *ngFor="let cash of cashRegisters" [ngValue]="cash.id">{{ cash.description }}</option></select></div>
        <div class="col-md-3"><label class="form-label small">Fondo inicial en efectivo</label><div class="input-group input-group-sm"><span class="input-group-text">$</span><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="fondoInicial"></div></div>
        <div class="col-md-3"><button class="btn btn-success btn-sm w-100" (click)="openCash()" [disabled]="saving || !storeId || !cashRegisterId || fondoInicial < 0"><i class="bi bi-unlock me-1"></i>Abrir caja</button></div>
      </div>
      <div *ngIf="activeTurn" class="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="small"><span class="me-3"><b>Tienda:</b> {{ storeName }}</span><span class="me-3"><b>Caja:</b> {{ cashName }}</span><span><b>Inicio:</b> {{ activeTurn.fechaInicio | date:'dd/MM/yyyy HH:mm' }}</span></div>
        <button class="btn btn-outline-danger btn-sm" (click)="closeCash()" [disabled]="saving"><i class="bi bi-door-closed me-1"></i>Cerrar turno y hacer corte</button>
      </div>
    </div></div>
    <div class="card shadow-sm border-0 mb-3" *ngIf="view !== 'apertura'"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><small class="text-primary fw-bold">COBRANZA</small><h4 class="mb-0">Corte de Caja</h4><small class="text-muted">Revisa los abonos recibidos y guarda una fotografía del corte.</small></div><button class="btn btn-outline-primary btn-sm" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise me-1"></i> Actualizar</button></div>
      <div class="row g-2 align-items-end"><div class="col-md-2"><label class="form-label small">Desde</label><input type="date" class="form-control form-control-sm" [(ngModel)]="desde"></div><div class="col-md-2"><label class="form-label small">Hasta</label><input type="date" class="form-control form-control-sm" [(ngModel)]="hasta"></div><div class="col-md-3"><label class="form-label small">Alcance</label><select class="form-select form-select-sm" [(ngModel)]="usuarioId"><option [ngValue]="null">Global · todos los cobradores</option><option *ngFor="let user of users" [ngValue]="user.id">{{ user.usersmall || user.displayName || user.email }}</option></select></div><div class="col-md-2"><button class="btn btn-primary btn-sm w-100" (click)="load()" [disabled]="loading"><i class="bi bi-search me-1"></i> Consultar</button></div><div class="col-md-3"><button class="btn btn-success btn-sm w-100" (click)="createCut()" [disabled]="saving || !canSave"><i class="bi bi-lock me-1"></i> Guardar corte</button></div></div>
    </div></div>
    <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
    <ng-container *ngIf="view !== 'apertura'"><div class="row g-3 mb-3"><div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-muted">Total recibido</small><h3 class="text-success mb-0">{{ summary?.total || 0 | currency:'MXN' }}</h3></div></div></div><div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-muted">Abonos registrados</small><h3 class="mb-0">{{ summary?.numeroPagos || 0 }}</h3></div></div></div><div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-muted">Alcance</small><h5 class="mb-0">{{ usuarioId ? userName(usuarioId) : 'Global' }}</h5></div></div></div></div>
    <div class="card border-0 shadow-sm mb-3"><div class="card-body"><h6>Totales por tipo de pago</h6><div class="d-flex flex-wrap gap-2"><span *ngFor="let item of typeTotals" class="badge text-bg-light border p-2">{{ item.name }}: {{ item.amount | currency:'MXN' }}</span><span *ngIf="!typeTotals.length" class="text-muted small">Sin movimientos en el período.</span></div></div></div>
    <div class="card border-0 shadow-sm mb-3"><div class="card-body"><div class="d-flex justify-content-between"><h6>Movimientos del período</h6><small class="text-muted">Selecciona fechas y alcance para revisar antes de cerrar</small></div><ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="height:360px;width:100%" [rowData]="summary?.movimientos || []" [columnDefs]="movementColumns" [defaultColDef]="defaultColDef" [localeText]="locale"></ag-grid-angular></div></div>
    <div class="card border-0 shadow-sm"><div class="card-body"><h6>Historial de cortes</h6><ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="height:250px;width:100%" [rowData]="history" [columnDefs]="historyColumns" [defaultColDef]="defaultColDef" [localeText]="locale"></ag-grid-angular></div></div></ng-container>
  </div>`,
  styles: [':host { display:block; } .card { border-radius: 12px; }']
})
export class CorteCajaCobranzaComponent {
  private service = inject(CortesCobranzaService);
  private signals = inject(SignalsService);
  private usersService = inject(UsersService);
  private storesService = inject(StoresService);
  private cashRegistersService = inject(CashRegistersService);
  private route = inject(ActivatedRoute);
  rootId = 0;
  view: 'apertura' | 'corte' = this.route.snapshot.data['view'] || 'corte';
  usuarioId: number | null = null;
  desde = this.today();
  hasta = this.today();
  summary: any = null;
  history: any[] = [];
  users: any[] = [];
  stores: any[] = [];
  cashRegisters: any[] = [];
  storeId: number | null = null;
  cashRegisterId: number | null = null;
  fondoInicial = 0;
  activeTurn: any = null;
  storeName = '';
  cashName = '';
  loading = false;
  saving = false;
  error = '';
  loadedKey = '';
  locale = AG_GRID_LOCALE_ES;
  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  movementColumns: ColDef[] = [
    { field: 'fechaPago', headerName: 'Fecha', valueFormatter: p => this.date(p.value), minWidth: 120 },
    { field: 'cliente', headerName: 'Cliente', minWidth: 200 },
    { field: 'idPrestamo', headerName: 'Préstamo', width: 110 },
    { field: 'tipoPago', headerName: 'Tipo de pago', minWidth: 150 },
    { field: 'idUsuarioCobrador', headerName: 'Cobrador', valueFormatter: p => this.userName(p.value), minWidth: 160 },
    { field: 'monto', headerName: 'Monto', valueFormatter: p => this.money(p.value), minWidth: 130 }
  ];
  historyColumns: ColDef[] = [
    { field: 'id', headerName: 'Id', width: 80 },
    { field: 'fechaDesde', headerName: 'Desde', valueFormatter: p => this.date(p.value) },
    { field: 'fechaHasta', headerName: 'Hasta', valueFormatter: p => this.date(p.value) },
    { field: 'idUsuarioCobrador', headerName: 'Alcance', valueFormatter: p => p.value ? this.userName(p.value) : 'Global' },
    { field: 'total', headerName: 'Total', valueFormatter: p => this.money(p.value) },
    { field: 'inicio', headerName: 'Registrado', valueFormatter: p => this.date(p.value) }
  ];
  get typeTotals(): {name: string; amount: number}[] { return Object.entries(this.summary?.porTipoPago || {}).map(([name, amount]) => ({ name, amount: Number(amount) })); }
  get canSave(): boolean { return !!this.summary?.numeroPagos && this.loadedKey === this.currentKey(); }
  constructor() { effect(() => { const rootId = Number(this.signals.getRootSelectedBySidebar()()); if (rootId && rootId !== this.rootId) { this.rootId = rootId; this.loadUsers(); this.loadStores(); this.loadActiveTurn(); if (this.view !== 'apertura') this.load(); } }); }
  private today(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  private date(value: any): string { return value ? String(value).slice(0,10).split('-').reverse().join('/') : ''; }
  private money(value: any): string { return new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(Number(value || 0)); }
  userName(id: number): string { if (!id) return 'Sin asignar'; const user = this.users.find(item => item.id === id); return user?.usersmall || user?.displayName || user?.email || `Usuario #${id}`; }
  private currentKey(): string { return `${this.rootId}|${this.desde}|${this.hasta}|${this.usuarioId ?? 'global'}`; }
  private get cashierTurnName(): string { return 'COBRANZA: ' + Number(this.signals.getIdUSer()()); }
  private loadUsers(): void { this.usersService.getDataUsers(this.rootId).subscribe({ next: (result: any) => this.users = result?.data || [], error: () => this.users = [] }); }
  private loadStores(): void { this.storesService.getStoreCompany(this.rootId).subscribe({ next: (items: any[]) => this.stores = (items || []).filter(item => item.active), error: () => this.stores = [] }); }
  onStoreChange(): void { const activeRegisterId = this.activeTurn?.idCashRegister; this.cashRegisterId = null; this.cashRegisters = []; if (!this.storeId) return; this.cashRegistersService.getCashRegisterList(this.storeId).subscribe({ next: (items: any[]) => { this.cashRegisters = (items || []).filter(item => item.active); if (activeRegisterId) this.cashRegisterId = activeRegisterId; }, error: () => this.cashRegisters = [] }); }
  private loadActiveTurn(): void {
    this.service.getTurnos(this.rootId).subscribe({
      next: (items: any[]) => {
        this.activeTurn = (items || []).filter(item => item.active && !item.fechaCierre && String(item.cajero || '') === this.cashierTurnName)
          .sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime())[0] || null;
        if (!this.activeTurn) return;
        this.cashRegisterId = this.activeTurn.idCashRegister;
        this.fondoInicial = this.activeTurn.fondoInicial || 0;
        this.desde = this.date(this.activeTurn.fechaInicio);
        this.cashRegistersService.getCashRegister(this.cashRegisterId).subscribe({
          next: (cash: any) => {
            this.cashName = cash?.description || '';
            this.storeId = cash?.idStore || cash?.id_store || null;
            if (this.storeId) this.storesService.getStore(this.storeId).subscribe({
              next: (store: any) => this.storeName = store?.description || '',
            });
            this.onStoreChange();
          },
        });
      },
      error: () => this.activeTurn = null,
    });
  }
  async openCash(): Promise<void> { if (!this.storeId || !this.cashRegisterId || this.fondoInicial < 0) return; this.saving = true; try { const result: any = await firstValueFrom(this.service.abrirTurno({ idCompany: this.rootId, idCashRegister: this.cashRegisterId, idBranch: Number(this.signals.getBranchSelectedBySidebar()()) || 0, cajero: this.cashierTurnName, fondoInicial: Number(this.fondoInicial || 0) })); this.activeTurn = result; this.loadActiveTurn(); this.desde = this.date(result.fechaInicio); if (this.view !== 'apertura') this.load(); alerts.basicAlert('Caja abierta', 'Se inició el turno de cobranza con el fondo registrado.', 'success'); } catch (error: any) { alerts.basicAlert('Error', typeof error?.error === 'string' ? error.error : error?.error?.error || 'No se pudo abrir la caja.', 'error'); } finally { this.saving = false; } }
  async closeCash(): Promise<void> { if (!this.activeTurn) return; const result = await alerts.inputAlert('Cerrar caja de cobranza', 'Captura el efectivo contado en la caja', 'text', String(this.fondoInicial), { inputAttributes: { inputmode: 'decimal', min: '0', step: '0.01' } }); if (!result.isConfirmed || result.value === '') return; const counted = Number(result.value); if (!Number.isFinite(counted) || counted < 0) return; const confirmation = await alerts.confirmAlert('Confirmar corte', `Se cerrará el turno de cobranza con ${this.money(counted)} en efectivo contado.`, 'warning', 'Sí, cerrar'); if (!confirmation.isConfirmed) return; this.saving = true; try { await firstValueFrom(this.service.cerrarTurno(this.activeTurn.id, counted, 'Corte de caja de cobranza')); alerts.basicAlert('Corte realizado', 'El turno de cobranza quedó cerrado.', 'success'); this.activeTurn = null; if (this.view !== 'apertura') this.load(); } catch (error: any) { alerts.basicAlert('Error', error?.error || 'No se pudo cerrar la caja.', 'error'); } finally { this.saving = false; } }
  load(): void {
    if (!this.rootId || !this.desde || !this.hasta || this.hasta < this.desde) { this.error = 'Selecciona un período válido.'; return; }
    this.loading = true; this.error = ''; this.loadedKey = '';
    const key = this.currentKey();
    this.service.getResumen(this.rootId, this.desde, this.hasta, this.usuarioId).subscribe({ next: result => { this.summary = result; this.loadedKey = key; this.loading = false; }, error: error => { console.error('Error al consultar el corte de Cobranza:', error); const detail = error?.error?.error || error?.error?.title; const status = error?.status ? ` (HTTP ${error.status})` : ''; this.error = detail ? `No se pudo consultar el corte${status}: ${detail}` : `No se pudo consultar el corte${status}.`; this.loading = false; } });
    this.service.getHistorial(this.rootId).subscribe({ next: result => this.history = result || [], error: error => console.error(error) });
  }
  async createCut(): Promise<void> {
    if (!this.canSave || this.saving) return;
    this.saving = true;
    try {
      const rootId = this.rootId, desde = this.desde, hasta = this.hasta, usuarioId = this.usuarioId;
      const latest: any = await firstValueFrom(this.service.getResumen(rootId, desde, hasta, usuarioId));
      if (!latest?.numeroPagos) { alerts.basicAlert('Sin movimientos', 'Ya no hay abonos en el período seleccionado.', 'info'); this.load(); return; }
      const confirmation = await alerts.confirmAlert('Guardar corte de caja', `Se registrarán ${latest.numeroPagos} abonos por ${this.money(latest.total)}. ¿Continuar?`, 'warning', 'Sí, guardar');
      if (!confirmation.isConfirmed) return;
      await firstValueFrom(this.service.create({ idRoot: rootId, idUsuarioCobrador: usuarioId, fechaDesde: desde, fechaHasta: hasta }));
      alerts.basicAlert('Corte guardado', 'El corte quedó registrado con el detalle de sus abonos.', 'success');
      this.load();
    }
    catch (error: any) { console.error(error); alerts.basicAlert('Error', error?.error?.error || 'No se pudo guardar el corte.', 'error'); }
    finally { this.saving = false; }
  }
}
