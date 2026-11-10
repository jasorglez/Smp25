import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, forkJoin, Observable, timeout } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';
import { EquipmentService } from 'app/services/equipment.service';
import { MaterialsService } from 'app/services/materials.service';

export type QuickResourceKind = 'MATERIAL' | 'EQUIPMENT';
export interface QuickResourceCreated { resource: any; units: any[]; }

@Component({
  selector: 'app-quick-resource-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form #form="ngForm" (ngSubmit)="save()">
      <div class="modal-header">
        <h5 class="modal-title">{{ isMaterial ? 'Nuevo material' : 'Nuevo equipo' }}</h5>
        <button type="button" class="btn-close" aria-label="Cerrar" [disabled]="saving" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body">
        <p class="small text-muted">Se creará en el catálogo y quedará seleccionado para capturar su cantidad en el reporte.</p>
        <div *ngIf="error" class="alert alert-warning" role="alert">{{ error }}</div>
        <div *ngIf="loading" class="text-muted" role="status">Cargando catálogos…</div>
        <button *ngIf="loadFailed" type="button" class="btn btn-outline-secondary btn-sm mb-2" (click)="load()">Reintentar carga</button>
        <fieldset [disabled]="loading || loadFailed || saving || attempted">
          <label class="form-label" for="quick-create-description">Descripción *</label>
          <input id="quick-create-description" name="description" class="form-control mb-3" [(ngModel)]="description" required [maxlength]="isMaterial ? 500 : 480" autofocus>
          <label class="form-label" for="quick-create-unit">Unidad *</label>
          <select id="quick-create-unit" name="unit" class="form-select mb-3" [(ngModel)]="unitId" required>
            <option value="">Seleccionar unidad</option>
            <option *ngFor="let item of units" [value]="item.id">{{ item.description }}</option>
          </select>
          <ng-container *ngIf="isMaterial">
            <label class="form-label" for="quick-create-family">Familia *</label>
            <select id="quick-create-family" name="family" class="form-select mb-3" [(ngModel)]="familyId" (ngModelChange)="subfamilyId = ''" required>
              <option value="">Seleccionar familia</option>
              <option *ngFor="let item of families" [value]="item.id">{{ item.description }}</option>
            </select>
            <label class="form-label" for="quick-create-subfamily">Subfamilia *</label>
            <select id="quick-create-subfamily" name="subfamily" class="form-select mb-3" [(ngModel)]="subfamilyId" required>
              <option value="">Seleccionar subfamilia</option>
              <option *ngFor="let item of availableSubfamilies" [value]="item.id">{{ item.description }}</option>
            </select>
          </ng-container>
          <ng-container *ngIf="!isMaterial">
            <label class="form-label" for="quick-create-type">Tipo de equipo *</label>
            <select id="quick-create-type" name="type" class="form-select mb-3" [(ngModel)]="typeId" required>
              <option value="">Seleccionar tipo</option>
              <option *ngFor="let item of types" [value]="item.id">{{ item.description }}</option>
            </select>
          </ng-container>
          <label class="form-label" for="quick-create-cost">Costo unitario (opcional)</label>
          <input id="quick-create-cost" name="cost" type="number" min="0" step="0.01" class="form-control" [(ngModel)]="cost">
        </fieldset>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" [disabled]="saving" (click)="modal.dismiss()">Cancelar</button>
        <button type="submit" class="btn btn-success" [disabled]="loading || loadFailed || saving || (!attempted && !form.valid)">
          {{ saving ? 'Guardando…' : attempted ? 'Recuperar registro creado' : 'Guardar y seleccionar' }}
        </button>
      </div>
    </form>
  `
})
export class QuickResourceCreateComponent implements OnInit {
  modal = inject(NgbActiveModal);
  private catalogs = inject(CatalogsService);
  private materials = inject(MaterialsService);
  private equipment = inject(EquipmentService);
  kind: QuickResourceKind = 'MATERIAL';
  companyId = 0;
  description = '';
  unitId = '';
  familyId = '';
  subfamilyId = '';
  typeId = '';
  cost = 0;
  units: any[] = [];
  families: any[] = [];
  subfamilies: any[] = [];
  types: any[] = [];
  loading = false;
  loadFailed = false;
  saving = false;
  attempted = false;
  error = '';
  private beforeIds = new Set<number>();
  private pendingPayload: any;
  get isMaterial(): boolean { return this.kind === 'MATERIAL'; }
  get availableSubfamilies(): any[] { return this.subfamilies.filter(item => Number(item.parentId) === Number(this.familyId)); }
  ngOnInit(): void { this.load(); }
  private request<T>(source: Observable<T>): Promise<T> { return firstValueFrom(source.pipe(timeout(30000))); }
  private normalize(value: any): string { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase(); }
  private list(): Observable<any> { return this.isMaterial ? this.materials.getMaterials(this.companyId, 'CONSUMABLE') : this.equipment.getEquipment(this.companyId); }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.loadFailed = false;
    try {
      if (!Number.isSafeInteger(this.companyId) || this.companyId <= 0) throw new Error('Selecciona una empresa válida.');
      const responses: any = await this.request(forkJoin(this.isMaterial ? {
        units: this.catalogs.getUnits(this.companyId), families: this.catalogs.getFamilyById(this.companyId),
        subfamilies: this.catalogs.getCatalogs(this.companyId, 'SUBFAMILY')
      } : { units: this.catalogs.getUnits(this.companyId), types: this.catalogs.getTypeEquipment(this.companyId, 'TYPEEQUIPMENT') }));
      const active = (rows: any) => (Array.isArray(rows) ? rows : []).filter(item => item.active !== false && item.active !== 0);
      this.units = active(responses.units).filter(item => this.isMaterial || String(item.description || '').length <= 5);
      this.families = active(responses.families);
      this.subfamilies = active(responses.subfamilies);
      this.types = active(responses.types);
    } catch { this.error = 'No se pudieron cargar los catálogos. Reintenta antes de guardar.'; this.loadFailed = true; }
    finally { this.loading = false; }
  }

  async save(): Promise<void> {
    if (this.saving || this.loading || this.loadFailed) return;
    this.error = '';
    this.saving = true;
    try {
      if (!this.attempted) {
        const description = this.description.trim();
        const unit = this.units.find(item => Number(item.id) === Number(this.unitId));
        if (!description || description.length > (this.isMaterial ? 500 : 480) || !unit ||
            !Number.isFinite(Number(this.cost)) || Number(this.cost) < 0 ||
            (this.isMaterial && (!this.families.some(item => Number(item.id) === Number(this.familyId)) ||
              !this.availableSubfamilies.some(item => Number(item.id) === Number(this.subfamilyId)))) ||
            (!this.isMaterial && !this.types.some(item => Number(item.id) === Number(this.typeId)))) {
          this.error = 'Completa los campos obligatorios y revisa el costo.'; return;
        }
        const existing = await this.request(this.list());
        if (!Array.isArray(existing)) throw new Error('Listado inválido');
        if (existing.some(item => this.normalize(item.description) === this.normalize(description))) {
          this.error = 'Ya existe un recurso con esa descripción. Selecciónalo del combo.'; return;
        }
        this.beforeIds = new Set(existing.map(item => Number(item.id)));
        this.pendingPayload = this.isMaterial ? {
          idCompany: this.companyId, description, articulo: description.slice(0, 50), insumo: '',
          idMedida: Number(unit.id), idFamilia: Number(this.familyId), idSubfamilia: Number(this.subfamilyId),
          typeMaterial: 'CONSUMIBLE', costoMN: Number(this.cost), costoDLL: 0, ventaMN: 0, ventaDLL: 0,
          quantity: 0, stockMin: 0, stockMax: 0, active: true, vigente: true, aplicaResg: false,
          date: new Date().toISOString()
        } : {
          idCompany: this.companyId, description, idTypeEquipment: Number(this.typeId), measure: unit.description,
          quantity: 1, costMN: Number(this.cost), costDLL: 0, priceMN: 0, priceDLL: 0,
          daysWork: 8, print: true, charged: true, active: true
        };
        this.attempted = true;
        const response: any = await this.request(this.isMaterial
          ? this.materials.addMaterial(this.pendingPayload) : this.equipment.addEquipment(this.pendingPayload));
        const resource = response?.material ?? response?.equipment ?? response?.data ?? response;
        const id = Number(resource?.id ?? response?.id);
        if (Number.isSafeInteger(id) && id > 0) {
          this.modal.close({ resource: { ...this.pendingPayload, ...resource, id }, units: this.units });
          return;
        }
      }
      const rows = await this.request(this.list());
      const matches = (Array.isArray(rows) ? rows : []).filter(item => !this.beforeIds.has(Number(item.id)) &&
        this.normalize(item.description) === this.normalize(this.pendingPayload.description));
      if (matches.length !== 1) throw new Error('No se pudo identificar el registro creado');
      this.modal.close({ resource: matches[0], units: this.units });
    } catch (error: any) {
      if ([400, 422].includes(error?.status)) this.attempted = false;
      this.error = this.attempted
        ? 'No se pudo confirmar el registro creado. Pulsa Recuperar registro creado para consultarlo sin repetir el alta.'
        : 'No se pudo crear el recurso. Revisa los datos y vuelve a intentar.';
    } finally { this.saving = false; }
  }
}
