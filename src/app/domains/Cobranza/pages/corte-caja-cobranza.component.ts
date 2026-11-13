import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { firstValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { CortesCobranzaService } from 'app/services/cortes-cobranza.service';
import { SignalsService } from 'app/services/signals.service';
import { UsersService } from 'app/services/users.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-corte-caja-cobranza', standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
  <div class="p-3 bg-light">
    <div class="card shadow-sm border-0 mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><small class="text-primary fw-bold">COBRANZA</small><h4 class="mb-0">Corte de Caja</h4><small class="text-muted">Revisa los abonos recibidos y guarda una fotografía del corte.</small></div><button class="btn btn-outline-primary btn-sm" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise me-1"></i> Actualizar</button></div>
      <div class="row g-2 align-items-end"><div class="col-md-2"><label class="form-label small">Desde</label><input type="date" class="form-control form-control-sm" [(ngModel)]="desde"></div><div class="col-md-2"><label class="form-label small">Hasta</label><input type="date" class="form-control form-control-sm" [(ngModel)]="hasta"></div><div class="col-md-3"><label class="form-label small">Alcance</label><select class="form-select form-select-sm" [(ngModel)]="usuarioId"><option [ngValue]="null">Global · todos los cobradores</option><option *ngFor="let user of users" [ngValue]="user.id">{{ user.usersmall || user.displayName || user.email }}</option></select></div><div class="col-md-2"><button class="btn btn-primary btn-sm w-100" (click)="load()" [disabled]="loading"><i class="bi bi-search me-1"></i> Consultar</button></div><div class="col-md-3"><button class="btn btn-success btn-sm w-100" (click)="createCut()" [disabled]="saving || !canSave"><i class="bi bi-lock me-1"></i> Guardar corte</button></div></div>
    </div></div>
    <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
    <div class="row g-3 mb-3"><div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-muted">Total recibido</small><h3 class="text-success mb-0">{{ summary?.total || 0 | currency:'MXN' }}</h3></div></div></div><div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-muted">Abonos registrados</small><h3 class="mb-0">{{ summary?.numeroPagos || 0 }}</h3></div></div></div><div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-muted">Alcance</small><h5 class="mb-0">{{ usuarioId ? userName(usuarioId) : 'Global' }}</h5></div></div></div></div>
    <div class="card border-0 shadow-sm mb-3"><div class="card-body"><h6>Totales por tipo de pago</h6><div class="d-flex flex-wrap gap-2"><span *ngFor="let item of typeTotals" class="badge text-bg-light border p-2">{{ item.name }}: {{ item.amount | currency:'MXN' }}</span><span *ngIf="!typeTotals.length" class="text-muted small">Sin movimientos en el período.</span></div></div></div>
    <div class="card border-0 shadow-sm mb-3"><div class="card-body"><div class="d-flex justify-content-between"><h6>Movimientos del período</h6><small class="text-muted">Selecciona fechas y alcance para revisar antes de cerrar</small></div><ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="height:360px;width:100%" [rowData]="summary?.movimientos || []" [columnDefs]="movementColumns" [defaultColDef]="defaultColDef" [localeText]="locale"></ag-grid-angular></div></div>
    <div class="card border-0 shadow-sm"><div class="card-body"><h6>Historial de cortes</h6><ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="height:250px;width:100%" [rowData]="history" [columnDefs]="historyColumns" [defaultColDef]="defaultColDef" [localeText]="locale"></ag-grid-angular></div></div>
  </div>`,
  styles: [':host { display:block; } .card { border-radius: 12px; }']
})
export class CorteCajaCobranzaComponent {
  private service = inject(CortesCobranzaService);
  private signals = inject(SignalsService);
  private usersService = inject(UsersService);
  rootId = 0;
  usuarioId: number | null = null;
  desde = this.today();
  hasta = this.today();
  summary: any = null;
  history: any[] = [];
  users: any[] = [];
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
  constructor() { effect(() => { const rootId = Number(this.signals.getRootSelectedBySidebar()()); if (rootId && rootId !== this.rootId) { this.rootId = rootId; this.loadUsers(); this.load(); } }); }
  private today(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  private date(value: any): string { return value ? String(value).slice(0,10).split('-').reverse().join('/') : ''; }
  private money(value: any): string { return new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(Number(value || 0)); }
  userName(id: number): string { if (!id) return 'Sin asignar'; const user = this.users.find(item => item.id === id); return user?.usersmall || user?.displayName || user?.email || `Usuario #${id}`; }
  private currentKey(): string { return `${this.rootId}|${this.desde}|${this.hasta}|${this.usuarioId ?? 'global'}`; }
  private loadUsers(): void { this.usersService.getDataUsers(this.rootId).subscribe({ next: (result: any) => this.users = result?.data || [], error: () => this.users = [] }); }
  load(): void {
    if (!this.rootId || !this.desde || !this.hasta || this.hasta < this.desde) { this.error = 'Selecciona un período válido.'; return; }
    this.loading = true; this.error = ''; this.loadedKey = '';
    const key = this.currentKey();
    this.service.getResumen(this.rootId, this.desde, this.hasta, this.usuarioId).subscribe({ next: result => { this.summary = result; this.loadedKey = key; this.loading = false; }, error: error => { console.error(error); this.error = 'No se pudo consultar el corte.'; this.loading = false; } });
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
