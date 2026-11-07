import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { RootService } from 'app/services/root.service';
import { SignalsService } from 'app/services/signals.service';
import { WarehouseCleanupGroup, WarehouseCleanupPreview, WarehouseCleanupService } from 'app/services/warehouse-cleanup.service';
import { canSeeWarehouseCleanup } from 'app/guards/warehouse-cleanup.guard';

@Component({
  selector: 'app-warehouse-module-cleanup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './module-cleanup.component.html'
})
export class ModuleCleanupComponent {
  readonly signals = inject(SignalsService);
  private readonly service = inject(WarehouseCleanupService);
  private readonly rootService = inject(RootService);
  companyName = '';
  loadingCompanyName = false;
  preview: WarehouseCleanupPreview | null = null;
  confirmation = '';
  acknowledged = false;
  busy = false;
  executing = false;
  error = '';
  result = '';
  readonly groups: Array<{ key: WarehouseCleanupGroup; label: string; selected: boolean }> = [
    { key: 'materials', label: 'Materiales y sus relaciones', selected: true },
    { key: 'providers', label: 'Proveedores y sus relaciones', selected: true },
    { key: 'requisitions', label: 'Requisiciones y sus partidas', selected: true },
    { key: 'purchaseOrders', label: 'Órdenes de compra y sus partidas', selected: true },
    { key: 'quotes', label: 'Cotizaciones y otros documentos de compra', selected: true },
    { key: 'entries', label: 'Entradas y sus partidas', selected: true },
    { key: 'exits', label: 'Salidas y sus partidas', selected: true },
    { key: 'otherMovements', label: 'Otros movimientos de almacén', selected: true }
  ];

  constructor() {
    effect(() => {
      const companyId = Number(this.signals.getRootSelectedBySidebar()() || 0);
      this.companyName = '';
      this.loadingCompanyName = false;
      if (companyId && this.isRoot) void this.loadCompanyName(companyId);
      this.resetPreview();
      this.error = '';
      this.result = '';
    });
  }

  get selectedGroups(): WarehouseCleanupGroup[] { return this.groups.filter(group => group.selected).map(group => group.key); }
  get allSelected(): boolean { return this.groups.every(group => group.selected); }
  get someSelected(): boolean { return this.groups.some(group => group.selected); }
  get keptGroupNames(): string { return this.groups.filter(group => !group.selected).map(group => group.label).join(', '); }

  toggleAll(selected: boolean): void {
    if (this.busy) return;
    this.groups.forEach(group => group.selected = selected);
    this.selectionChanged();
  }

  selectionChanged(): void {
    this.resetPreview();
    this.error = '';
    this.result = '';
  }

  private matchesSelection(preview: WarehouseCleanupPreview): boolean {
    return Array.isArray(preview.selectedGroups) && [...preview.selectedGroups].sort().join(',') === [...this.selectedGroups].sort().join(',');
  }

  get selectedCompanyName(): string { return this.preview?.companyName || this.companyName; }

  private async loadCompanyName(companyId: number): Promise<void> {
    this.loadingCompanyName = true;
    try {
      const company: any = await firstValueFrom(this.rootService.getRootbyId(companyId));
      if (companyId === this.selectedCompanyId && Number(company?.id) === companyId) {
        this.companyName = String(company.name || '').trim();
      }
    } catch {
      // The preview also provides the authoritative company name before any cleanup.
      if (companyId === this.selectedCompanyId) this.companyName = '';
    } finally {
      if (companyId === this.selectedCompanyId) this.loadingCompanyName = false;
    }
  }

  get selectedCompanyId(): number { return Number(this.signals.getRootSelectedBySidebar()() || 0); }
  get isRoot(): boolean { return canSeeWarehouseCleanup(this.signals); }
  get canExecute(): boolean {
    return this.isRoot && !this.busy && !!this.preview && this.preview.total > 0 &&
      this.preview.companyId === this.selectedCompanyId && this.matchesSelection(this.preview) && this.acknowledged &&
      this.confirmation === this.preview.confirmationText && Date.parse(this.preview.expiresAt) > Date.now();
  }

  async loadPreview(): Promise<void> {
    const id = this.selectedCompanyId;
    if (!this.isRoot || !id || this.busy || !this.someSelected) return;
    const groups = this.selectedGroups;
    this.resetPreview();
    this.error = '';
    this.result = '';
    this.busy = true;
    try {
      const preview = await firstValueFrom(this.service.preview(id, groups));
      if (id === this.selectedCompanyId && this.isRoot) {
        if (!this.matchesSelection(preview)) {
          this.error = 'El servidor debe actualizarse para respetar los grupos seleccionados. No se ejecutará la limpieza.';
          return;
        }
        this.preview = preview;
      }
    } catch (error: any) {
      if (id === this.selectedCompanyId) this.error = error?.error?.message || 'No se pudo consultar la vista previa. No se ejecutó ninguna limpieza.';
    } finally { this.busy = false; }
  }

  async execute(): Promise<void> {
    if (!this.canExecute) return;
    const preview = this.preview!;
    const confirmation = this.confirmation;
    this.busy = true;
    let executed = false;
    this.error = '';
    this.result = '';
    try {
      const decision = await Swal.fire({
        titleText: '¿Estás seguro de borrar estos datos?',
        icon: 'warning',
        html: this.confirmationSummary(preview),
        showCancelButton: true,
        confirmButtonText: `Sí, borrar datos de la empresa ${preview.companyId}`,
        cancelButtonText: 'Cancelar, conservar los datos',
        confirmButtonColor: '#dc3545',
        focusCancel: true,
        allowOutsideClick: false,
        customClass: { container: 'swal-over-modal' }
      });
      if (!decision.isConfirmed) return;
      if (this.preview !== preview || !this.isRoot || this.selectedCompanyId !== preview.companyId ||
          !this.matchesSelection(preview) || !this.acknowledged || this.confirmation !== confirmation || Date.parse(preview.expiresAt) <= Date.now()) {
        this.error = 'La empresa o la confirmación cambió o venció. Consulta nuevamente los datos antes de borrar.';
        return;
      }
      this.executing = true;
      executed = true;
      const response = await firstValueFrom(this.service.execute(preview, confirmation));
      this.result = `Limpieza lógica completada en ${response.companyName} (empresa ${response.companyId}): ${response.affectedRows} registros desactivados.`;
    } catch (error: any) {
      this.error = error?.error?.message || `No se pudo confirmar el resultado para la empresa ${preview.companyId}. Consulta nuevamente la vista previa antes de intentar otra limpieza.`;
    } finally {
      this.busy = false;
      this.executing = false;
      if (executed) this.resetPreview();
    }
  }

  private confirmationSummary(preview: WarehouseCleanupPreview): HTMLElement {
    const container = document.createElement('div');
    container.className = 'text-start';
    const company = document.createElement('p');
    company.textContent = `Vas a borrar lógicamente datos de ${preview.companyName} (empresa ${preview.companyId}).`;
    company.className = 'fw-bold';
    const list = document.createElement('ul');
    for (const item of preview.items.filter(item => item.count > 0)) {
      const line = document.createElement('li');
      line.textContent = `${item.label}: ${item.count.toLocaleString('es-MX')}`;
      list.appendChild(line);
    }
    const total = document.createElement('p');
    total.className = 'fw-bold';
    total.textContent = `Total: ${preview.total.toLocaleString('es-MX')} registros. ¿Deseas continuar?`;
    const preserved = document.createElement('p');
    preserved.className = 'small';
    preserved.textContent = 'Se conservan los almacenes, configuración, catálogos, empresas, proyectos, seguridad, usuarios y permisos. Los registros desactivados permanecen almacenados.';
    const kept = document.createElement('p');
    kept.textContent = this.keptGroupNames ? `Se conservarán los grupos desmarcados: ${this.keptGroupNames}.` : '';
    const protectedData = document.createElement('p');
    protectedData.className = 'small';
    protectedData.textContent = (preview.protectedItems || []).length
      ? `También se conservarán por dependencia: ${preview.protectedItems.map(item => `${item.label}: ${item.count.toLocaleString('es-MX')}`).join('; ')}.` : '';
    container.append(company, list, total, kept, protectedData, preserved);
    return container;
  }

  private resetPreview(): void {
    this.preview = null;
    this.confirmation = '';
    this.acknowledged = false;
  }
}
