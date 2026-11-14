import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { forkJoin, finalize, take, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
        <span *ngIf="saving" class="text-muted small" role="status">Guardando…</span>
        <span *ngIf="!loading && !saving && !changed && !loadError && !saveError" class="text-success small" role="status">Guardado automáticamente</span>
      </header>
      <div *ngIf="saveError" class="alert alert-danger py-2" role="alert">
        No se pudieron guardar los cambios. Tu selección sigue pendiente.
        <button type="button" class="btn btn-sm btn-outline-danger ms-2" (click)="save()" [disabled]="saving">Reintentar guardado</button>
      </div>
      <div *ngIf="loading" class="text-muted small" role="status">Cargando permisos…</div>
      <div *ngIf="loadError" class="alert alert-warning py-2" role="alert">
        {{ loadError }}
        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" (click)="retry()" [disabled]="loading">Reintentar</button>
      </div>
      <div *ngIf="!loading && !loadError && masters.length === 0" class="text-muted small">Esta empresa no tiene módulos habilitados en Menús por empresa.</div>
      <div class="row g-2" *ngIf="!loading && !loadError">
        <div class="col-xl-3 col-lg-4 col-md-6" *ngFor="let master of masters">
          <div class="border rounded p-2 h-100">
            <div class="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2">
              <strong class="small">{{ master.permissionName }}</strong>
              <span class="badge" [class.bg-success]="getActiveCount(master) === master.detailedPermissions.length" [class.bg-warning]="getActiveCount(master) > 0 && getActiveCount(master) < master.detailedPermissions.length" [class.bg-secondary]="getActiveCount(master) === 0">{{ getActiveCount(master) }}/{{ master.detailedPermissions.length }}</span>
            </div>
            <div class="d-flex gap-1 mb-2">
              <button class="btn btn-outline-success btn-sm py-0" [disabled]="loading" (click)="setMaster(master, true)">Todos</button>
              <button class="btn btn-outline-secondary btn-sm py-0" [disabled]="loading" (click)="setMaster(master, false)">Ninguno</button>
            </div>
            <div class="form-check form-switch" *ngFor="let detail of master.detailedPermissions">
              <input class="form-check-input" type="checkbox" [id]="'company-perm-' + companyId + '-' + userId + '-' + detail.id" [disabled]="loading" [checked]="selectedIds.has(detail.id)" (change)="toggle(detail.id, $any($event.target).checked)">
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
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  loadError = "";
  masters: any[] = [];
  companyId = 0;
  userId = 0;
  companyName = '';
  loading = true;
  saving = false;
  saveError = false;
  changed = false;
  selectedIds = new Set<number>();
  private originalIds = new Set<number>();
  private updateParentCount: (count: number) => void = () => {};

  agInit(params: any): void {
    this.companyId = Number(params.data?.idPermission ?? params.data?.companyId ?? 0);
    this.userId = Number(params.data?.userId ?? 0);
    this.companyName = params.data?.nombre ?? params.data?.name ?? `Empresa ${this.companyId}`;
    this.updateParentCount = count => {
      if (params.data.countMasterPermissions === count || params.api?.isDestroyed?.()) return;
      params.data.countMasterPermissions = count;
      params.api?.refreshCells({ rowNodes: [params.node], columns: ['countMasterPermissions'], force: true });
    };
    this.load();
  }

  refresh(params: any): boolean {
    // Una actualización del contador no debe destruir el detalle y volver a consultar.
    return Number(params.data?.idPermission ?? params.data?.companyId ?? 0) === this.companyId &&
      Number(params.data?.userId ?? 0) === this.userId;
  }

  retry(): void { if (!this.loading && !this.saving) this.load(); }

  private render(): void {
    if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
  }

  private load(): void {
    this.loading = true;
    this.loadError = '';
    forkJoin({
      masters: this.service.getCompanyMasterPermissions(this.companyId).pipe(take(1)),
      assigned: this.service.getCompanyUserPermissions(this.companyId, this.userId).pipe(take(1))
    }).pipe(
      timeout(20000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loading = false; this.render(); })
    ).subscribe({
      next: ({ masters, assigned }) => {
        this.masters = Array.isArray(masters) ? masters : [];
        const ids = (Array.isArray(assigned) ? assigned : []).filter((item: any) => item.active !== false).map((item: any) => Number(item.permissionId));
        this.selectedIds = new Set(ids);
        this.originalIds = new Set(ids);
        this.changed = false;
        this.loading = false;
        this.render();
        this.updateParentCount(this.countVisiblePermissions(this.selectedIds));
      },
      error: (error) => {
        this.loadError = error?.name === 'TimeoutError'
          ? 'La consulta está tardando demasiado. Vuelve a intentarlo.'
          : 'No se pudieron cargar los permisos. Verifica tu sesión y vuelve a intentarlo.';
      }
    });
  }

  toggle(id: number, checked: boolean): void {
    if (this.loading || this.loadError) return;
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    this.updateChanged();
  }

  setMaster(master: any, enabled: boolean): void {
    if (this.loading || this.loadError) return;
    for (const detail of master.detailedPermissions ?? []) {
      if (enabled) this.selectedIds.add(Number(detail.id)); else this.selectedIds.delete(Number(detail.id));
    }
    this.updateChanged();
  }

  getActiveCount(master: any): number {
    return (master.detailedPermissions ?? []).filter((detail: any) => this.selectedIds.has(Number(detail.id))).length;
  }

  save(): void {
    if ((!this.changed && !this.saveError) || this.saving || this.loading || this.loadError) return;
    const snapshot = new Set(this.selectedIds);
    this.saving = true;
    this.saveError = false;
    // Las escrituras pendientes terminan incluso si se cierra el detalle.
    this.service.updateCompanyUserPermissions(this.companyId, this.userId, [...snapshot]).pipe(
      timeout(30000),
      finalize(() => {
        this.saving = false;
        this.updateChanged(false);
        this.render();
        if (!this.saveError && this.changed) this.save();
      })
    ).subscribe({
      next: () => {
        this.originalIds = snapshot;
        this.updateParentCount(this.countVisiblePermissions(snapshot));
      },
      error: () => {
        this.saveError = true;
        if (this.destroyRef.destroyed) alerts.basicAlert('Error',
          `No se pudieron guardar los permisos de ${this.companyName}. Abre el detalle para revisarlos.`, 'error');
      }
    });
  }

  private updateChanged(autoSave = true): void {
    this.changed = this.selectedIds.size !== this.originalIds.size || [...this.selectedIds].some(id => !this.originalIds.has(id));
    if (autoSave && this.changed) this.save();
  }

  private countVisiblePermissions(ids: Set<number>): number {
    return this.masters.reduce((count, master) =>
      count + master.detailedPermissions.filter((detail: any) => ids.has(Number(detail.id))).length, 0);
  }
}
