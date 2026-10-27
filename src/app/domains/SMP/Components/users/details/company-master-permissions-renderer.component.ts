import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { forkJoin } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';

@Component({
  selector: 'app-company-master-permissions-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="p-2 h-100 overflow-auto bg-white">
      <header class="d-flex align-items-center gap-2 mb-2">
        <strong class="me-auto"><i class="bi bi-shield-check me-1"></i>Permisos maestros — {{ companyName }}</strong>
        <button class="btn btn-sm btn-success position-relative" (click)="save()" [disabled]="!changed || loading || saving" title="Guardar">
          <i class="bi bi-floppy"></i>
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle" *ngIf="changed"></span>
        </button>
        <button class="btn btn-sm btn-warning" (click)="revert()" [disabled]="!changed || saving" title="Deshacer"><i class="bi bi-arrow-clockwise"></i></button>
      </header>
      <div *ngIf="loading" class="text-muted small">Cargando permisos…</div>
      <div *ngIf="!loading && masters.length === 0" class="text-muted small">Esta empresa no tiene módulos habilitados en Menús por empresa.</div>
      <div class="row g-2" *ngIf="!loading">
        <div class="col-xl-3 col-lg-4 col-md-6" *ngFor="let master of masters">
          <div class="border rounded p-2 h-100">
            <div class="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2">
              <strong class="small">{{ master.permissionName }}</strong>
              <span class="badge" [class.bg-success]="getActiveCount(master) === master.detailedPermissions.length" [class.bg-warning]="getActiveCount(master) > 0 && getActiveCount(master) < master.detailedPermissions.length" [class.bg-secondary]="getActiveCount(master) === 0">{{ getActiveCount(master) }}/{{ master.detailedPermissions.length }}</span>
            </div>
            <div class="d-flex gap-1 mb-2">
              <button class="btn btn-outline-success btn-sm py-0" (click)="setMaster(master, true)">Todos</button>
              <button class="btn btn-outline-secondary btn-sm py-0" (click)="setMaster(master, false)">Ninguno</button>
            </div>
            <div class="form-check form-switch" *ngFor="let detail of master.detailedPermissions">
              <input class="form-check-input" type="checkbox" [id]="'company-perm-' + companyId + '-' + userId + '-' + detail.id" [checked]="selectedIds.has(detail.id)" (change)="toggle(detail.id, $any($event.target).checked)">
              <label class="form-check-label small" [for]="'company-perm-' + companyId + '-' + userId + '-' + detail.id">{{ detail.permissionName }}</label>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class CompanyMasterPermissionsRendererComponent implements ICellRendererAngularComp {
  private service = inject(MasterPermissions2Service);
  masters: any[] = [];
  companyId = 0;
  userId = 0;
  companyName = '';
  loading = true;
  saving = false;
  changed = false;
  selectedIds = new Set<number>();
  private originalIds = new Set<number>();

  agInit(params: any): void {
    this.companyId = Number(params.data?.idPermission ?? params.data?.companyId ?? 0);
    this.userId = Number(params.data?.userId ?? 0);
    this.companyName = params.data?.nombre ?? params.data?.name ?? `Empresa ${this.companyId}`;
    this.load();
  }

  refresh(): boolean { return false; }

  private load(): void {
    this.loading = true;
    forkJoin({ masters: this.service.getCompanyMasterPermissions(this.companyId), assigned: this.service.getCompanyUserPermissions(this.companyId, this.userId) }).subscribe({
      next: ({ masters, assigned }) => {
        this.masters = Array.isArray(masters) ? masters : [];
        const ids = (Array.isArray(assigned) ? assigned : []).filter((item: any) => item.active !== false).map((item: any) => Number(item.permissionId));
        this.selectedIds = new Set(ids);
        this.originalIds = new Set(ids);
        this.changed = false;
        this.loading = false;
      },
      error: () => { this.loading = false; alerts.basicAlert('Error', 'No se pudieron cargar los permisos de esta empresa.', 'error'); }
    });
  }

  toggle(id: number, checked: boolean): void {
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    this.updateChanged();
  }

  setMaster(master: any, enabled: boolean): void {
    for (const detail of master.detailedPermissions ?? []) {
      if (enabled) this.selectedIds.add(Number(detail.id)); else this.selectedIds.delete(Number(detail.id));
    }
    this.updateChanged();
  }

  getActiveCount(master: any): number {
    return (master.detailedPermissions ?? []).filter((detail: any) => this.selectedIds.has(Number(detail.id))).length;
  }

  save(): void {
    if (!this.changed || this.saving) return;
    this.saving = true;
    this.service.updateCompanyUserPermissions(this.companyId, this.userId, [...this.selectedIds]).subscribe({
      next: () => { this.originalIds = new Set(this.selectedIds); this.changed = false; this.saving = false; alerts.basicAlert('Listo', 'Permisos de la empresa actualizados.', 'success'); },
      error: () => { this.saving = false; alerts.basicAlert('Error', 'No se pudieron guardar los permisos de esta empresa.', 'error'); }
    });
  }

  revert(): void { this.selectedIds = new Set(this.originalIds); this.changed = false; }

  private updateChanged(): void {
    this.changed = this.selectedIds.size !== this.originalIds.size || [...this.selectedIds].some(id => !this.originalIds.has(id));
  }
}
