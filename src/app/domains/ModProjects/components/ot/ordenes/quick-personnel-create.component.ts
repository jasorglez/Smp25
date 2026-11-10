import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, forkJoin, timeout } from 'rxjs';
import { BranchsService } from 'app/services/branchs.service';
import { EmployeesService } from 'app/services/employees.service';
import { RolesService } from 'app/services/roles.service';

@Component({
  selector: 'app-quick-personnel-create', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <form #form="ngForm" (ngSubmit)="save()">
      <div class="modal-header"><h5 class="modal-title">Nuevo personal</h5>
        <button type="button" class="btn-close" aria-label="Cerrar" [disabled]="saving" (click)="modal.dismiss()"></button></div>
      <div class="modal-body">
        <div *ngIf="error" class="alert alert-warning" role="alert">{{ error }}</div>
        <button *ngIf="loadFailed" type="button" class="btn btn-outline-secondary" (click)="load()">Reintentar carga</button>
        <fieldset [disabled]="loading || loadFailed || saving || attempted">
          <label for="person-name">Nombre *</label>
          <input id="person-name" name="name" class="form-control mb-2" [(ngModel)]="name" maxlength="150" required>
          <label for="person-branch">Sucursal *</label>
          <select id="person-branch" name="branch" class="form-select mb-2" [(ngModel)]="branchId" required>
            <option value="">Seleccionar sucursal</option><option *ngFor="let row of branches" [value]="row.id">{{ row.name || row.description }}</option></select>
          <label for="person-code">Usuario (o captura un correo)</label>
          <input id="person-code" name="code" class="form-control mb-2" [(ngModel)]="code" maxlength="20">
          <label for="person-email">Correo (o captura un usuario)</label>
          <input id="person-email" name="email" type="email" email class="form-control mb-2" [(ngModel)]="email" maxlength="50">
          <label for="person-department">Departamento *</label>
          <select id="person-department" name="department" class="form-select mb-2" [(ngModel)]="departmentId" (ngModelChange)="loadPositions()" required>
            <option value="">Seleccionar departamento</option><option *ngFor="let row of departments" [value]="row.id">{{ row.description || row.name }}</option></select>
          <label for="person-position">Puesto *</label>
          <select id="person-position" name="position" class="form-select mb-2" [(ngModel)]="positionId" [disabled]="positionsLoading" required>
            <option value="">{{ positionsLoading ? 'Cargando puestos…' : 'Seleccionar puesto' }}</option><option *ngFor="let row of positions" [value]="row.id">{{ row.description }}</option></select>
          <label for="person-rate">Tarifa por hora *</label>
          <input id="person-rate" name="rate" type="number" min="0" step="0.01" class="form-control" [(ngModel)]="rate" required>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" [disabled]="saving" (click)="modal.dismiss()">Cancelar</button>
        <button class="btn btn-success" type="submit" [disabled]="loading || loadFailed || positionsLoading || saving || (!attempted && !form.valid)">{{ saving ? 'Guardando…' : attempted ? 'Recuperar registro creado' : 'Guardar y seleccionar' }}</button>
      </div>
    </form>`
})
export class QuickPersonnelCreateComponent implements OnInit {
  modal = inject(NgbActiveModal);
  private employees = inject(EmployeesService);
  private branchesService = inject(BranchsService);
  private roles = inject(RolesService);
  companyId = 0;
  branchId: number | string = '';
  name = ''; code = ''; email = ''; departmentId = ''; positionId = ''; rate = 80;
  branches: any[] = []; departments: any[] = []; positions: any[] = [];
  loading = false; loadFailed = false; positionsLoading = false; saving = false; attempted = false; error = '';
  private beforeIds = new Set<number>();
  private payload: any;
  private savedPosition: any;
  private positionRequest = 0;
  ngOnInit(): void { this.load(); }
  private rows(response: any): any[] {
    const rows = Array.isArray(response) ? response : response?.data;
    if (!Array.isArray(rows)) throw new Error('Listado inválido');
    return rows;
  }
  private async list(): Promise<any[]> {
    return this.rows(await firstValueFrom(this.employees.getEmployees(-this.companyId).pipe(timeout(30000))));
  }
  async load(): Promise<void> {
    this.loading = true; this.loadFailed = false; this.error = '';
    try {
      if (!(this.companyId > 0)) throw new Error('Empresa requerida');
      const data = await firstValueFrom(forkJoin({ branches: this.branchesService.getBranches2fields(this.companyId),
        departments: this.roles.getCatalogRoles(this.companyId) }).pipe(timeout(30000)));
      this.branches = this.rows(data.branches).filter(row => row.active !== false);
      this.departments = this.rows(data.departments).filter(row => row.active !== false);
      if (!this.branches.some(row => Number(row.id) === Number(this.branchId))) this.branchId = this.branches.length === 1 ? this.branches[0].id : '';
    } catch { this.loadFailed = true; this.error = 'No se pudieron cargar sucursales y departamentos.'; }
    finally { this.loading = false; }
  }
  async loadPositions(): Promise<void> {
    const request = ++this.positionRequest;
    this.positionId = ''; this.positions = []; this.positionsLoading = false; this.error = '';
    if (!this.departmentId) return;
    this.positionsLoading = true;
    try {
      const data = await firstValueFrom(this.roles.getCatalogPosiciones(this.companyId, Number(this.departmentId)).pipe(timeout(30000)));
      if (request === this.positionRequest) this.positions = this.rows(data).filter(row => row.active !== false);
    } catch { if (request === this.positionRequest) this.error = 'No se pudieron cargar los puestos. Vuelve a seleccionar el departamento.'; }
    finally { if (request === this.positionRequest) this.positionsLoading = false; }
  }
  private generateClockPassword(existing: any[]): string {
    // Mismo formato de cuatro dígitos del alta de Recursos Humanos.
    const used = new Set(existing.map(row => String(row.clockPassword || '').trim()));
    const start = crypto.getRandomValues(new Uint32Array(1))[0] % 9000;
    for (let offset = 0; offset < 9000; offset++) {
      const candidate = String(1000 + (start + offset) % 9000);
      if (!used.has(candidate)) return candidate;
    }
    throw new Error('No hay códigos de checador disponibles. Revisa el catálogo de personal.');
  }
  async save(): Promise<void> {
    if (this.loading || this.loadFailed || this.positionsLoading || this.saving) return;
    this.saving = true; this.error = '';
    try {
      if (!this.attempted) {
        this.savedPosition = this.positions.find(row => Number(row.id) === Number(this.positionId));
        if (!this.name.trim() || this.name.trim().length > 150 || (!this.code.trim() && !this.email.trim()) ||
            (this.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) || this.email.length > 50 || this.code.length > 20 ||
            !this.branches.some(row => Number(row.id) === Number(this.branchId)) ||
            !this.departments.some(row => Number(row.id) === Number(this.departmentId)) || !this.savedPosition ||
            !Number.isFinite(Number(this.rate)) || Number(this.rate) < 0 || (Number(this.rate) === 0 && this.companyId !== 18)) {
          this.error = 'Completa nombre, sucursal, usuario o correo, departamento, puesto y tarifa por hora.'; return;
        }
        const existing = await this.list();
        const normalize = (value: any) => String(value || '').trim().toLowerCase();
        if (existing.some(row => (this.code.trim() && normalize(row.employeeCode) === normalize(this.code)) ||
            (this.email.trim() && normalize(row.email) === normalize(this.email)))) {
          this.error = 'Ya existe personal con ese usuario o correo. Selecciónalo del listado.'; return;
        }
        this.beforeIds = new Set(existing.map(row => Number(row.id)));
        this.payload = { name: this.name.trim(), idBranch: Number(this.branchId), employeeCode: this.code.trim(), email: this.email.trim(),
          idDepto: Number(this.departmentId), idPosition: Number(this.positionId), priceXHour: Number(this.rate),
          clockPassword: this.generateClockPassword(existing), usaTelegram: false, baseHours: 0, ingressDate: new Date().toISOString(), vigente: true, active: true };
        this.attempted = true;
        await firstValueFrom(this.employees.addEmployee(this.payload).pipe(timeout(30000)));
      }
      // POST Employee devuelve un cuerpo vacío; recuperar el ID sin repetir el alta.
      const matches = (await this.list()).filter(row => !this.beforeIds.has(Number(row.id)) && Number(row.id) > 0 &&
        Number(row.idBranch) === this.payload.idBranch && String(row.name).trim().toUpperCase() === this.payload.name.toUpperCase() &&
        (this.payload.employeeCode ? row.employeeCode === this.payload.employeeCode : row.email === this.payload.email));
      if (matches.length !== 1) throw new Error('No se pudo identificar el empleado');
      this.modal.close({ resource: matches[0], position: this.savedPosition });
    } catch (error: any) {
      if ([400, 401, 403, 422].includes(error?.status)) this.attempted = false;
      this.error = this.attempted
        ? 'No se pudo confirmar el alta: el servidor no respondió correctamente o el registro aún no aparece. Pulsa Recuperar registro creado para consultar sin duplicar.'
        : (error?.status ? 'El servidor rechazó el alta de personal. Revisa los campos y vuelve a intentar.' : error?.message || 'No se pudo crear el personal. Revisa los datos y vuelve a intentar.');
    } finally { this.saving = false; }
  }
}
