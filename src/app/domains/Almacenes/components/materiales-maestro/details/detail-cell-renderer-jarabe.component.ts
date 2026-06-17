import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { ProductionService, MaterialJarabeConfig } from 'app/services/production.service';

@Component({
  selector: 'app-detail-cell-renderer-jarabe',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      style="padding: 16px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column; gap: 16px;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">

      <div style="display: flex; align-items: center; gap: 12px;">
        <strong>Configuración Jarabe: {{ materialName }}</strong>
        <span *ngIf="loading" class="badge bg-secondary">Cargando...</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px;">

        <!-- Toggle ¿Usar en jarabe? -->
        <div class="form-check form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            id="usarEnJarabe"
            [(ngModel)]="config.usarEnJarabe"
            (change)="onToggleJarabe()"
          />
          <label class="form-check-label" for="usarEnJarabe">
            <strong>¿Usar en jarabe?</strong>
          </label>
        </div>

        <!-- Campos de Nota -->
        <fieldset [disabled]="!config.usarEnJarabe" style="border: 1px solid #ced4da; border-radius: 4px; padding: 10px 14px;">
          <legend style="font-size: 0.85rem; width: auto; padding: 0 6px; margin-bottom: 6px;">Nota</legend>
          <div style="display: flex; gap: 12px; align-items: flex-end;">
            <div class="mb-0">
              <label class="form-label form-label-sm mb-1">Prefijo</label>
              <input
                type="text"
                class="form-control form-control-sm"
                style="width: 120px;"
                [(ngModel)]="config.prefijoNota"
                [disabled]="!config.usarEnJarabe"
                maxlength="50"
                placeholder="Ej. NT-"
              />
            </div>
            <div class="mb-0">
              <label class="form-label form-label-sm mb-1">Consecutivo</label>
              <input
                type="number"
                class="form-control form-control-sm"
                style="width: 100px;"
                [(ngModel)]="config.consecutivoNota"
                [disabled]="!config.usarEnJarabe"
                min="0"
              />
            </div>
          </div>
        </fieldset>

        <!-- Prefijo Lote -->
        <fieldset [disabled]="!config.usarEnJarabe" style="border: 1px solid #ced4da; border-radius: 4px; padding: 10px 14px;">
          <legend style="font-size: 0.85rem; width: auto; padding: 0 6px; margin-bottom: 6px;">Lote</legend>
          <div style="display: flex; gap: 12px; align-items: flex-end;">
            <div class="mb-0">
              <label class="form-label form-label-sm mb-1">Prefijo</label>
              <input
                type="text"
                class="form-control form-control-sm"
                style="width: 120px;"
                [(ngModel)]="config.prefijoLote"
                [disabled]="!config.usarEnJarabe"
                maxlength="50"
                placeholder="Ej. LT-"
              />
            </div>
          </div>
        </fieldset>

      </div>

      <!-- Botón guardar -->
      <div>
        <button
          class="btn btn-sm btn-primary"
          (click)="save()"
          [disabled]="loading"
        >
          <i class="bi bi-floppy"></i> Guardar
        </button>
      </div>

    </div>
  `
})
export class DetailCellRendererJarabeComponent implements ICellRendererAngularComp {
  private materialJarabeService = inject(ProductionService);
  private readonly cdr = inject(ChangeDetectorRef);

  params: any;
  materialId: number = 0;
  materialName: string = '';
  loading: boolean = false;

  config: MaterialJarabeConfig = {
    idMaterial: 0,
    usarEnJarabe: false,
    prefijoNota: null,
    consecutivoNota: 0,
    prefijoLote: null,
  };

  agInit(params: any): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.description || '';
    this.loadConfig();
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  private loadConfig(): void {
    this.loading = true;
    this.materialJarabeService.getMaterialJarabeByMaterial(this.materialId).subscribe({
      next: (data) => {
        this.config = {
          idMaterial: this.materialId,
          usarEnJarabe: data?.usarEnJarabe ?? false,
          prefijoNota: data?.prefijoNota ?? null,
          consecutivoNota: data?.consecutivoNota ?? 0,
          prefijoLote: data?.prefijoLote ?? null,
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onToggleJarabe(): void {
    if (!this.config.usarEnJarabe) {
      this.config.prefijoNota = null;
      this.config.consecutivoNota = 0;
      this.config.prefijoLote = null;
    }
  }

  save(): void {
    this.loading = true;
    const payload: MaterialJarabeConfig = {
      ...this.config,
      idMaterial: this.materialId
    };
    this.materialJarabeService.saveMaterialJarabe(this.materialId, payload).subscribe({
      next: (result) => {
        this.config = {
          idMaterial: this.materialId,
          usarEnJarabe: result.usarEnJarabe,
          prefijoNota: result.prefijoNota ?? null,
          consecutivoNota: result.consecutivoNota ?? 0,
          prefijoLote: result.prefijoLote ?? null,
        };
        this.loading = false;
        alerts.basicAlert('Guardado', 'Configuración de jarabe guardada correctamente.', 'success');
      },
      error: () => {
        this.loading = false;
        alerts.basicAlert('Error', 'No se pudo guardar la configuración.', 'error');
      }
    });
  }
}
