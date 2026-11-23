import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { SignalsService } from 'app/services/signals.service';
import { ConsecutivoConfig, ConsecutivosService } from 'app/services/consecutivos.service';

@Component({
  selector: 'app-consecutivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consecutivos.component.html',
  styleUrl: './consecutivos.component.scss',
})
export class ConsecutivosComponent implements CanComponentDeactivate {
  private service = inject(ConsecutivosService);
  private signals = inject(SignalsService);
  private savedConfig: ConsecutivoConfig | null = null;

  idRoot = 0;
  config: ConsecutivoConfig = this.emptyConfig();
  hasUnsavedChanges = false;
  isLoading = false;
  isSaving = false;
  isAdding = false;
  duplicateCount = 0;

  constructor() {
    effect(() => {
      const root = Number(this.signals.getRootSelectedBySidebar()() || localStorage.getItem('company') || 0);
      if (root !== this.idRoot) {
        this.idRoot = root;
        this.load();
      }
    });
  }

  get isConfigured(): boolean {
    return this.config.id > 0;
  }

  get canEdit(): boolean {
    return this.isConfigured || this.isAdding;
  }

  get preview(): string {
    return `${this.config.consecutivoTexto || ''}${this.config.campoAuxiliar || ''}`;
  }

  load(): void {
    if (!this.idRoot) {
      this.config = this.emptyConfig();
      this.savedConfig = null;
      this.duplicateCount = 0;
      this.hasUnsavedChanges = false;
      this.isAdding = false;
      return;
    }

    this.isLoading = true;
    this.service.getByRoot(this.idRoot).subscribe({
      next: rows => {
        const orderedRows = [...(rows || [])].sort((a, b) => a.id - b.id);
        const persisted = orderedRows[0];
        this.duplicateCount = Math.max(0, orderedRows.length - 1);
        this.config = persisted
          ? { ...persisted, idRoot: this.idRoot }
          : this.emptyConfig();
        this.savedConfig = persisted ? { ...this.config } : null;
        this.hasUnsavedChanges = false;
        this.isAdding = false;
        this.isLoading = false;
      },
      error: error => {
        this.isLoading = false;
        console.error('Error al cargar configuración de consecutivo', error);
        alerts.basicAlert('Error', 'No se pudo cargar la configuración de la empresa.', 'error');
      },
    });
  }

  add(): void {
    if (!this.idRoot) {
      alerts.basicAlert('Empresa', 'Selecciona una empresa antes de configurar su consecutivo.', 'warning');
      return;
    }
    if (this.isConfigured) return;

    this.config = { ...this.emptyConfig(), consecutivoTexto: 'CO-' };
    this.isAdding = true;
    this.hasUnsavedChanges = true;
  }

  onFormChanged(): void {
    if (!this.canEdit) return;
    if (!this.savedConfig) {
      this.hasUnsavedChanges = this.isAdding;
      return;
    }

    this.hasUnsavedChanges = this.config.id !== this.savedConfig.id
      || this.config.idRoot !== this.savedConfig.idRoot
      || this.config.consecutivoTexto !== this.savedConfig.consecutivoTexto
      || Number(this.config.campoAuxiliar) !== Number(this.savedConfig.campoAuxiliar);
  }

  async save(): Promise<void> {
    const consecutivoTexto = this.config.consecutivoTexto?.trim() || '';
    const campoAuxiliar = Number(this.config.campoAuxiliar);

    if (!consecutivoTexto || consecutivoTexto.length > 40) {
      alerts.basicAlert('Prefijo requerido', 'Captura un prefijo de hasta 40 caracteres.', 'warning');
      return;
    }
    if (!Number.isInteger(campoAuxiliar) || campoAuxiliar < 1) {
      alerts.basicAlert('Número inválido', 'El siguiente número debe ser un entero mayor que cero.', 'warning');
      return;
    }
    if (!this.idRoot) {
      alerts.basicAlert('Empresa', 'Selecciona una empresa antes de guardar.', 'warning');
      return;
    }

    const item: ConsecutivoConfig = {
      id: this.isConfigured ? this.config.id : 0,
      idRoot: this.idRoot,
      consecutivoTexto,
      campoAuxiliar,
    };

    this.isSaving = true;
    try {
      if (this.isConfigured) {
        await lastValueFrom(this.service.update(item));
      } else {
        await lastValueFrom(this.service.create(item));
      }
      this.hasUnsavedChanges = false;
      alerts.basicAlert('Guardado', 'La configuración de consecutivo quedó guardada para esta empresa.', 'success');
      this.load();
    } catch (error: any) {
      console.error('Error al guardar configuración de consecutivo', error);
      const message = error?.error && typeof error.error === 'string'
        ? error.error
        : 'No se pudo guardar la configuración de la empresa.';
      alerts.basicAlert('Error', message, 'error');
    } finally {
      this.isSaving = false;
    }
  }

  async remove(): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await lastValueFrom(this.service.delete(this.config.id, this.idRoot));
      alerts.basicAlert('Eliminado', 'La configuración de consecutivo fue eliminada.', 'success');
      this.load();
    } catch (error) {
      console.error('Error al eliminar configuración de consecutivo', error);
      alerts.basicAlert('Error', 'No se pudo eliminar la configuración de la empresa.', 'error');
    }
  }

  undo(): void {
    if (this.savedConfig) {
      this.config = { ...this.savedConfig };
      this.isAdding = false;
      this.hasUnsavedChanges = false;
      return;
    }

    this.config = this.emptyConfig();
    this.isAdding = false;
    this.hasUnsavedChanges = false;
  }

  canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.hasUnsavedChanges);
  }

  private emptyConfig(): ConsecutivoConfig {
    return { id: 0, idRoot: this.idRoot, consecutivoTexto: '', campoAuxiliar: 1 };
  }
}
