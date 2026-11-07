import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { WarehouseCleanupPreview, WarehouseCleanupService } from 'app/services/warehouse-cleanup.service';
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
  preview: WarehouseCleanupPreview | null = null;
  confirmation = '';
  acknowledged = false;
  busy = false;
  executing = false;
  error = '';
  result = '';

  constructor() {
    effect(() => {
      this.signals.getRootSelectedBySidebar()();
      this.resetPreview();
      this.error = '';
      this.result = '';
    });
  }

  get selectedCompanyId(): number { return Number(this.signals.getRootSelectedBySidebar()() || 0); }
  get isRoot(): boolean { return canSeeWarehouseCleanup(this.signals); }
  get canExecute(): boolean {
    return this.isRoot && !this.busy && !!this.preview && this.preview.total > 0 &&
      this.preview.companyId === this.selectedCompanyId && this.acknowledged &&
      this.confirmation === this.preview.confirmationText && Date.parse(this.preview.expiresAt) > Date.now();
  }

  async loadPreview(): Promise<void> {
    const id = this.selectedCompanyId;
    if (!this.isRoot || !id || this.busy) return;
    this.resetPreview();
    this.error = '';
    this.result = '';
    this.busy = true;
    try {
      const preview = await firstValueFrom(this.service.preview(id));
      if (id === this.selectedCompanyId && this.isRoot) this.preview = preview;
    } catch (error: any) {
      if (id === this.selectedCompanyId) this.error = error?.error?.message || 'No se pudo consultar la vista previa. No se ejecutó ninguna limpieza.';
    } finally { this.busy = false; }
  }

  async execute(): Promise<void> {
    if (!this.canExecute) return;
    const preview = this.preview!;
    const confirmation = this.confirmation;
    this.busy = true;
    this.executing = true;
    this.error = '';
    this.result = '';
    try {
      const response = await firstValueFrom(this.service.execute(preview, confirmation));
      this.result = `Limpieza lógica completada en ${response.companyName} (empresa ${response.companyId}): ${response.affectedRows} registros desactivados.`;
    } catch (error: any) {
      this.error = error?.error?.message || `No se pudo confirmar el resultado para la empresa ${preview.companyId}. Consulta nuevamente la vista previa antes de intentar otra limpieza.`;
    } finally {
      this.busy = false;
      this.executing = false;
      this.resetPreview();
    }
  }

  private resetPreview(): void {
    this.preview = null;
    this.confirmation = '';
    this.acknowledged = false;
  }
}
