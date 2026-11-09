import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { catchError, firstValueFrom, Observable, of, throwError, timeout } from 'rxjs';
import { BranchsService } from 'app/services/branchs.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { HRService } from 'app/services/hr.service';

export interface UserEntityCreateContext {
  kind: 'branch' | 'warehouse';
  parentId: number;
  parentName: string;
  userId: number;
}

@Component({
  selector: 'app-user-entity-quick-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form #form="ngForm" (ngSubmit)="submit()">
      <div class="modal-header">
        <h5 class="modal-title" id="quick-create-title">{{ isBranch ? 'Nueva sucursal' : 'Nuevo almacén' }}</h5>
        <button type="button" class="btn-close" aria-label="Cerrar" [disabled]="busy" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body">
        <p class="text-muted">{{ isBranch ? 'Empresa' : 'Sucursal' }}: <strong>{{ context.parentName }}</strong></p>
        <p class="small">Se creará y se asignará al usuario de este detalle.</p>
        <div *ngIf="error" class="alert alert-danger" role="alert">{{ error }}</div>
        <fieldset [disabled]="busy || createdId > 0">
          <label class="form-label" for="quick-entity-name">Nombre *</label>
          <input id="quick-entity-name" name="name" class="form-control mb-3" [(ngModel)]="name" required
                 [maxlength]="isBranch ? 20 : 50" autofocus />
          <ng-container *ngIf="isBranch">
            <label class="form-label" for="quick-entity-description">Descripción *</label>
            <input id="quick-entity-description" name="description" class="form-control mb-3" [(ngModel)]="description" required maxlength="50" />
          </ng-container>
          <label class="form-label" for="quick-entity-address">Dirección *</label>
          <input id="quick-entity-address" name="address" class="form-control" [(ngModel)]="address" required [maxlength]="isBranch ? 100 : 150" />
        </fieldset>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" [disabled]="busy" (click)="modal.dismiss()">Cerrar</button>
        <button type="submit" class="btn btn-success" [disabled]="busy || (createdId === 0 && !form.valid)">
          {{ busy ? 'Guardando…' : createdId > 0 ? 'Completar asignación' : 'Crear y asignar' }}
        </button>
      </div>
    </form>
  `
})
export class UserEntityQuickCreateComponent {
  modal = inject(NgbActiveModal);
  private branches = inject(BranchsService);
  private warehouses = inject(WarehousesService);
  private permissions = inject(UsersxpermissionsService);
  private hr = inject(HRService);
  private changeDetector = inject(ChangeDetectorRef);
  context: UserEntityCreateContext = { kind: 'branch', parentId: 0, parentName: '', userId: 0 };
  name = '';
  description = '';
  address = '';
  error = '';
  busy = false;
  createdId = 0;
  private hrReady = false;
  get isBranch(): boolean { return this.context.kind === 'branch'; }

  private request<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source.pipe(timeout(30000)));
  }

  async submit(): Promise<void> {
    if (this.busy) return;
    const name = this.name.trim();
    if (!this.context.parentId || !this.context.userId || (!this.createdId &&
        (!name || !this.address.trim() || (this.isBranch && !this.description.trim()) ||
          name.length > (this.isBranch ? 20 : 50) || this.address.trim().length > (this.isBranch ? 100 : 150) ||
          (this.isBranch && this.description.trim().length > 50)))) {
      this.error = 'Completa los campos requeridos y revisa sus longitudes.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      if (!this.createdId) {
        const catalog: any = await this.request(this.isBranch
          ? this.branches.getBranches(this.context.parentId) : this.warehouses.getSimpleWarehouses(this.context.parentId).pipe(catchError(error => error?.status === 404 ? of([]) : throwError(() => error))));
        if ((Array.isArray(catalog) ? catalog : []).some(item => String(item.name || '').trim().toLocaleUpperCase() === name.toLocaleUpperCase())) {
          this.error = 'Ya existe ese nombre. Cierra este formulario y selecciónalo en el listado para asignarlo.';
          return;
        }
        const entity: any = await this.request(this.isBranch ? this.branches.addBranch({
          idCompany: this.context.parentId, name: name.toLocaleUpperCase(), description: this.description.trim().toLocaleUpperCase(),
          address: this.address.trim().toLocaleUpperCase(), orden: 0, vigente: true, active: true
        }) : this.warehouses.addWarehouse({
          idBranch: this.context.parentId, name, address: this.address.trim(), place: '', state: '', city: '',
          codePostal: '', phone: '', leader: '', principal: false, active: true
        }));
        this.createdId = Number(entity?.id);
        if (!Number.isInteger(this.createdId) || this.createdId <= 0) throw new Error('Respuesta sin identificador. Revisa el listado antes de crear nuevamente.');
      }
      if (this.isBranch && !this.hrReady) {
        const existing: any = await this.request(this.hr.getHRManagementData(this.createdId).pipe(catchError(error => error?.status === 404 ? of([]) : throwError(() => error))));
        this.hrReady = Array.isArray(existing) ? existing.length > 0 : !!existing?.idBranch;
        if (!this.hrReady) {
          await this.request(this.hr.addHRManagementData({ idBranch: this.createdId, vigency: 120, startDay: 'Lunes',
            clockTolerance: 120, delay1: 5, delay2: 65, discount1: true, discount2: true, discount: 50,
            payrollPeriod: 15, overtimePay: 100, specialOvertimePay: 150, active: true }));
          this.hrReady = true;
        }
      }
      const type = this.isBranch ? 'branch' : 'warehouse';
      const assigned: any = await this.request(this.permissions.getUsersxPermissionsGeneral(type, this.context.userId).pipe(catchError(error => error?.status === 404 ? of([]) : throwError(() => error))));
      if (!(Array.isArray(assigned) ? assigned : []).some(p => Number(p.idPermission) === this.createdId && Number(p.active) === 1)) {
        await this.request(this.permissions.addUserxPermission({ idUser: this.context.userId, idPermission: this.createdId,
          type, description: null, active: 1 }));
      }
      this.modal.close(true);
    } catch (error) {
      this.error = this.createdId > 0
        ? 'El registro ya se creó, pero falta completar su preparación o asignación. Pulsa Completar asignación para reintentar sin duplicarlo.'
        : 'No se pudo completar el alta. Revisa el listado antes de volver a intentarlo.';
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }
}
